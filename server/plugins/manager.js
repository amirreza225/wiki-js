const fs = require('fs-extra')
const path = require('path')
const { exec } = require('child_process')
const util = require('util')
const loader = require('./loader')
const runtime = require('./runtime')
const hooks = require('./hooks')

const execAsync = util.promisify(exec)

/**
 * Plugin Manager Module
 * Manages plugin lifecycle operations (install, activate, deactivate, uninstall)
 */

module.exports = {
  /**
   * Install plugin from ZIP file
   * @param {string} zipPath - Absolute path to ZIP file
   * @returns {Object} Installed plugin manifest
   */
  async installPlugin(zipPath) {
    let manifest = null
    let pluginId = null

    try {
      WIKI.logger.info(`[Plugin Manager] Installing plugin from ${zipPath}`)

      // Read ZIP to get plugin ID from manifest
      const AdmZip = require('adm-zip')
      const zip = new AdmZip(zipPath)
      const entries = zip.getEntries()

      // Find manifest file
      const manifestEntry = entries.find(e =>
        e.entryName.endsWith('plugin.yml') || e.entryName.endsWith('plugin.json')
      )

      if (!manifestEntry) {
        throw new Error('No plugin.yml or plugin.json found in ZIP file')
      }

      // Parse manifest to get ID
      const manifestContent = manifestEntry.getData().toString('utf8')
      if (manifestEntry.entryName.endsWith('.yml')) {
        const yaml = require('js-yaml')
        manifest = yaml.load(manifestContent)
      } else {
        manifest = JSON.parse(manifestContent)
      }

      pluginId = manifest.id

      if (!pluginId) {
        throw new Error('Plugin manifest does not contain an id field')
      }

      // Check if plugin already installed
      const existing = await WIKI.models.plugins.query().findById(pluginId)
      if (existing) {
        throw new Error(`Plugin ${pluginId} is already installed. Please uninstall it first.`)
      }

      // Extract plugin
      manifest = await loader.extractPlugin(zipPath, pluginId)

      // Validate manifest
      await loader.validateManifest(manifest)

      const installPath = path.join(WIKI.ROOTPATH, 'plugins', 'installed', pluginId)

      // Install npm dependencies if package.json exists
      const pkgPath = path.join(installPath, 'package.json')
      if (await fs.pathExists(pkgPath)) {
        WIKI.logger.info(`[Plugin Manager] Installing dependencies for ${pluginId}`)
        try {
          await execAsync('yarn install --production', {
            cwd: installPath,
            timeout: 300000 // 5 minutes
          })
        } catch (err) {
          WIKI.logger.warn(`[Plugin Manager] Failed to install dependencies: ${err.message}`)
          // Continue anyway, dependencies might not be critical
        }
      }

      // Run migrations
      await this.runMigrations(pluginId, installPath)

      // Insert into database
      const plugin = await WIKI.models.plugins.query().insert({
        id: pluginId,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        author: manifest.author || null,
        license: manifest.license || 'UNLICENSED',
        repository: manifest.repository || null,
        homepage: manifest.homepage || '',
        keywords: manifest.keywords || [],
        compatibility: manifest.compatibility || null,
        config: manifest.config || null,
        permissions: manifest.permissions || [],
        isEnabled: false,
        isInstalled: true,
        installPath,
        status: 'inactive',
        state: { status: 'inactive', message: 'Plugin installed successfully' },
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      // Insert permissions into tracking table
      if (manifest.permissions && manifest.permissions.length > 0) {
        const permissionRecords = manifest.permissions.map(permission => ({
          pluginId,
          permission,
          grantedAt: new Date().toISOString()
        }))
        await WIKI.models.pluginPermissions.query().insert(permissionRecords)
      }

      WIKI.logger.info(`[Plugin Manager] Successfully installed plugin ${pluginId}`)

      return manifest
    } catch (err) {
      WIKI.logger.error(`[Plugin Manager] Failed to install plugin: ${err.message}`)

      // Cleanup on failure
      if (pluginId) {
        const installPath = path.join(WIKI.ROOTPATH, 'plugins', 'installed', pluginId)
        if (await fs.pathExists(installPath)) {
          await fs.remove(installPath)
        }
      }

      throw err
    }
  },

  /**
   * Activate a plugin
   * @param {string} pluginId - Plugin identifier
   * @returns {Object} { requiresRestart: boolean }
   */
  async activatePlugin(pluginId) {
    try {
      WIKI.logger.info(`[Plugin Manager] Activating plugin ${pluginId}`)

      // Load plugin from database
      const plugin = await WIKI.models.plugins.query().findById(pluginId)

      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (!plugin.isInstalled) {
        throw new Error(`Plugin ${pluginId} is not installed`)
      }

      if (plugin.isEnabled) {
        throw new Error(`Plugin ${pluginId} is already enabled`)
      }

      // Check if plugin has GraphQL extensions (requires restart)
      const hasGraphQL = await this.hasGraphQLExtensions(plugin.installPath)

      // Update database
      await WIKI.models.plugins.query()
        .patch({
          isEnabled: true,
          status: hasGraphQL ? 'inactive' : 'active',
          state: hasGraphQL
            ? { status: 'pending_restart', message: 'Server restart required to activate GraphQL extensions' }
            : { status: 'active', message: 'Plugin activated successfully' },
          activatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where('id', pluginId)

      // If no GraphQL, load plugin immediately
      if (!hasGraphQL) {
        const updatedPlugin = await WIKI.models.plugins.query().findById(pluginId)
        await runtime.loadPlugin(updatedPlugin)

        // Register hooks
        await hooks.registerPluginHooks(updatedPlugin)

        // Call activated lifecycle hook
        if (updatedPlugin.instance && typeof updatedPlugin.instance.activated === 'function') {
          await runtime.executePlugin(updatedPlugin, 'activated')
        }

        // Update status
        await WIKI.models.plugins.query()
          .patch({ status: 'active' })
          .where('id', pluginId)
      }

      WIKI.logger.info(`[Plugin Manager] Plugin ${pluginId} ${hasGraphQL ? 'marked for activation (restart required)' : 'activated'}`)

      return { requiresRestart: hasGraphQL }
    } catch (err) {
      WIKI.logger.error(`[Plugin Manager] Failed to activate plugin ${pluginId}: ${err.message}`)

      // Update status to error
      await WIKI.models.plugins.query()
        .patch({
          status: 'error',
          state: { status: 'error', message: err.message }
        })
        .where('id', pluginId)

      // Log error
      await runtime.logPluginError(pluginId, 'activation_error', err)

      throw err
    }
  },

  /**
   * Deactivate a plugin
   * @param {string} pluginId - Plugin identifier
   * @returns {Object} { requiresRestart: boolean }
   */
  async deactivatePlugin(pluginId) {
    try {
      WIKI.logger.info(`[Plugin Manager] Deactivating plugin ${pluginId}`)

      // Load plugin from database
      const plugin = await WIKI.models.plugins.query().findById(pluginId)

      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      if (!plugin.isEnabled) {
        throw new Error(`Plugin ${pluginId} is not enabled`)
      }

      // Check if plugin has GraphQL extensions (requires restart)
      const hasGraphQL = await this.hasGraphQLExtensions(plugin.installPath)

      // Call deactivated lifecycle hook if plugin is loaded
      if (plugin.instance && typeof plugin.instance.deactivated === 'function') {
        await runtime.executePlugin(plugin, 'deactivated')
      }

      // Unregister hooks
      hooks.unregisterPluginHooks(pluginId)

      // Update database
      await WIKI.models.plugins.query()
        .patch({
          isEnabled: false,
          status: 'inactive',
          state: hasGraphQL
            ? { status: 'pending_restart', message: 'Server restart required to remove GraphQL extensions' }
            : { status: 'inactive', message: 'Plugin deactivated successfully' },
          updatedAt: new Date().toISOString()
        })
        .where('id', pluginId)

      WIKI.logger.info(`[Plugin Manager] Plugin ${pluginId} deactivated`)

      return { requiresRestart: hasGraphQL }
    } catch (err) {
      WIKI.logger.error(`[Plugin Manager] Failed to deactivate plugin ${pluginId}: ${err.message}`)

      // Log error
      await runtime.logPluginError(pluginId, 'deactivation_error', err)

      throw err
    }
  },

  /**
   * Uninstall a plugin
   * @param {string} pluginId - Plugin identifier
   * @returns {Object} Success response
   */
  async uninstallPlugin(pluginId) {
    try {
      WIKI.logger.info(`[Plugin Manager] Uninstalling plugin ${pluginId}`)

      // Load plugin from database
      const plugin = await WIKI.models.plugins.query().findById(pluginId)

      if (!plugin) {
        throw new Error(`Plugin ${pluginId} not found`)
      }

      // Ensure plugin is disabled
      if (plugin.isEnabled) {
        throw new Error(`Cannot uninstall enabled plugin. Please deactivate ${pluginId} first.`)
      }

      // Delete from database (cascade will handle related tables)
      await WIKI.models.plugins.query().deleteById(pluginId)

      // Remove files from disk
      if (plugin.installPath && await fs.pathExists(plugin.installPath)) {
        await fs.remove(plugin.installPath)
      }

      WIKI.logger.info(`[Plugin Manager] Plugin ${pluginId} uninstalled successfully`)

      return { success: true }
    } catch (err) {
      WIKI.logger.error(`[Plugin Manager] Failed to uninstall plugin ${pluginId}: ${err.message}`)
      throw err
    }
  },

  /**
   * Run plugin database migrations
   * @param {string} pluginId - Plugin identifier
   * @param {string} pluginPath - Absolute path to plugin directory
   */
  async runMigrations(pluginId, pluginPath) {
    const migrationsDir = path.join(pluginPath, 'migrations')

    // Check if migrations directory exists
    if (!await fs.pathExists(migrationsDir)) {
      WIKI.logger.debug(`[Plugin Manager] No migrations found for plugin ${pluginId}`)
      return
    }

    // Read migration files
    const files = await fs.readdir(migrationsDir)
    const migrationFiles = files
      .filter(f => f.endsWith('.js'))
      .sort() // Execute in order

    if (migrationFiles.length === 0) {
      return
    }

    WIKI.logger.info(`[Plugin Manager] Running ${migrationFiles.length} migrations for plugin ${pluginId}`)

    // Get executed migrations from database
    const executed = await WIKI.models.pluginMigrations.query()
      .where('pluginId', pluginId)
      .select('migrationName')

    const executedNames = new Set(executed.map(m => m.migrationName))

    // Run pending migrations
    for (const file of migrationFiles) {
      if (executedNames.has(file)) {
        WIKI.logger.debug(`[Plugin Manager] Skipping already executed migration: ${file}`)
        continue
      }

      try {
        WIKI.logger.info(`[Plugin Manager] Running migration ${file} for plugin ${pluginId}`)

        const migrationPath = path.join(migrationsDir, file)
        const migration = require(migrationPath)

        // Execute migration up
        if (typeof migration.up !== 'function') {
          throw new Error(`Migration ${file} does not export an 'up' function`)
        }

        await migration.up(WIKI.models.knex)

        // Record migration
        await WIKI.models.pluginMigrations.query().insert({
          pluginId,
          migrationName: file,
          executedAt: new Date().toISOString()
        })

        WIKI.logger.info(`[Plugin Manager] Successfully executed migration ${file}`)
      } catch (err) {
        WIKI.logger.error(`[Plugin Manager] Migration ${file} failed: ${err.message}`)
        throw new Error(`Migration ${file} failed: ${err.message}`)
      }
    }
  },

  /**
   * Check if plugin has GraphQL extensions
   * @param {string} pluginPath - Absolute path to plugin directory
   * @returns {boolean} True if plugin has GraphQL schema or resolvers
   */
  async hasGraphQLExtensions(pluginPath) {
    const graphqlDir = path.join(pluginPath, 'graphql')

    if (!await fs.pathExists(graphqlDir)) {
      return false
    }

    const schemaPath = path.join(graphqlDir, 'schema.graphql')
    const resolversPath = path.join(graphqlDir, 'resolvers.js')

    const hasSchema = await fs.pathExists(schemaPath)
    const hasResolvers = await fs.pathExists(resolversPath)

    return hasSchema || hasResolvers
  }
}
