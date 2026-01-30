/**
 * Plugins Vuex Store Module
 *
 * Manages plugin state and UI injections
 */
export default {
  namespaced: true,
  state: {
    // List of loaded plugins
    plugins: [],

    // UI injection points
    injections: {
      'page:toolbar': [],
      'page:footer': [],
      'editor:toolbar': [],
      'admin:sidebar': [],
      'admin:dashboard': []
    },

    // Plugin loading status
    loading: false,
    initialized: false
  },

  getters: {
    /**
     * Get all loaded plugins
     */
    allPlugins: state => state.plugins,

    /**
     * Get plugin by ID
     */
    getPluginById: state => id => {
      return state.plugins.find(p => p.id === id) || null
    },

    /**
     * Get injections for a specific location
     */
    getInjections: state => location => {
      return state.injections[location] || []
    },

    /**
     * Check if plugins are loaded
     */
    isInitialized: state => state.initialized
  },

  mutations: {
    /**
     * Set plugins list
     */
    SET_PLUGINS(state, plugins) {
      state.plugins = plugins
    },

    /**
     * Add a single plugin
     */
    ADD_PLUGIN(state, plugin) {
      const existingIndex = state.plugins.findIndex(p => p.id === plugin.id)
      if (existingIndex >= 0) {
        state.plugins.splice(existingIndex, 1, plugin)
      } else {
        state.plugins.push(plugin)
      }
    },

    /**
     * Remove a plugin
     */
    REMOVE_PLUGIN(state, pluginId) {
      state.plugins = state.plugins.filter(p => p.id !== pluginId)

      // Also remove injections from this plugin
      for (const location in state.injections) {
        state.injections[location] = state.injections[location].filter(
          i => i.pluginId !== pluginId
        )
      }
    },

    /**
     * Register UI injection
     */
    REGISTER_INJECTION(state, { location, component, pluginId, position = 'end', condition = null }) {
      if (!state.injections[location]) {
        state.injections[location] = []
      }

      const injection = {
        pluginId,
        component,
        position,
        condition,
        id: `${pluginId}-${component}`
      }

      // Check if injection already exists
      const existingIndex = state.injections[location].findIndex(
        i => i.id === injection.id
      )

      if (existingIndex >= 0) {
        state.injections[location].splice(existingIndex, 1, injection)
      } else {
        if (position === 'start') {
          state.injections[location].unshift(injection)
        } else {
          state.injections[location].push(injection)
        }
      }
    },

    /**
     * Unregister UI injection
     */
    UNREGISTER_INJECTION(state, { location, pluginId, component }) {
      if (!state.injections[location]) return

      state.injections[location] = state.injections[location].filter(
        i => !(i.pluginId === pluginId && i.component === component)
      )
    },

    /**
     * Set loading state
     */
    SET_LOADING(state, loading) {
      state.loading = loading
    },

    /**
     * Set initialized state
     */
    SET_INITIALIZED(state, initialized) {
      state.initialized = initialized
    }
  },

  actions: {
    /**
     * Register plugin and its injections
     */
    async registerPlugin({ commit }, { plugin, manifest }) {
      commit('ADD_PLUGIN', { ...plugin, manifest })

      // Register UI injections from manifest
      if (manifest && manifest.uiInjections) {
        for (const injection of manifest.uiInjections) {
          commit('REGISTER_INJECTION', {
            location: injection.location,
            component: injection.component,
            pluginId: plugin.id,
            position: injection.position || 'end',
            condition: injection.condition || null
          })
        }
      }
    },

    /**
     * Unregister plugin
     */
    async unregisterPlugin({ commit }, pluginId) {
      commit('REMOVE_PLUGIN', pluginId)
    },

    /**
     * Initialize plugins system
     */
    async initialize({ commit }) {
      commit('SET_LOADING', true)
      try {
        // Initialization logic handled by plugin loader
        commit('SET_INITIALIZED', true)
      } finally {
        commit('SET_LOADING', false)
      }
    }
  }
}
