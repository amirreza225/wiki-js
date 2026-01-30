/**
 * Page Update Hook - Hello World Plugin
 * Demonstrates the new page:update hook from Phase 1
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  this.logger.info(`${this.config.greeting} - Page updated: ${data.page.title} by ${data.user.email}`)

  if (data.previousVersion) {
    this.logger.debug(`Content changed from ${data.previousVersion.content.length} to ${data.page.content.length} characters`)
  }

  return data
}
