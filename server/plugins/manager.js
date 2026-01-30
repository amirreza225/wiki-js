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
      await WIKI.models.plugins.query().insert({
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
        manifest: manifest, // Store full manifest for client-side use
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

      // Validate plugin build
      const validation = await this.validatePluginBuild(plugin.installPath)
      if (!validation.valid) {
        throw new Error(`Plugin build validation failed: ${validation.error}`)
      }
      if (validation.warning) {
        WIKI.logger.warn(`[PLUGIN ${pluginId}] ${validation.warning}`)
      }

      // Check if plugin has GraphQL extensions (requires restart)
      const hasGraphQL = await this.hasGraphQLExtensions(plugin.installPath)

      // Update database
      await WIKI.models.plugins.query()
        .patch({
          isEnabled: true,
          status: hasGraphQL ? 'inactive' : 'active',
          state: hasGraphQL ?
            { status: 'pending_restart', message: 'Server restart required to activate GraphQL extensions' } :
            { status: 'active', message: 'Plugin activated successfully' },
          activatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where('id', pluginId)

      // If no GraphQL, load plugin immediately
      if (!hasGraphQL) {
        const updatedPlugin = await WIKI.models.plugins.query().findById(pluginId)
        await runtime.loadPlugin(updatedPlugin)

        // Discover and register database models
        if (WIKI.plugins.modelLoader) {
          const models = await WIKI.plugins.modelLoader.discoverModels(pluginId, updatedPlugin.installPath)
          if (models.size > 0) {
            WIKI.plugins.modelLoader.registerPluginModels(pluginId, models, WIKI.models.knex)
          }
        }

        // Discover and register API routes
        if (WIKI.plugins.routeLoader && WIKI.app) {
          const router = await WIKI.plugins.routeLoader.discoverRoutes(pluginId, updatedPlugin.installPath)
          if (router) {
            WIKI.plugins.routeLoader.registerPluginRoutes(WIKI.app, pluginId, router, updatedPlugin)
          }
        }

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

      // Unregister API routes
      if (WIKI.plugins.routeLoader && WIKI.app) {
        WIKI.plugins.routeLoader.unregisterPluginRoutes(WIKI.app, pluginId)
      }

      // Unregister database models
      if (WIKI.plugins.modelLoader) {
        WIKI.plugins.modelLoader.unregisterPluginModels(pluginId)
      }

      // Update database
      await WIKI.models.plugins.query()
        .patch({
          isEnabled: false,
          status: 'inactive',
          state: hasGraphQL ?
            { status: 'pending_restart', message: 'Server restart required to remove GraphQL extensions' } :
            { status: 'inactive', message: 'Plugin deactivated successfully' },
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
  },

  /**
   * Validate that plugin bundles use externals correctly
   * @param {string} pluginPath - Absolute path to plugin directory
   * @returns {Object} Validation result with valid flag and optional error/warning
   */
  async validatePluginBuild(pluginPath) {
    const cachePath = path.join(WIKI.ROOTPATH, 'plugins', 'cache', path.basename(pluginPath))
    const manifestPath = path.join(cachePath, 'manifest.json')

    if (!await fs.pathExists(manifestPath)) {
      return { valid: true, warning: 'No client bundle found' }
    }

    try {
      const manifest = await fs.readJson(manifestPath)
      const bundlePath = path.join(cachePath, manifest.js || manifest.assets.js)

      if (!await fs.pathExists(bundlePath)) {
        return { valid: true, warning: 'No client bundle found' }
      }

      const bundleContent = await fs.readFile(bundlePath, 'utf8')
      const bundleSize = bundleContent.length

      // Warn if bundle is suspiciously large (> 500KB suggests bundled dependencies)
      if (bundleSize > 500000) {
        return {
          valid: false,
          error: `Client bundle is ${Math.round(bundleSize / 1024)}KB. May be bundling Vue/Vuetify. ` +
                 'Rebuild with: yarn build:plugins'
        }
      }

      // Check for specific patterns indicating bundled dependencies
      const hasVuetifyCode = bundleContent.includes('VBtn.render') ||
                            bundleContent.includes('vuetify/lib/components')

      if (hasVuetifyCode) {
        return {
          valid: false,
          error: 'Plugin bundle includes Vuetify code. Rebuild with correct externals configuration.'
        }
      }

      return { valid: true }
    } catch (err) {
      return { valid: true, warning: `Could not validate bundle: ${err.message}` }
    }
  },

  /**
   * Discover and register API routes for a plugin
   * @param {Object} plugin - Plugin record from database
   * @returns {Promise<Object>} Route registration result
   */
  async loadPluginRoutes(plugin) {
    const pluginDiskPath = path.join(WIKI.ROOTPATH, 'plugins', 'installed', plugin.id)
    const routesPath = path.join(pluginDiskPath, 'server', 'routes', 'index.js')

    // Check if routes file exists
    if (!await fs.pathExists(routesPath)) {
      WIKI.logger.debug(`[PLUGIN ${plugin.id}] No API routes found`)
      return { registered: 0, routes: [] }
    }

    try {
      // Clear require cache for HMR support
      delete require.cache[require.resolve(routesPath)]

      // Load route module
      const routes = require(routesPath)

      // Validate route module exports a router
      if (typeof routes !== 'function' && (!routes.router || typeof routes.router !== 'function')) {
        throw new Error('Route module must export Express router or middleware function')
      }

      // Create middleware to inject plugin context
      const pluginContextMiddleware = (req, res, next) => {
        try {
          // Inject plugin context into request
          const pluginModels = WIKI.plugins.modelLoader ? WIKI.plugins.modelLoader.getPluginModelsObject(plugin.id) : {}

          // Debug: Log if models are missing when expected
          if (Object.keys(pluginModels).length === 0) {
            const hasDbPermission = plugin.permissions && (
              plugin.permissions.includes('database:read') ||
              plugin.permissions.includes('database:write')
            )
            if (hasDbPermission) {
              WIKI.logger.warn(`[PLUGIN ${plugin.id}] No models registered but plugin has database permissions`)
            }
          }

          req.pluginContext = {
            logger: WIKI.logger,
            config: plugin.config || {},
            db: {
              knex: WIKI.models.knex,
              pluginModels
            },
            plugin: {
              id: plugin.id,
              version: plugin.version,
              path: pluginDiskPath
            },
            WIKI: {
              models: WIKI.models
            }
          }
          WIKI.logger.info(`[PLUGIN ${plugin.id}] Context middleware executed for ${req.method} ${req.path}`)
          next()
        } catch (err) {
          WIKI.logger.error(`[PLUGIN ${plugin.id}] Context middleware error: ${err.message}`)
          next(err)
        }
      }

      // Register routes with the pluginRouter (not the app directly)
      const router = routes.router || routes
      const fullPath = `/api/plugin/${plugin.id}`

      if (!WIKI.pluginRouter) {
        WIKI.logger.error(`[PLUGIN ${plugin.id}] Plugin router not available - routes cannot be registered`)
        throw new Error('Plugin router not initialized. Ensure master.js has created WIKI.pluginRouter')
      }

      // Create a wrapper middleware that includes context + router
      const combinedMiddleware = (req, res, next) => {
        pluginContextMiddleware(req, res, (err) => {
          if (err) return next(err)
          router(req, res, next)
        })
      }

      // Add the route to pluginRouter (which is already mounted at /api/plugin in master.js)
      // Use relative path: /${plugin.id} instead of absolute path /api/plugin/${plugin.id}
      WIKI.pluginRouter.use(`/${plugin.id}`, combinedMiddleware)

      WIKI.logger.info(`[PLUGIN ${plugin.id}] Registered API routes at ${fullPath}`)
      WIKI.logger.info(`[PLUGIN ${plugin.id}] DEBUG: pluginRouter stack layers: ${WIKI.pluginRouter.stack.length}`)

      // Log route details for debugging
      WIKI.logger.info(`[PLUGIN ${plugin.id}] Full test URL: http://localhost:3000${fullPath}/stats`)

      // Debug: Log the routes in the plugin router
      if (router.stack) {
        WIKI.logger.info(`[PLUGIN ${plugin.id}] Routes defined in plugin:`)
        router.stack.forEach((layer, idx) => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).join(',').toUpperCase()
            WIKI.logger.info(`  ${idx}: ${methods} ${fullPath}${layer.route.path}`)
          }
        })
      }

      return {
        registered: 1,
        routes: [{ basePath: fullPath }]
      }
    } catch (err) {
      WIKI.logger.error(`[PLUGIN ${plugin.id}] Failed to load API routes: ${err.message}`)
      WIKI.logger.error(`[PLUGIN ${plugin.id}] Stack trace:`, err.stack)
      throw err
    }
  }
}
