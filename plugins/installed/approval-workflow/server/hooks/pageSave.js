/**
 * Page Save Hook
 *
 * Creates an approval request when a page is saved
 */
module.exports = async function pageSaveHook(hookData, context) {
  try {
    const { page, user, isNew } = hookData

    // Get plugin configuration
    const config = context.plugin.config || {}

    // Check if approval workflow is enabled
    if (!config.enabled) {
      context.logger.debug('Approval workflow is disabled, skipping')
      return
    }

    // Check if this type of change requires approval
    if (isNew && !config.requireApprovalForNew) {
      context.logger.debug('New pages do not require approval, skipping')
      return
    }

    if (!isNew && !config.requireApprovalForEdit) {
      context.logger.debug('Page edits do not require approval, skipping')
      return
    }

    // Auto-approve for admins if configured
    if (config.autoApproveAdmins && user.isAdmin) {
      context.logger.info(`Auto-approving change by admin: ${user.name}`)
      return
    }

    // Check if there's a path-specific setting
    const ApprovalSetting = context.db.pluginModels.ApprovalSetting
    const pathSetting = await ApprovalSetting.findForPath(page.path, page.localeCode)

    if (pathSetting) {
      if (!pathSetting.requireApproval) {
        context.logger.debug(`Path ${page.path} does not require approval`)
        return
      }

      if (pathSetting.autoApprove) {
        context.logger.info(`Auto-approving change for path: ${page.path}`)
        return
      }
    }

    // Create approval request
    const Approval = context.db.pluginModels.Approval

    const approval = await Approval.query().insert({
      pageId: page.id,
      pagePath: page.path,
      pageTitle: page.title,
      requesterId: user.id,
      requesterName: user.name,
      requesterEmail: user.email,
      status: 'pending',
      isNew,
      changeDescription: isNew
        ? `New page created: ${page.title}`
        : `Page updated: ${page.title}`
    })

    context.logger.info(`Created approval request #${approval.id} for page ${page.id} by ${user.name}`)

    // Emit event for notification (if notifications module exists)
    if (context.events) {
      context.events.emit('plugin:approval:created', {
        approvalId: approval.id,
        pageId: page.id,
        pageTitle: page.title,
        requesterName: user.name
      })
    }

    // Send notification to approvers if configured
    if (config.notifyApprovers && config.approverEmails) {
      const emails = config.approverEmails.split(',').map(e => e.trim()).filter(e => e)

      if (emails.length > 0) {
        context.logger.info(`Would notify approvers: ${emails.join(', ')}`)
        // In production, this would send actual emails
        // For demo, we just log
      }
    }
  } catch (err) {
    context.logger.error(`Error in page save hook: ${err.message}`)
    // Don't throw - we don't want to block page saving if approval creation fails
  }
}
