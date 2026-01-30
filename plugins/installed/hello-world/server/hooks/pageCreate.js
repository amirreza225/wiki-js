/**
 * Page Create Hook - Hello World Plugin
 * Demonstrates the new page:create hook from Phase 1
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  this.logger.info(`${this.config.greeting} - New page created: ${data.page.title} by ${data.user.email}`)

  return data
}
