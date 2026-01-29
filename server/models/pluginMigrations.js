const Model = require('objection').Model

/**
 * Plugin Migrations model
 */
module.exports = class PluginMigration extends Model {
  static get tableName() { return 'pluginMigrations' }
}
