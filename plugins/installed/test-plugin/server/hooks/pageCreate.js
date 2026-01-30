/**
 * Page Create Hook Handler
 *
 * This hook is triggered when a new page is created
 * Migrated to Phase 1 hook system (page:create)
 */

module.exports = async function (data) {
  this.logger.info('[Test Plugin] Page CREATE hook triggered!')
  this.logger.info('[Test Plugin] Page ID: ' + data.page.id)
  this.logger.info('[Test Plugin] Page Title: ' + data.page.title)
  this.logger.info('[Test Plugin] Page Path: ' + data.page.path)
  this.logger.info('[Test Plugin] Created by: ' + data.user.name)
  this.logger.info('[Test Plugin] Content length: ' + data.page.content.length + ' characters')

  // You could do things like:
  // - Send notifications about new pages
  // - Update analytics for page creation
  // - Trigger external webhooks
  // - Create audit logs
  // - Initialize page metadata

  return data
}
