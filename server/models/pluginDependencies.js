const Model = require('objection').Model

/**
 * Plugin Dependencies model
 */
module.exports = class PluginDependency extends Model {
  static get tableName() { return 'pluginDependencies' }
}
