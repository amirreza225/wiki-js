/**
 * Page Save Hook Handler
 *
 * This hook is triggered whenever a page is saved
 * Hook handlers receive data as a parameter, context is bound as 'this'
 */

module.exports = async function(data) {
  this.logger.info('[Test Plugin] Page save hook triggered!')
  this.logger.info('[Test Plugin] Page ID: ' + data.page.id)
  this.logger.info('[Test Plugin] Page Title: ' + data.page.title)
  this.logger.info('[Test Plugin] Is New: ' + data.isNew)
  this.logger.info('[Test Plugin] Modified by: ' + data.user.name)

  // You could do things like:
  // - Send notifications
  // - Update analytics
  // - Trigger external webhooks
  // - Create audit logs
}
