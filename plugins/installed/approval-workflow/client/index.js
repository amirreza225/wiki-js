/**
 * Approval Workflow Plugin
 * Client-Side Entry Point
 */

import approvalStore from './store/approval'
import ApprovalBadge from './components/ApprovalBadge.vue'

// Register Vuex store module globally so it can be auto-loaded
if (typeof window !== 'undefined') {
  window.WIKI_PLUGIN_STORES = window.WIKI_PLUGIN_STORES || {}
  window.WIKI_PLUGIN_STORES['plugin_approval-workflow_approval'] = approvalStore
}

// Export for potential direct imports
export { approvalStore }

// Plugin initialization
export default {
  install(Vue, options = {}) {
    console.log('[Approval Workflow] Plugin installed')

    // Register components globally
    // Use the exact component name from the manifest
    Vue.component('PluginApprovalWorkflowApprovalBadge', ApprovalBadge)
  }
}
