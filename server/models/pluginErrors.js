const Model = require('objection').Model

/**
 * Plugin Errors model
 */
module.exports = class PluginError extends Model {
  static get tableName() { return 'pluginErrors' }
}
