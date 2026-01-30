/**
 * User Login Hook Handler
 *
 * This hook is triggered whenever a user logs in
 * Hook handlers receive data as a parameter, context is bound as 'this'
 */

module.exports = async function(data) {
  this.logger.info('[Test Plugin] User login hook triggered!')
  this.logger.info('[Test Plugin] User: ' + data.user.name)
  this.logger.info('[Test Plugin] Email: ' + data.user.email)
  this.logger.info('[Test Plugin] Strategy: ' + data.strategy)

  // You could do things like:
  // - Track login events
  // - Send welcome notifications
  // - Update user statistics
  // - Trigger external integrations
}
