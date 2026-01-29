const Model = require('objection').Model

/**
 * Plugin Permissions model
 */
module.exports = class PluginPermission extends Model {
  static get tableName() { return 'pluginPermissions' }
}
