/**
 * Page Create Hook
 * Triggered after a page is created
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  this.logger.info(`New page created: ${data.page.title} (${data.page.path}) by ${data.user.email}`)

  // Example: Log to database or send notification
  // You could integrate with external services here

  return data
}
