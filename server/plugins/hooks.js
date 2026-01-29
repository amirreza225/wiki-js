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

    return results
  }

  /**
   * Register hooks for a plugin
   * @param {Object} plugin - Plugin object from database
   */
  async registerPluginHooks(plugin) {
    if (!plugin.instance || !plugin.instance.hooks) {
      return
    }

    const runtime = require('./runtime')
    const hooks = plugin.instance.hooks

    // Clear any existing hooks for this plugin
    this.unregisterPluginHooks(plugin.id)

    const hookHandlers = []

    for (const hookName in hooks) {
      const handler = hooks[hookName]

      if (typeof handler !== 'function') {
        WIKI.logger.warn(`[Plugin Hooks] Invalid hook handler for ${hookName} in plugin ${plugin.id}`)
        continue
      }

      // Wrap handler with runtime context and error handling
      const wrappedHandler = async (data) => {
        return await runtime.executePlugin(plugin, hookName, data)
      }

      // Register listener
      this.on(hookName, wrappedHandler)
      hookHandlers.push({ hookName, handler: wrappedHandler })

      WIKI.logger.info(`[Plugin Hooks] Registered hook ${hookName} for plugin ${plugin.id}`)
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
