/**
 * Plugin Security Module
 * Defines and validates permissions for the plugin system
 */

const PERMISSIONS = {
  'config:read': 'Read plugin configuration',
  'config:write': 'Write plugin configuration',
  'database:read': 'Read from database',
  'database:write': 'Write to database',
  'database:core': 'Access core database models',
  'api:extend': 'Register API routes',
  'graphql:extend': 'Extend GraphQL schema',
  'ui:extend': 'Add UI components',
  'events:emit': 'Emit events',
  'events:listen': 'Listen to events',
  'cache:read': 'Read from cache',
  'cache:write': 'Write to cache',
  'filesystem:read': 'Read files',
  'filesystem:write': 'Write files',
  'core:read': 'Read-only access to WIKI object',
  'network:request': 'Make HTTP requests'
}

module.exports = {
  PERMISSIONS,

  /**
   * Validate that a permission is recognized
   * @param {string} permission - Permission identifier
   * @throws {Error} If permission is not recognized
   */
  validatePermission(permission) {
    if (!PERMISSIONS[permission]) {
      throw new Error(`Unknown permission: ${permission}`)
    }
  },

  /**
   * Check if plugin has a specific permission
   * @param {Object} plugin - Plugin object from database
   * @param {string} permission - Permission to check
   * @returns {boolean} True if plugin has permission
   */
  checkPermission(plugin, permission) {
    if (!plugin || !plugin.permissions) {
      return false
    }
    return plugin.permissions.includes(permission)
  },

  /**
   * Enforce that plugin has a specific permission
   * @param {Object} plugin - Plugin object from database
   * @param {string} permission - Permission to enforce
   * @throws {Error} If plugin does not have permission
   */
  async enforcePermission(plugin, permission) {
    if (!this.checkPermission(plugin, permission)) {
      const error = new Error(`Plugin ${plugin.id} does not have permission: ${permission}`)

      // Log to plugin errors table
      try {
        await WIKI.models.pluginErrors.query().insert({
          pluginId: plugin.id,
          errorType: 'permission_denied',
          errorMessage: error.message,
          stackTrace: error.stack,
          createdAt: new Date().toISOString(),
          resolved: false
        })
      } catch (logError) {
        WIKI.logger.warn(`Failed to log permission error for plugin ${plugin.id}: ${logError.message}`)
      }

      throw error
    }
  },

  /**
   * Validate all permissions in a plugin manifest
   * @param {Array<string>} permissions - Array of permission identifiers
   * @throws {Error} If any permission is invalid
   */
  validateManifestPermissions(permissions) {
    if (!Array.isArray(permissions)) {
      throw new Error('Permissions must be an array')
    }

    for (const permission of permissions) {
      this.validatePermission(permission)
    }
  }
}
