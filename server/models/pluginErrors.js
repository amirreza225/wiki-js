const Model = require('objection').Model

/**
 * Plugin Logs model (formerly Plugin Errors)
 * Stores all plugin logs including debug, info, warn, and error levels
 */
module.exports = class PluginError extends Model {
  static get tableName() { return 'pluginErrors' }

  /**
   * Log levels
   */
  static get LogLevels() {
    return {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error'
    }
  }

  /**
   * Create a log entry
   */
  static async log(pluginId, level, message, context = null, stackTrace = null) {
    try {
      return await this.query().insert({
        pluginId,
        level,
        message,
        context: context || level,
        stackTrace,
        createdAt: new Date().toISOString(),
        resolved: false
      })
    } catch (err) {
      // Fail silently if database logging fails (e.g., if migration hasn't run yet)
      // The console logger will still work
      console.warn(`[Plugin Log] Failed to log to database: ${err.message}`)
      return null
    }
  }
}
