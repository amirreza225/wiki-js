/**
 * Approval Workflow GraphQL Resolvers
 */

module.exports = {
  Query: {
    /**
     * Get approval requests
     */
    async approvalRequests(obj, args, context) {
      const { status, limit = 50, offset = 0 } = args

      // Access plugin models through WIKI.plugins.modelLoader
      const Approval = WIKI.plugins.modelLoader.getPluginModelsObject('approval-workflow').Approval

      let query = Approval.query()
        .orderBy('requestedAt', 'desc')
        .limit(limit)
        .offset(offset)

      if (status) {
        query = query.where('status', status)
      }

      const approvals = await query
      const totalResult = await Approval.query().count('* as count').first()

      return {
        approvals,
        total: parseInt(totalResult.count)
      }
    },

    /**
     * Get a specific approval request
     */
    async approvalRequest(obj, args, context) {
      const Approval = WIKI.plugins.modelLoader.getPluginModelsObject('approval-workflow').Approval
      return Approval.query().findById(args.id)
    },

    /**
     * Get approval statistics
     */
    async approvalStats(obj, args, context) {
      const Approval = WIKI.plugins.modelLoader.getPluginModelsObject('approval-workflow').Approval

      const [pending, approved, rejected, total] = await Promise.all([
        Approval.query().where('status', 'pending').count('* as count').first(),
        Approval.query().where('status', 'approved').count('* as count').first(),
        Approval.query().where('status', 'rejected').count('* as count').first(),
        Approval.query().count('* as count').first()
      ])

      return {
        pending: parseInt(pending.count),
        approved: parseInt(approved.count),
        rejected: parseInt(rejected.count),
        total: parseInt(total.count)
      }
    }
  },

  Mutation: {
    /**
     * Approve a request
     */
    async approveRequest(obj, args, context) {
      try {
        const Approval = WIKI.plugins.modelLoader.getPluginModelsObject('approval-workflow').Approval
        const approval = await Approval.query().findById(args.id)

        if (!approval) {
          return {
            responseResult: {
              succeeded: false,
              errorCode: 1,
              slug: 'approval-not-found',
              message: 'Approval request not found'
            }
          }
        }

        if (approval.status !== 'pending') {
          return {
            responseResult: {
              succeeded: false,
              errorCode: 2,
              slug: 'approval-already-reviewed',
              message: 'Approval request has already been reviewed'
            }
          }
        }

        // Get user from context
        const userId = context.req.user?.id || 1
        const userName = context.req.user?.name || 'Administrator'

        const updatedApproval = await approval.approve(userId, userName, args.notes)

        WIKI.logger.info(`[Plugin:approval-workflow] Approval ${args.id} approved by ${userName}`)

        return {
          responseResult: {
            succeeded: true,
            errorCode: 0,
            slug: 'approval-approved',
            message: 'Approval request approved successfully'
          },
          approval: updatedApproval
        }
      } catch (err) {
        WIKI.logger.error(`[Plugin:approval-workflow] Failed to approve request: ${err.message}`)
        return {
          responseResult: {
            succeeded: false,
            errorCode: 3,
            slug: 'approval-error',
            message: err.message
          }
        }
      }
    },

    /**
     * Reject a request
     */
    async rejectRequest(obj, args, context) {
      try {
        const Approval = WIKI.plugins.modelLoader.getPluginModelsObject('approval-workflow').Approval
        const approval = await Approval.query().findById(args.id)

        if (!approval) {
          return {
            responseResult: {
              succeeded: false,
              errorCode: 1,
              slug: 'approval-not-found',
              message: 'Approval request not found'
            }
          }
        }

        if (approval.status !== 'pending') {
          return {
            responseResult: {
              succeeded: false,
              errorCode: 2,
              slug: 'approval-already-reviewed',
              message: 'Approval request has already been reviewed'
            }
          }
        }

        const userId = context.req.user?.id || 1
        const userName = context.req.user?.name || 'Administrator'

        const updatedApproval = await approval.reject(userId, userName, args.notes)

        WIKI.logger.info(`[Plugin:approval-workflow] Approval ${args.id} rejected by ${userName}`)

        return {
          responseResult: {
            succeeded: true,
            errorCode: 0,
            slug: 'approval-rejected',
            message: 'Approval request rejected successfully'
          },
          approval: updatedApproval
        }
      } catch (err) {
        WIKI.logger.error(`[Plugin:approval-workflow] Failed to reject request: ${err.message}`)
        return {
          responseResult: {
            succeeded: false,
            errorCode: 3,
            slug: 'approval-error',
            message: err.message
          }
        }
      }
    }
  }
}
