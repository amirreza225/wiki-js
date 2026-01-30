const EventEmitter2 = require('eventemitter2')

/**
 * Plugin Hooks Module
 * Event-based lifecycle hook system with wildcard support
 */

class PluginHooks extends EventEmitter2 {
  constructor() {
    super({
      wildcard: true,
      delimiter: ':',
      maxListeners: 100
    })

    this.registeredPlugins = new Map()
  }

  /**
   * Trigger a hook and execute all listeners
   * @param {string} hookName - Hook identifier (e.g., 'page:save')
   * @param {Object} data - Data to pass to hook handlers
   * @returns {Array} Array of results from hook handlers
   */
  async trigger(hookName, data) {
    const listeners = this.listeners(hookName)

    if (listeners.length === 0) {
      WIKI.logger.debug(`[Plugin Hooks] No listeners for hook: ${hookName}`)
      return []
    }

    const startTime = Date.now()
    WIKI.logger.debug(`[Plugin Hooks] Triggering hook ${hookName} for ${listeners.length} listeners`)

    const results = []

    // Execute each listener in sequence
    for (const listener of listeners) {
      try {
        const result = await listener(data)
        results.push({ success: true, result })
      } catch (err) {
        WIKI.logger.error(`[Plugin Hooks] Error in hook ${hookName}: ${err.message}`)
        results.push({ success: false, error: err.message })
        // Continue with other listeners
      }
    }

    const duration = Date.now() - startTime
    WIKI.logger.debug(`[Plugin Hooks] ${hookName} completed in ${duration}ms`)

    if (duration > 1000) {
      WIKI.logger.warn(`[Plugin Hooks] Slow hook execution: ${hookName} took ${duration}ms`)
    }

    return results
  }

  /**
   * Trigger hook with mutation support
   * Allows handlers to modify data and return updated version
   * @param {string} hookName - Hook identifier
   * @param {Object} data - Data to pass and potentially modify
   * @returns {Object} Modified data object
   */
  async triggerMutable(hookName, data) {
    const listeners = this.listeners(hookName)

    if (listeners.length === 0) {
      return data
    }

    const startTime = Date.now()
    WIKI.logger.debug(`[Plugin Hooks] Triggering mutable hook ${hookName} for ${listeners.length} listeners`)

    let mutableData = { ...data }

    for (const listener of listeners) {
      try {
        const result = await listener(mutableData)
        if (result && typeof result === 'object') {
          mutableData = { ...mutableData, ...result }
        }
      } catch (err) {
        WIKI.logger.error(`[Plugin Hooks] Error in hook ${hookName}: ${err.message}`)
        mutableData.errors = mutableData.errors || []
        mutableData.errors.push(err.message)
      }
    }

    const duration = Date.now() - startTime
    WIKI.logger.debug(`[Plugin Hooks] ${hookName} completed in ${duration}ms`)

    if (duration > 1000) {
      WIKI.logger.warn(`[Plugin Hooks] Slow hook execution: ${hookName} took ${duration}ms`)
    }

    return mutableData
  }

  /**
   * Trigger hook with blocking support
   * Can prevent operation from continuing if canProceed is false
   * @param {string} hookName - Hook identifier
   * @param {Object} data - Data to pass (must have canProceed field)
   * @returns {Object} Modified data object
   * @throws {Error} If canProceed is false
   */
  async triggerBlocking(hookName, data) {
    const result = await this.triggerMutable(hookName, data)

    if (result.canProceed === false) {
      throw new Error(result.blockReason || 'Operation blocked by plugin')
    }

    return result
  }

  /**
   * Register hooks for a plugin
   * @param {Object} plugin - Plugin object from database
   */
  async registerPluginHooks(plugin) {
    const path = require('path')
    const fs = require('fs-extra')

    // Clear any existing hooks for this plugin
    this.unregisterPluginHooks(plugin.id)

    const hookHandlers = []
    const runtime = require('./runtime')

    // Handle hooks object (for tests and direct registration)
    if (plugin.instance && plugin.instance.hooks && typeof plugin.instance.hooks === 'object' && !Array.isArray(plugin.instance.hooks)) {
      const hooksObj = plugin.instance.hooks

      for (const [hookName, handler] of Object.entries(hooksObj)) {
        if (typeof handler !== 'function') {
          WIKI.logger.warn(`[Plugin Hooks] Invalid hook handler for ${hookName} in plugin ${plugin.id}: must be a function`)
          continue
        }

        // Create plugin context for hook execution
        const context = runtime.createContext(plugin)

        // Wrap handler with error handling
        const wrappedHandler = async (data) => {
          try {
            // Bind context as 'this' when calling the handler
            return await handler.call(context, data)
          } catch (err) {
            WIKI.logger.error(`[Plugin Hooks] Error executing hook ${hookName} for plugin ${plugin.id}: ${err.message}`)
            throw err
          }
        }

        // Register listener
        this.on(hookName, wrappedHandler)
        hookHandlers.push({ hookName, handler: wrappedHandler })

        WIKI.logger.info(`[Plugin Hooks] Registered hook ${hookName} for plugin ${plugin.id}`)
      }

      // Store handlers for cleanup
      this.registeredPlugins.set(plugin.id, hookHandlers)
      return
    }

    // Get hooks from manifest (array format for file-based hooks)
    let hooksList = []
    if (plugin.instance && Array.isArray(plugin.instance.hooks)) {
      hooksList = plugin.instance.hooks
    } else if (plugin.manifest && typeof plugin.manifest === 'string') {
      try {
        const manifest = JSON.parse(plugin.manifest)
        hooksList = manifest.hooks || []
      } catch (err) {
        WIKI.logger.warn(`[Plugin Hooks] Failed to parse manifest for plugin ${plugin.id}: ${err.message}`)
        return
      }
    } else if (plugin.manifest && Array.isArray(plugin.manifest.hooks)) {
      hooksList = plugin.manifest.hooks
    }

    if (!Array.isArray(hooksList) || hooksList.length === 0) {
      return
    }

    // Check for deprecated hooks
    if (hooksList.includes('page:save')) {
      WIKI.logger.warn(
        `[Plugin ${plugin.id}] Hook 'page:save' is deprecated. ` +
        `Use 'page:create' and 'page:update' instead. ` +
        `page:save will be removed in v3.0.0`
      )
    }

    const hooksPath = path.join(plugin.installPath, 'server', 'hooks')

    for (const hookName of hooksList) {
      // Convert hook name to camelCase filename (e.g., 'page:save' -> 'pageSave.js')
      const fileName = hookName.replace(/[:-](\w)/g, (_, char) => char.toUpperCase()) + '.js'
      const hookFilePath = path.join(hooksPath, fileName)

      // Check if hook file exists
      if (!await fs.pathExists(hookFilePath)) {
        WIKI.logger.warn(`[Plugin Hooks] Hook file not found for ${hookName} in plugin ${plugin.id}: ${hookFilePath}`)
        continue
      }

      try {
        // Load hook handler function from file
        const handler = require(hookFilePath)

        if (typeof handler !== 'function') {
          WIKI.logger.warn(`[Plugin Hooks] Invalid hook handler for ${hookName} in plugin ${plugin.id}: must export a function`)
          continue
        }

        // Create plugin context for hook execution
        const context = runtime.createContext(plugin)

        // Wrap handler with error handling
        const wrappedHandler = async (data) => {
          try {
            // Bind context as 'this' when calling the handler
            return await handler.call(context, data)
          } catch (err) {
            WIKI.logger.error(`[Plugin Hooks] Error executing hook ${hookName} for plugin ${plugin.id}: ${err.message}`)
            throw err
          }
        }

        // Register listener
        this.on(hookName, wrappedHandler)
        hookHandlers.push({ hookName, handler: wrappedHandler })

        WIKI.logger.info(`[Plugin Hooks] Registered hook ${hookName} for plugin ${plugin.id}`)
      } catch (err) {
        WIKI.logger.error(`[Plugin Hooks] Failed to load hook ${hookName} for plugin ${plugin.id}: ${err.message}`)
      }
    }

    // Store handlers for cleanup
    this.registeredPlugins.set(plugin.id, hookHandlers)
  }

  /**
   * Unregister all hooks for a plugin
   * @param {string} pluginId - Plugin identifier
   */
  unregisterPluginHooks(pluginId) {
    const hookHandlers = this.registeredPlugins.get(pluginId)

    if (!hookHandlers) {
      return
    }

    for (const { hookName, handler } of hookHandlers) {
      this.off(hookName, handler)
      WIKI.logger.info(`[Plugin Hooks] Unregistered hook ${hookName} for plugin ${pluginId}`)
    }

    this.registeredPlugins.delete(pluginId)
  }

  /**
   * Get all registered hooks for a plugin
   * @param {string} pluginId - Plugin identifier
   * @returns {Array} Array of hook names
   */
  getPluginHooks(pluginId) {
    const hookHandlers = this.registeredPlugins.get(pluginId)
    if (!hookHandlers) {
      return []
    }
    return hookHandlers.map(h => h.hookName)
  }

  /**
   * Get all available hook names
   * @returns {Array} Array of all hook names with listeners
   */
  getAvailableHooks() {
    return this.eventNames()
  }
}

// Export singleton instance
module.exports = new PluginHooks()
