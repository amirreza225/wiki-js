/**
 * Auth After Login Hook
 * Triggered after successful authentication
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  if (this.config.logAuthentication) {
    this.logger.info(`Successful login: ${data.user.email} from ${data.ip} via ${data.strategy}`)
  }

  // Example: Log to audit trail, sync with external systems, etc.

  return data
}
