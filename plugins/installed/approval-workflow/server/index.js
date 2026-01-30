/**
 * Approval Workflow Plugin
 * Main Server Entry Point
 */

module.exports = {
  /**
   * Called when plugin is activated
   */
  async activated(context) {
    context.logger.info('Approval Workflow plugin activated')

    // Log configuration
    const config = context.plugin.config || {}
    context.logger.info(`Approval workflow enabled: ${config.enabled || false}`)
    context.logger.info(`Require approval for new pages: ${config.requireApprovalForNew || false}`)
    context.logger.info(`Require approval for edits: ${config.requireApprovalForEdit || false}`)
  },

  /**
   * Called when plugin is deactivated
   */
  async deactivated(context) {
    context.logger.info('Approval Workflow plugin deactivated')
  },

  /**
   * Called when plugin configuration is updated
   */
  async configUpdated(context, oldConfig, newConfig) {
    context.logger.info('Approval Workflow configuration updated')
    context.logger.debug(`Old config: ${JSON.stringify(oldConfig)}`)
    context.logger.debug(`New config: ${JSON.stringify(newConfig)}`)
  }
}
