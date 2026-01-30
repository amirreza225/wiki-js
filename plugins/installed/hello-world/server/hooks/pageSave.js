/**
 * Page Save Hook Handler
 */
module.exports = async function pageSaveHook(hookData, context) {
  try {
    const { page, user, isNew } = hookData

    const action = isNew ? 'created' : 'updated'
    context.logger.info(`Page ${action}: "${page.title}" by ${user.name}`)

    // Example: You could send a notification, log to external service, etc.
  } catch (err) {
    context.logger.error(`Error in page:save hook: ${err.message}`)
  }
}
