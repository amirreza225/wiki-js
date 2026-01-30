/**
 * Page Validation Hook
 * Demonstrates blocking hook that can prevent page save
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  const minLength = this.config.minContentLength || 50

  // Check content length
  if (data.page.content.length < minLength) {
    this.logger.warn(`Page validation failed: content too short (${data.page.content.length} < ${minLength})`)

    data.validationErrors.push(`Content must be at least ${minLength} characters long`)
    data.canProceed = false
    data.blockReason = `Content too short: ${data.page.content.length} characters (minimum: ${minLength})`
  } else {
    this.logger.info(`Page validation passed: ${data.page.title}`)
  }

  return data
}
