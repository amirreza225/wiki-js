/**
 * Page Update Hook Handler
 *
 * This hook is triggered when an existing page is updated
 * Migrated to Phase 1 hook system (page:update)
 */

module.exports = async function (data) {
  this.logger.info('[Test Plugin] Page UPDATE hook triggered!')
  this.logger.info('[Test Plugin] Page ID: ' + data.page.id)
  this.logger.info('[Test Plugin] Page Title: ' + data.page.title)
  this.logger.info('[Test Plugin] Page Path: ' + data.page.path)
  this.logger.info('[Test Plugin] Modified by: ' + data.user.name)

  // New in page:update - access to previous version
  if (data.previousVersion) {
    const oldLength = data.previousVersion.content.length
    const newLength = data.page.content.length
    const change = newLength - oldLength

    this.logger.info(`[Test Plugin] Content change: ${change > 0 ? '+' : ''}${change} characters`)
    this.logger.info(`[Test Plugin] Previous update: ${data.previousVersion.updatedAt}`)
  }

  // You could do things like:
  // - Send notifications about page updates
  // - Track edit frequency
  // - Create change summaries
  // - Trigger review workflows
  // - Update search indexes

  return data
}
