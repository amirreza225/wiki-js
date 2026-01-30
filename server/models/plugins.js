const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')

/**
 * Plugins model
 */
module.exports = class Plugin extends Model {
  static get tableName() { return 'plugins' }
  static get idColumn() { return 'id' }

  static get jsonAttributes() {
    return ['author', 'repository', 'compatibility', 'config', 'state']
  }

  /**
   * Get all plugins ordered by name
   * @returns {Array} Array of plugin objects
   */
  static async getPlugins() {
    return WIKI.models.plugins.query()
      .orderBy('name', 'asc')
  }

  /**
   * Refresh plugins from disk
   * Scans /plugins/installed/ directory and syncs with database
   */
  static async refreshPluginsFromDisk() {
    const pluginsDir = path.join(WIKI.ROOTPATH, 'plugins', 'installed')

    WIKI.logger.info('[Plugins] Refreshing plugins from disk...')

    // Ensure plugins directory exists
    await fs.ensureDir(pluginsDir)

    // Read plugin directories
    const entries = await fs.readdir(pluginsDir, { withFileTypes: true })
    const pluginDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)

    // Initialize WIKI.data.plugins if not exists
    if (!WIKI.data) {
      WIKI.data = {}
    }
    WIKI.data.plugins = []

    // Get existing plugins from database
    const existingPlugins = await this.query().select('id')
    const existingIds = new Set(existingPlugins.map(p => p.id))

    // Scan each plugin directory
    for (const pluginId of pluginDirs) {
      try {
        const pluginPath = path.join(pluginsDir, pluginId)

        // Load manifest
        const manifest = await this.loadManifestFromDisk(pluginPath)

        if (!manifest) {
          WIKI.logger.warn(`[Plugins] No manifest found for plugin in ${pluginPath}`)
          continue
        }

        // Validate manifest has required fields
        if (!manifest.id || !manifest.name || !manifest.version) {
          WIKI.logger.warn(`[Plugins] Invalid manifest in ${pluginPath}: missing required fields`)
          continue
        }

        // Store in WIKI.data for reference
        WIKI.data.plugins.push({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          installPath: pluginPath
        })

        // Check if plugin exists in database
        if (existingIds.has(manifest.id)) {
          // Update existing plugin metadata (but preserve user config and enabled state)
          // Convert string author/repository to objects for JSON columns
          const authorJson = manifest.author ?
            (typeof manifest.author === 'string' ? { name: manifest.author } : manifest.author) :
            null
          const repositoryJson = manifest.repository ?
            (typeof manifest.repository === 'string' ? { url: manifest.repository } : manifest.repository) :
            null

          await WIKI.models.plugins.query()
            .patch({
              name: manifest.name,
              version: manifest.version,
              description: manifest.description || '',
              author: authorJson,
              license: manifest.license || 'UNLICENSED',
              repository: repositoryJson,
              homepage: manifest.homepage || '',
              keywords: manifest.keywords || [],
              compatibility: manifest.compatibility || null,
              manifest: manifest,
              permissions: manifest.permissions || [],
              installPath: pluginPath,
              updatedAt: new Date().toISOString()
            })
            .where('id', manifest.id)

          WIKI.logger.debug(`[Plugins] Updated plugin metadata: ${manifest.id}`)
        } else {
          // Insert new plugin (disabled by default)
          // Convert string author/repository to objects for JSON columns
          const authorJson = manifest.author ?
            (typeof manifest.author === 'string' ? { name: manifest.author } : manifest.author) :
            null
          const repositoryJson = manifest.repository ?
            (typeof manifest.repository === 'string' ? { url: manifest.repository } : manifest.repository) :
            null

          // Initialize config with defaults from schema
          const loader = require('../plugins/loader')
          const defaultConfig = loader.initializeConfigDefaults(manifest)

          await WIKI.models.plugins.query().insert({
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description || '',
            author: authorJson,
            license: manifest.license || 'UNLICENSED',
            repository: repositoryJson,
            homepage: manifest.homepage || '',
            keywords: manifest.keywords || [],
            compatibility: manifest.compatibility || null,
            config: defaultConfig,
            manifest: manifest,
            permissions: manifest.permissions || [],
            isEnabled: false,
            isInstalled: true,
            installPath: pluginPath,
            status: 'inactive',
            state: { status: 'inactive', message: 'Plugin found on disk' },
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })

          // Insert permissions
          if (manifest.permissions && manifest.permissions.length > 0) {
            const permissionRecords = manifest.permissions.map(permission => ({
              pluginId: manifest.id,
              permission,
              grantedAt: new Date().toISOString()
            }))
            await WIKI.models.pluginPermissions.query().insert(permissionRecords)
          }

          WIKI.logger.info(`[Plugins] Discovered new plugin: ${manifest.id}`)
        }
      } catch (err) {
        WIKI.logger.warn(`[Plugins] Failed to process plugin ${pluginId}: ${err.message}`)
      }
    }

    // Remove plugins from database that no longer exist on disk
    const diskPluginIds = new Set(WIKI.data.plugins.map(p => p.id))
    for (const existingId of existingIds) {
      if (!diskPluginIds.has(existingId)) {
        WIKI.logger.warn(`[Plugins] Plugin ${existingId} removed from disk, deleting from database`)
        await WIKI.models.plugins.query().deleteById(existingId)
      }
    }

    WIKI.logger.info(`[Plugins] Found ${WIKI.data.plugins.length} plugins on disk`)
  }

  /**
   * Initialize enabled plugins
   * Loads and activates all plugins where isEnabled = true
   */
  static async initPlugins() {
    WIKI.logger.info('[Plugins] Initializing enabled plugins...')

    // Get all enabled plugins
    const enabledPlugins = await WIKI.models.plugins.query()
      .where('isEnabled', true)
      .orderBy('name', 'asc')

    if (enabledPlugins.length === 0) {
      WIKI.logger.info('[Plugins] No enabled plugins found')
      return
    }

    WIKI.logger.info(`[Plugins] Loading ${enabledPlugins.length} enabled plugins`)

    const runtime = require('../plugins/runtime')
    const hooks = require('../plugins/hooks')

    // Load each plugin
    for (const plugin of enabledPlugins) {
      try {
        WIKI.logger.info(`[Plugins] Initializing plugin: ${plugin.id}`)

        // Load plugin from disk
        await runtime.loadPlugin(plugin)

        // Run database migrations
        const manager = require('../plugins/manager')
        await manager.runMigrations(plugin.id, plugin.installPath)

        // Discover and register database models
        if (WIKI.plugins.modelLoader) {
          const models = await WIKI.plugins.modelLoader.discoverModels(plugin.id, plugin.installPath)
          if (models.size > 0) {
            WIKI.plugins.modelLoader.registerPluginModels(plugin.id, models, WIKI.models.knex)
            WIKI.logger.info(`[PLUGIN ${plugin.id}] Registered ${models.size} database model(s)`)
          }
        }

        // Register hooks
        await hooks.registerPluginHooks(plugin)

        // Load plugin API routes
        if (WIKI.app) {
          try {
            const manager = require('../plugins/manager')
            const routeResult = await manager.loadPluginRoutes(plugin)

            if (routeResult.registered > 0) {
              WIKI.logger.info(`[PLUGIN ${plugin.id}] Loaded ${routeResult.registered} API route(s) at startup`)
            }
          } catch (routeErr) {
            WIKI.logger.error(`[PLUGIN ${plugin.id}] Failed to load routes at startup: ${routeErr.message}`)
            // Don't fail entire plugin load if routes fail - plugin can still work without custom API routes
          }
        } else {
          WIKI.logger.warn(`[PLUGIN ${plugin.id}] Express app not available yet, skipping route loading`)
        }

        // Update status to active
        await WIKI.models.plugins.query()
          .patch({
            status: 'active',
            state: { status: 'active', message: 'Plugin loaded successfully' }
          })
          .where('id', plugin.id)

        WIKI.logger.info(`[Plugins] Successfully initialized plugin: ${plugin.id}`)
      } catch (err) {
        WIKI.logger.error(`[Plugins] Failed to initialize plugin ${plugin.id}: ${err.message}`)

        // Update status to error
        await WIKI.models.plugins.query()
          .patch({
            status: 'error',
            state: { status: 'error', message: err.message }
          })
          .where('id', plugin.id)

        // Log error
        await runtime.logPluginError(plugin.id, 'initialization_error', err)
      }
    }
  }

  /**
   * Load manifest from plugin directory
   * @param {string} pluginPath - Absolute path to plugin directory
   * @returns {Object|null} Parsed manifest or null if not found
   */
  static async loadManifestFromDisk(pluginPath) {
    // Try plugin.yml first
    const ymlPath = path.join(pluginPath, 'plugin.yml')
    if (await fs.pathExists(ymlPath)) {
      const content = await fs.readFile(ymlPath, 'utf8')
      return yaml.load(content)
    }

    // Fall back to plugin.json
    const jsonPath = path.join(pluginPath, 'plugin.json')
    if (await fs.pathExists(jsonPath)) {
      const content = await fs.readFile(jsonPath, 'utf8')
      return JSON.parse(content)
    }

    return null
  }
}
