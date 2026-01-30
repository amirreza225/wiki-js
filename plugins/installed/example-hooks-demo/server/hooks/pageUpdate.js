/**
 * Page Update Hook
 * Triggered after a page is updated
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  this.logger.info(`Page updated: ${data.page.title} (${data.page.path}) by ${data.user.email}`)

  // Example: Track changes or trigger workflows
  if (data.previousVersion) {
    const contentChanged = data.previousVersion.content !== data.page.content
    this.logger.debug(`Content changed: ${contentChanged}`)
  }

  return data
}
