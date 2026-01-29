/**
 * Hello World Plugin
 * Example plugin demonstrating the Wiki.js plugin system
 */

module.exports = {
  /**
   * Initialize plugin
   * Called once when plugin is activated
   */
  async init() {
    const greeting = this.config.get('greeting') || 'Hello, World!'
    this.logger.info(`Plugin initialized with greeting: ${greeting}`)
    this.logger.info(`Wiki.js version: ${this.WIKI.version}`)
  },

  /**
   * Activation lifecycle hook
   */
  async activated() {
    this.logger.info('Hello World plugin has been activated!')
  },

  /**
   * Deactivation lifecycle hook
   */
  async deactivated() {
    this.logger.info('Hello World plugin has been deactivated!')
  },

  /**
   * Lifecycle hooks
   */
  hooks: {
    /**
     * Page save hook
     * Triggered when a page is saved
     */
    'page:save': async function(data) {
      const { page, user } = data
      this.logger.info(`[Hook:page:save] Page "${page.title}" (ID: ${page.id}) saved by user ${user.name}`)
    },

    /**
     * User login hook
     * Triggered when a user logs in
     */
    'user:login': async function(data) {
      const { user } = data
      const greeting = this.config.get('greeting') || 'Hello, World!'
      this.logger.info(`[Hook:user:login] ${greeting} User ${user.name} has logged in!`)
    }
  }
}
