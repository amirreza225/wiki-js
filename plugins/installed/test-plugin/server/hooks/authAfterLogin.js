/**
 * Auth After Login Hook Handler
 *
 * This hook is triggered after a user successfully logs in
 * Migrated to Phase 1 hook system (auth:afterLogin)
 */

module.exports = async function (data) {
  this.logger.info('[Test Plugin] Auth AFTER LOGIN hook triggered!')
  this.logger.info('[Test Plugin] User: ' + data.user.name)
  this.logger.info('[Test Plugin] Email: ' + data.user.email)
  this.logger.info('[Test Plugin] Strategy: ' + data.strategy)
  this.logger.info('[Test Plugin] IP Address: ' + data.ip)
  this.logger.info('[Test Plugin] JWT Token: ' + data.jwt.substring(0, 20) + '...')

  // You could do things like:
  // - Track login events with IP address
  // - Send welcome notifications
  // - Update user statistics
  // - Trigger external integrations
  // - Log authentication for security audit
  // - Provision user resources on first login

  return data
}
