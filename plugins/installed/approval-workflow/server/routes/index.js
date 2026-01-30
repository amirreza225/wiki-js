const express = require('express')
const router = express.Router()

/**
 * Get all approval requests
 */
router.get('/approvals', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query
    const Approval = req.pluginContext.db.pluginModels.Approval

    let query = Approval.query()
      .orderBy('requestedAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))

    if (status) {
      query = query.where('status', status)
    }

    const approvals = await query
    const total = await Approval.query().count('* as count').first()

    res.json({
      approvals,
      total: parseInt(total.count)
    })
  } catch (err) {
    req.pluginContext.logger.error(`Failed to fetch approvals: ${err.message}`)
    res.status(500).json({
      error: true,
      message: err.message
    })
  }
})

/**
 * Get a specific approval request
 */
router.get('/approvals/:id', async (req, res) => {
  try {
    const Approval = req.pluginContext.db.pluginModels.Approval
    const approval = await Approval.query().findById(req.params.id)

    if (!approval) {
      return res.status(404).json({
        error: true,
        message: 'Approval request not found'
      })
    }

    res.json({ approval })
  } catch (err) {
    req.pluginContext.logger.error(`Failed to fetch approval: ${err.message}`)
    res.status(500).json({
      error: true,
      message: err.message
    })
  }
})

/**
 * Approve a request
 */
router.post('/approvals/:id/approve', async (req, res) => {
  try {
    const Approval = req.pluginContext.db.pluginModels.Approval
    const approval = await Approval.query().findById(req.params.id)

    if (!approval) {
      return res.status(404).json({
        error: true,
        message: 'Approval request not found'
      })
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        error: true,
        message: 'Approval request has already been reviewed'
      })
    }

    // Get user info from request (would come from auth middleware in production)
    const userId = req.body.userId || 1
    const userName = req.body.userName || 'Administrator'
    const notes = req.body.notes || null

    const updatedApproval = await approval.approve(userId, userName, notes)

    req.pluginContext.logger.info(`Approval request ${approval.id} approved by ${userName}`)

    res.json({
      success: true,
      approval: updatedApproval
    })
  } catch (err) {
    req.pluginContext.logger.error(`Failed to approve request: ${err.message}`)
    res.status(500).json({
      error: true,
      message: err.message
    })
  }
})

/**
 * Reject a request
 */
router.post('/approvals/:id/reject', async (req, res) => {
  try {
    const Approval = req.pluginContext.db.pluginModels.Approval
    const approval = await Approval.query().findById(req.params.id)

    if (!approval) {
      return res.status(404).json({
        error: true,
        message: 'Approval request not found'
      })
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({
        error: true,
        message: 'Approval request has already been reviewed'
      })
    }

    const userId = req.body.userId || 1
    const userName = req.body.userName || 'Administrator'
    const notes = req.body.notes || null

    const updatedApproval = await approval.reject(userId, userName, notes)

    req.pluginContext.logger.info(`Approval request ${approval.id} rejected by ${userName}`)

    res.json({
      success: true,
      approval: updatedApproval
    })
  } catch (err) {
    req.pluginContext.logger.error(`Failed to reject request: ${err.message}`)
    res.status(500).json({
      error: true,
      message: err.message
    })
  }
})

/**
 * Get approval statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const Approval = req.pluginContext.db.pluginModels.Approval

    const [pending, approved, rejected, total] = await Promise.all([
      Approval.query().where('status', 'pending').count('* as count').first(),
      Approval.query().where('status', 'approved').count('* as count').first(),
      Approval.query().where('status', 'rejected').count('* as count').first(),
      Approval.query().count('* as count').first()
    ])

    res.json({
      stats: {
        pending: parseInt(pending.count),
        approved: parseInt(approved.count),
        rejected: parseInt(rejected.count),
        total: parseInt(total.count)
      }
    })
  } catch (err) {
    req.pluginContext.logger.error(`Failed to fetch stats: ${err.message}`)
    res.status(500).json({
      error: true,
      message: err.message
    })
  }
})

module.exports = router
