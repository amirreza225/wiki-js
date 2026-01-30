/**
 * Client-Side Plugin Runtime
 *
 * Creates and manages plugin execution context
 */
export class ClientPluginRuntime {
  constructor(vueContext) {
    this.vueContext = vueContext
  }

  /**
   * Create execution context for a plugin
   *
   * @param {object} plugin - Plugin metadata
   * @returns {object} Plugin context
   */
  createContext(plugin) {
    const context = {
      // Plugin metadata
      plugin: {
        id: plugin.id,
        version: plugin.version,
        name: plugin.name
      },

      // Vue instance
      Vue: this.vueContext.Vue || null,

      // Vuetify instance (for accessing components)
      $vuetify: this.vueContext.$vuetify || null,

      // Vue router (if available)
      $router: this.vueContext.$router || null,

      // Vuex store (if available)
      $store: this.vueContext.$store || null,

      // Apollo client (if available)
      $apollo: this.vueContext.$apollo || null,

      // Utility functions
      utils: {
        /**
         * Show notification
         */
        notify: (message, type = 'info') => {
          if (this.vueContext.$store) {
            this.vueContext.$store.commit('showNotification', {
              message,
              style: type,
              icon: this.getNotificationIcon(type)
            })
          } else {
            console.log(`[Plugin:${plugin.id}] ${message}`)
          }
        },

        /**
         * Navigate to route
         */
        navigate: (path) => {
          if (this.vueContext.$router) {
            this.vueContext.$router.push(path)
          } else {
            window.location.href = path
          }
        },

        /**
         * Make GraphQL query
         */
        query: async (query, variables = {}) => {
          if (!this.vueContext.$apollo) {
            throw new Error('Apollo client not available')
          }

          try {
            const result = await this.vueContext.$apollo.query({
              query,
              variables
            })
            return result.data
          } catch (err) {
            console.error(`[Plugin:${plugin.id}] GraphQL query error:`, err)
            throw err
          }
        },

        /**
         * Make GraphQL mutation
         */
        mutate: async (mutation, variables = {}) => {
          if (!this.vueContext.$apollo) {
            throw new Error('Apollo client not available')
          }

          try {
            const result = await this.vueContext.$apollo.mutate({
              mutation,
              variables
            })
            return result.data
          } catch (err) {
            console.error(`[Plugin:${plugin.id}] GraphQL mutation error:`, err)
            throw err
          }
        }
      },

      // Console logger scoped to plugin
      console: {
        log: (...args) => console.log(`[Plugin:${plugin.id}]`, ...args),
        warn: (...args) => console.warn(`[Plugin:${plugin.id}]`, ...args),
        error: (...args) => console.error(`[Plugin:${plugin.id}]`, ...args),
        debug: (...args) => console.debug(`[Plugin:${plugin.id}]`, ...args)
      }
    }

    return context
  }

  /**
   * Get notification icon based on type
   *
   * @param {string} type - Notification type
   * @returns {string} Icon name
   */
  getNotificationIcon(type) {
    const icons = {
      info: 'mdi-information',
      success: 'mdi-check-circle',
      warning: 'mdi-alert',
      error: 'mdi-alert-circle'
    }
    return icons[type] || icons.info
  }

  /**
   * Execute plugin method with error isolation
   *
   * @param {object} plugin - Plugin instance
   * @param {string} method - Method name to execute
   * @param {...any} args - Arguments to pass to method
   * @returns {any} Method return value
   */
  async executePluginMethod(plugin, method, ...args) {
    try {
      if (!plugin || typeof plugin[method] !== 'function') {
        throw new Error(`Plugin method ${method} not found`)
      }

      const context = this.createContext(plugin)
      return await plugin[method].call(context, ...args)
    } catch (err) {
      console.error(`[Plugin:${plugin.id}] Execution error in ${method}:`, err)
      throw err
    }
  }

  /**
   * Wrap component with plugin error boundary
   *
   * @param {object} component - Vue component
   * @param {string} pluginId - Plugin identifier
   * @returns {object} Wrapped component
   */
  wrapComponent(component, pluginId) {
    return {
      ...component,
      errorCaptured(err, vm, info) {
        console.error(`[Plugin:${pluginId}] Component error:`, err, info)

        // Show error to user
        if (this.$store) {
          this.$store.commit('showNotification', {
            message: `Plugin error: ${err.message}`,
            style: 'error',
            icon: 'mdi-alert-circle'
          })
        }

        // Prevent error propagation
        return false
      }
    }
  }
}
