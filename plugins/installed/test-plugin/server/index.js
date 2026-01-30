/**
 * Test Plugin - Server Entry Point
 *
 * This file is loaded when the plugin is activated on the server side
 *
 * IMPORTANT: The context is bound as 'this', not passed as a parameter
 */

module.exports = {
  /**
   * Plugin initialization
   * Context is available as 'this'
   */
  async init() {
    this.logger.info('[Test Plugin] Initializing server-side plugin...')
    this.logger.info('[Test Plugin] Plugin ID: ' + this.plugin.id)
    this.logger.info('[Test Plugin] Plugin Version: ' + this.plugin.version)

    // Plugin is now ready
    this.logger.info('[Test Plugin] Server-side initialization complete!')
  },

  /**
   * Plugin activation lifecycle hook
   * Called when plugin is activated
   */
  async activated() {
    this.logger.info('[Test Plugin] Plugin has been activated!')
  },

  /**
   * Plugin deactivation lifecycle hook
   * Called when plugin is deactivated
   */
  async deactivated() {
    this.logger.info('[Test Plugin] Plugin has been deactivated!')
  }
}
