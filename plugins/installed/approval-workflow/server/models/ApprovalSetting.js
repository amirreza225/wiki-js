const { Model } = require('objection')

/**
 * Approval Settings Model
 *
 * Stores per-page or per-path approval settings
 */
class ApprovalSetting extends Model {
  static get tableName() {
    return 'plugin_approval-workflow_settings'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['pathPattern', 'requireApproval'],

      properties: {
        id: { type: 'integer' },
        pathPattern: { type: 'string' },
        locale: { type: 'string' },
        requireApproval: { type: 'boolean' },
        autoApprove: { type: 'boolean' },
        approverUserIds: { type: 'array' },
        approverGroupIds: { type: 'array' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
      }
    }
  }

  static get jsonAttributes() {
    return ['approverUserIds', 'approverGroupIds']
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Check if a path matches this setting's pattern
   */
  matchesPath(path) {
    // Simple wildcard matching (* = any characters)
    const pattern = this.pathPattern.replace(/\*/g, '.*')
    const regex = new RegExp(`^${pattern}$`)
    return regex.test(path)
  }

  /**
   * Find setting for a specific path
   */
  static async findForPath(path, locale = 'en') {
    const settings = await this.query().where({ locale })

    for (const setting of settings) {
      if (setting.matchesPath(path)) {
        return setting
      }
    }

    return null
  }
}

module.exports = ApprovalSetting
