const { Model } = require('objection')

/**
 * Approval Request Model
 *
 * Stores approval requests for page changes
 */
class Approval extends Model {
  static get tableName() {
    return 'plugin_approval-workflow_requests'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['pageId', 'requesterId', 'status'],

      properties: {
        id: { type: 'integer' },
        pageId: { type: 'integer' },
        pagePath: { type: 'string' },
        pageTitle: { type: 'string' },
        requesterId: { type: 'integer' },
        requesterName: { type: 'string' },
        requesterEmail: { type: 'string' },
        approverId: { type: ['integer', 'null'] },
        approverName: { type: ['string', 'null'] },
        status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
        isNew: { type: 'boolean' },
        changeDescription: { type: 'string' },
        approverNotes: { type: ['string', 'null'] },
        requestedAt: { type: 'string' },
        reviewedAt: { type: ['string', 'null'] }
      }
    }
  }

  $beforeInsert() {
    this.requestedAt = new Date().toISOString()
  }

  $beforeUpdate() {
    if (this.status !== 'pending') {
      this.reviewedAt = new Date().toISOString()
    }
  }

  /**
   * Approve this request
   */
  async approve(approverId, approverName, notes = null) {
    return this.$query().patchAndFetch({
      status: 'approved',
      approverId,
      approverName,
      approverNotes: notes,
      reviewedAt: new Date().toISOString()
    })
  }

  /**
   * Reject this request
   */
  async reject(approverId, approverName, notes = null) {
    return this.$query().patchAndFetch({
      status: 'rejected',
      approverId,
      approverName,
      approverNotes: notes,
      reviewedAt: new Date().toISOString()
    })
  }
}

module.exports = Approval
