/**
 * User Login Hook Handler
 */
module.exports = async function userLoginHook(hookData, context) {
  try {
    const { user, strategy } = hookData

    context.logger.info(`User logged in: ${user.name} via ${strategy}`)

    // Example: Track login count
    // You could store this in a database table, etc.

  } catch (err) {
    context.logger.error(`Error in user:login hook: ${err.message}`)
  }
}
