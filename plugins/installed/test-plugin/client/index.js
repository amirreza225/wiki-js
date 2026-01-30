/**
 * Test Plugin - Client Entry Point
 *
 * This file is loaded when the plugin is initialized on the client side
 */

// Import components
import TestButton from './components/TestButton.vue'

// Export components for global registration
export default {
  components: {
    TestButton
  },

  // Plugin initialization
  install(Vue, options) {
    console.log('[Test Plugin] Initializing client-side plugin...')
    console.log('[Test Plugin] Options:', options)

    // Expose Vue globally so plugin components can access it
    if (typeof window !== 'undefined') {
      window.Vue = Vue
    }

    // Register plugin components globally
    // Use the component name from manifest (TestButton) not a prefixed version
    Vue.component('TestButton', TestButton)

    console.log('[Test Plugin] Client-side initialization complete!')
  }
}

// For store modules, export them globally
if (typeof window !== 'undefined') {
  window.WIKI_PLUGIN_STORES = window.WIKI_PLUGIN_STORES || {}

  // Example store module (optional)
  window.WIKI_PLUGIN_STORES['plugin_test-plugin_main'] = {
    namespaced: true,
    state: {
      clickCount: 0,
      lastClicked: null
    },
    mutations: {
      incrementClicks(state) {
        state.clickCount++
        state.lastClicked = new Date()
      }
    },
    actions: {
      recordClick({ commit }) {
        commit('incrementClicks')
      }
    },
    getters: {
      clickCount: state => state.clickCount,
      lastClicked: state => state.lastClicked
    }
  }
}
