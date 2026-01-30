/**
 * Auth After Login Hook - Hello World Plugin
 * Demonstrates the new auth:afterLogin hook from Phase 1
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  this.logger.info(`${this.config.greeting} - User logged in: ${data.user.email} from ${data.ip}`)

  return data
}
