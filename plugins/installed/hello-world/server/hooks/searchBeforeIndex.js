/**
 * Search Before Index Hook - Hello World Plugin
 * Demonstrates the new search:beforeIndex hook from Phase 1
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  this.logger.info(`${this.config.greeting} - Indexing page: ${data.page.title} (${data.page.safeContent.length} characters)`)

  return data
}
