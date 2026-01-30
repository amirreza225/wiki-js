/**
 * Page Create Hook - Approval Workflow
 *
 * Creates an approval request when a new page is created
 * Migrated to Phase 1 hook system (page:create)
 */
module.exports = async function (data) {
  try {
    const { page, user } = data

    // Get plugin configuration (context is 'this')
    const config = this.config || {}

    // Check if approval workflow is enabled
    if (!config.enabled) {
      this.logger.debug('Approval workflow is disabled, skipping')
      return data
    }

    // Check if new pages require approval
    if (!config.requireApprovalForNew) {
      this.logger.debug('New pages do not require approval, skipping')
      return data
    }

    // Auto-approve for admins if configured
    if (config.autoApproveAdmins && user.isAdmin) {
      this.logger.info(`Auto-approving new page by admin: ${user.name}`)
      return data
    }

    // Check if there's a path-specific setting
    const ApprovalSetting = this.db.pluginModels.ApprovalSetting
    const pathSetting = await ApprovalSetting.findForPath(page.path, page.localeCode)

    if (pathSetting) {
      if (!pathSetting.requireApproval) {
        this.logger.debug(`Path ${page.path} does not require approval`)
        return data
      }

      if (pathSetting.autoApprove) {
        this.logger.info(`Auto-approving new page for path: ${page.path}`)
        return data
      }
    }

    // Create approval request
    const Approval = this.db.pluginModels.Approval

    const approval = await Approval.query().insert({
      pageId: page.id,
      pagePath: page.path,
      pageTitle: page.title,
      requesterId: user.id,
      requesterName: user.name,
      requesterEmail: user.email,
      status: 'pending',
      isNew: true,
      changeDescription: `New page created: ${page.title}`
    })

    this.logger.info(`Created approval request #${approval.id} for NEW page ${page.id} by ${user.name}`)

    // Emit event for notification
    if (this.events) {
      this.events.emit('plugin:approval:created', {
        approvalId: approval.id,
        pageId: page.id,
        pageTitle: page.title,
        requesterName: user.name,
        isNew: true
      })
    }

    // Send notification to approvers if configured
    if (config.notifyApprovers && config.approverEmails) {
      const emails = config.approverEmails.split(',').map(e => e.trim()).filter(e => e)

      if (emails.length > 0) {
        this.logger.info(`Would notify approvers: ${emails.join(', ')}`)
        // In production, this would send actual emails
      }
    }

    return data
  } catch (err) {
    this.logger.error(`Error in page create hook: ${err.message}`)
    // Don't throw - we don't want to block page saving if approval creation fails
    return data
  }
}
