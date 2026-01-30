/**
 * Example Hooks Demo Plugin
 * Demonstrates all Phase 1 hook system capabilities
 */

module.exports = {
  /**
   * Plugin initialization
   * Called when plugin is loaded
   */
  async init() {
    this.logger.info('Example Hooks Demo plugin initialized')
    this.logger.info(`Plugin enabled: ${this.plugin.config.enabled}`)
    this.logger.info(`Min content length: ${this.plugin.config.minContentLength}`)
    this.logger.info(`Log authentication: ${this.plugin.config.logAuthentication}`)
  },

  /**
   * Plugin activation
   * Called when plugin is activated
   */
  async activated() {
    this.logger.info('Example Hooks Demo plugin activated')
    this.logger.info('Hooks registered:')
    this.logger.info('  - page:validate (blocking)')
    this.logger.info('  - page:create')
    this.logger.info('  - page:update')
    this.logger.info('  - search:beforeIndex')
    this.logger.info('  - auth:beforeLogin (blocking)')
    this.logger.info('  - auth:afterLogin')
  },

  /**
   * Plugin deactivation
   * Called when plugin is deactivated
   */
  async deactivated() {
    this.logger.info('Example Hooks Demo plugin deactivated')
  },

  /**
   * Plugin shutdown
   * Called when Wiki.js is shutting down
   */
  async shutdown() {
    this.logger.info('Example Hooks Demo plugin shutting down')
  }
}
