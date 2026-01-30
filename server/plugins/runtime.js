const path = require('path')
const _ = require('lodash')
const security = require('./security')

/**
 * Plugin Runtime Module
 * Creates plugin execution context and enforces permissions
 */

module.exports = {
  /**
   * Create execution context for a plugin
   * @param {Object} plugin - Plugin object from database
   * @returns {Object} Context object with allowed APIs
   */
  createContext(plugin) {
    const context = {
      plugin: {
        id: plugin.id,
        version: plugin.version,
        path: plugin.installPath,
        config: plugin.config || {}
      },
      logger: this.createPluginLogger(plugin.id)
    }

    // Add APIs based on granted permissions
    if (security.checkPermission(plugin, 'config:read')) {
      context.config = this.createConfigAPI(plugin)
    }

    if (security.checkPermission(plugin, 'database:read')) {
      context.db = this.createDatabaseAPI(plugin)
    }

    if (security.checkPermission(plugin, 'events:emit')) {
      context.events = WIKI.events.outbound
    }

    if (security.checkPermission(plugin, 'cache:read')) {
      context.cache = WIKI.cache
    }

    if (security.checkPermission(plugin, 'core:read')) {
      context.WIKI = this.createReadOnlyWIKI()
    }

    return context
  },

  /**
   * Create scoped logger for plugin
   * @param {string} pluginId - Plugin identifier
   * @returns {Object} Logger instance
   */
  createPluginLogger(pluginId) {
    return {
      info: (message) => WIKI.logger.info(`[Plugin:${pluginId}] ${message}`),
      warn: (message) => WIKI.logger.warn(`[Plugin:${pluginId}] ${message}`),
      error: (message) => WIKI.logger.error(`[Plugin:${pluginId}] ${message}`),
      debug: (message) => WIKI.logger.debug(`[Plugin:${pluginId}] ${message}`)
    }
  },

  /**
   * Create config API for plugin
   * @param {Object} plugin - Plugin object from database
   * @returns {Object} Config API
   */
  createConfigAPI(plugin) {
    return {
      get: (key) => {
        if (!plugin.config) return undefined
        return _.get(plugin.config, key)
      },
      set: async (key, value) => {
        // Check write permission
        await security.enforcePermission(plugin, 'config:write')

        // Update config in database
        const updatedConfig = { ...(plugin.config || {}) }
        _.set(updatedConfig, key, value)

        await WIKI.models.plugins.query()
          .patch({ config: updatedConfig })
          .where('id', plugin.id)

        // Update in-memory config
        plugin.config = updatedConfig
      }
    }
  },

  /**
   * Create database API for plugin
   * @param {Object} plugin - Plugin object from database
   * @returns {Object} Database API
   */
  createDatabaseAPI(plugin) {
    const api = {
      knex: WIKI.models.knex
    }

    // Add core models if permission granted
    if (security.checkPermission(plugin, 'database:core')) {
      api.models = WIKI.models
    }

    // Add plugin's own models if registered
    if (WIKI.plugins.modelLoader && WIKI.plugins.modelLoader.hasPluginModels(plugin.id)) {
      api.pluginModels = WIKI.plugins.modelLoader.getPluginModelsObject(plugin.id)
    }

    // Add WIKI reference for convenience
    api.WIKI = WIKI

    return api
  },

  /**
   * Create read-only WIKI object with Proxy enforcement
   * Prevents plugins from modifying core WIKI internals
   * @returns {Proxy} Read-only WIKI object
   */
  createReadOnlyWIKI() {
    // Create deep read-only proxy for models
    const createReadOnlyProxy = (target, path = 'WIKI') => {
      return new Proxy(target, {
        get(obj, prop) {
          const value = obj[prop]

          // Allow access to methods and properties
          if (typeof value === 'function') {
            // Return bound function to preserve context
            return value.bind(obj)
          }

          // Recursively wrap nested objects
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            return createReadOnlyProxy(value, `${path}.${String(prop)}`)
          }

          return value
        },
        set(obj, prop, value) {
          WIKI.logger.warn(`[Plugin Security] Attempted to modify read-only property: ${path}.${String(prop)}`)
          throw new Error(`Cannot modify read-only property: ${path}.${String(prop)}`)
        },
        deleteProperty(obj, prop) {
          WIKI.logger.warn(`[Plugin Security] Attempted to delete read-only property: ${path}.${String(prop)}`)
          throw new Error(`Cannot delete read-only property: ${path}.${String(prop)}`)
        },
        defineProperty(obj, prop, descriptor) {
          WIKI.logger.warn(`[Plugin Security] Attempted to define property on read-only object: ${path}.${String(prop)}`)
          throw new Error(`Cannot define property on read-only object: ${path}.${String(prop)}`)
        }
      })
    }

    // Return limited, read-only WIKI object
    return createReadOnlyProxy({
      version: WIKI.version,
      models: WIKI.models,
      config: WIKI.config
    })
  },

  /**
   * Check if plugin has specific permission
   * @param {Object} plugin - Plugin object from database
   * @param {string} permission - Permission identifier
   * @returns {boolean} True if plugin has permission
   */
  hasPermission(plugin, permission) {
    return security.checkPermission(plugin, permission)
  },

  /**
   * Execute plugin method with error isolation
   * @param {Object} plugin - Plugin object from database
   * @param {string} method - Method name to execute
   * @param {...any} args - Arguments to pass to method
   * @returns {any} Method return value
   */
  async executePlugin(plugin, method, ...args) {
    try {
      // Get plugin instance
      if (!plugin.instance) {
        throw new Error(`Plugin ${plugin.id} is not loaded`)
      }

      if (typeof plugin.instance[method] !== 'function') {
        throw new Error(`Plugin ${plugin.id} does not have method: ${method}`)
      }

      // Create context
      const context = this.createContext(plugin)

      // Bind context and execute
      const boundMethod = plugin.instance[method].bind(context)
      return await boundMethod(...args)
    } catch (err) {
      // Log error to database
      await this.logPluginError(plugin.id, 'execution_error', err)

      // Re-throw for caller
      throw err
    }
  },

  /**
   * Load plugin from disk
   * @param {Object} plugin - Plugin object from database
   * @returns {Object} Plugin instance
   */
  async loadPlugin(plugin) {
    try {
      const entryPath = path.join(plugin.installPath, 'server', 'index.js')

      // Check if entry point exists
      const fs = require('fs-extra')
      if (!await fs.pathExists(entryPath)) {
        throw new Error(`Plugin entry point not found: ${entryPath}`)
      }

      // Require plugin module
      // Clear require cache to allow hot reload
      delete require.cache[require.resolve(entryPath)]
      const pluginModule = require(entryPath)

      // Store instance
      plugin.instance = pluginModule

      // Call init if exists
      if (typeof pluginModule.init === 'function') {
        await this.executePlugin(plugin, 'init')
      }

      WIKI.logger.info(`[Plugin Runtime] Loaded plugin ${plugin.id}`)

      return pluginModule
    } catch (err) {
      await this.logPluginError(plugin.id, 'load_error', err)
      throw err
    }
  },

  /**
   * Log plugin error to database
   * @param {string} pluginId - Plugin identifier
   * @param {string} errorType - Error type
   * @param {Error} error - Error object
   */
  async logPluginError(pluginId, errorType, error) {
    try {
      await WIKI.models.pluginErrors.query().insert({
        pluginId,
        errorType,
        errorMessage: error.message,
        stackTrace: error.stack,
        createdAt: new Date().toISOString(),
        resolved: false
      })
    } catch (logError) {
      WIKI.logger.warn(`Failed to log error for plugin ${pluginId}: ${logError.message}`)
    }
  }
}
