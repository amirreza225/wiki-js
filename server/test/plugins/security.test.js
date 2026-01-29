/**
 * Plugin Security System Tests
 *
 * Tests permission validation and enforcement
 */

const security = require('../../plugins/security')
const { createTestManifest } = require('../helpers/plugin-test-utils')

describe('plugins/security', () => {
  describe('Permission Constants', () => {
    it('exports all 16 permissions', () => {
      expect(security.PERMISSIONS).toBeDefined()
      expect(Object.keys(security.PERMISSIONS)).toHaveLength(16)
    })

    it('has config permissions', () => {
      expect(security.PERMISSIONS.CONFIG_READ).toBe('config:read')
      expect(security.PERMISSIONS.CONFIG_WRITE).toBe('config:write')
    })

    it('has database permissions', () => {
      expect(security.PERMISSIONS.DATABASE_READ).toBe('database:read')
      expect(security.PERMISSIONS.DATABASE_WRITE).toBe('database:write')
    })

    it('has events permissions', () => {
      expect(security.PERMISSIONS.EVENTS_EMIT).toBe('events:emit')
      expect(security.PERMISSIONS.EVENTS_LISTEN).toBe('events:listen')
    })

    it('has network permissions', () => {
      expect(security.PERMISSIONS.NETWORK_HTTP).toBe('network:http')
      expect(security.PERMISSIONS.NETWORK_EXTERNAL).toBe('network:external')
    })

    it('has storage permissions', () => {
      expect(security.PERMISSIONS.STORAGE_READ).toBe('storage:read')
      expect(security.PERMISSIONS.STORAGE_WRITE).toBe('storage:write')
    })

    it('has cache permissions', () => {
      expect(security.PERMISSIONS.CACHE_READ).toBe('cache:read')
      expect(security.PERMISSIONS.CACHE_WRITE).toBe('cache:write')
    })

    it('has UI permissions', () => {
      expect(security.PERMISSIONS.UI_COMPONENTS).toBe('ui:components')
      expect(security.PERMISSIONS.UI_PAGES).toBe('ui:pages')
    })

    it('has GraphQL permissions', () => {
      expect(security.PERMISSIONS.GRAPHQL_EXTEND).toBe('graphql:extend')
      expect(security.PERMISSIONS.GRAPHQL_QUERY).toBe('graphql:query')
    })
  })

  describe('validatePermission', () => {
    it('validates known permission', () => {
      expect(() => security.validatePermission('config:read')).not.toThrow()
      expect(() => security.validatePermission('database:write')).not.toThrow()
      expect(() => security.validatePermission('events:emit')).not.toThrow()
    })

    it('rejects unknown permission', () => {
      expect(() => security.validatePermission('invalid:permission'))
        .toThrow(/Unknown permission/)
    })

    it('rejects empty permission', () => {
      expect(() => security.validatePermission(''))
        .toThrow(/Unknown permission/)
    })

    it('rejects null permission', () => {
      expect(() => security.validatePermission(null))
        .toThrow(/Unknown permission/)
    })

    it('rejects undefined permission', () => {
      expect(() => security.validatePermission(undefined))
        .toThrow(/Unknown permission/)
    })

    it('is case-sensitive', () => {
      expect(() => security.validatePermission('CONFIG:READ'))
        .toThrow(/Unknown permission/)
    })
  })

  describe('checkPermission', () => {
    const plugin = {
      id: 'test-plugin',
      permissions: ['config:read', 'database:read', 'events:emit']
    }

    it('returns true for granted permission', () => {
      expect(security.checkPermission(plugin, 'config:read')).toBe(true)
      expect(security.checkPermission(plugin, 'database:read')).toBe(true)
      expect(security.checkPermission(plugin, 'events:emit')).toBe(true)
    })

    it('returns false for non-granted permission', () => {
      expect(security.checkPermission(plugin, 'config:write')).toBe(false)
      expect(security.checkPermission(plugin, 'database:write')).toBe(false)
      expect(security.checkPermission(plugin, 'network:http')).toBe(false)
    })

    it('returns false for null plugin', () => {
      expect(security.checkPermission(null, 'config:read')).toBe(false)
    })

    it('returns false for undefined plugin', () => {
      expect(security.checkPermission(undefined, 'config:read')).toBe(false)
    })

    it('returns false for plugin without permissions array', () => {
      const pluginNoPerms = { id: 'test' }
      expect(security.checkPermission(pluginNoPerms, 'config:read')).toBe(false)
    })

    it('returns false for empty permissions array', () => {
      const pluginEmpty = { id: 'test', permissions: [] }
      expect(security.checkPermission(pluginEmpty, 'config:read')).toBe(false)
    })
  })

  describe('enforcePermission', () => {
    const plugin = {
      id: 'test-plugin',
      permissions: ['config:read']
    }

    it('does not throw for granted permission', () => {
      expect(() => security.enforcePermission(plugin, 'config:read')).not.toThrow()
    })

    it('throws for non-granted permission', () => {
      expect(() => security.enforcePermission(plugin, 'config:write'))
        .toThrow(/does not have permission/)
      expect(() => security.enforcePermission(plugin, 'database:read'))
        .toThrow(/does not have permission/)
    })

    it('includes plugin ID in error message', () => {
      expect(() => security.enforcePermission(plugin, 'config:write'))
        .toThrow(/test-plugin/)
    })

    it('includes permission name in error message', () => {
      expect(() => security.enforcePermission(plugin, 'config:write'))
        .toThrow(/config:write/)
    })

    it('throws for null plugin', () => {
      expect(() => security.enforcePermission(null, 'config:read'))
        .toThrow(/does not have permission/)
    })
  })

  describe('validateManifestPermissions', () => {
    it('validates array of valid permissions', () => {
      const permissions = ['config:read', 'database:write', 'events:emit']
      expect(() => security.validateManifestPermissions(permissions)).not.toThrow()
    })

    it('validates empty array', () => {
      expect(() => security.validateManifestPermissions([])).not.toThrow()
    })

    it('rejects non-array', () => {
      expect(() => security.validateManifestPermissions('not-array'))
        .toThrow(/must be an array/)
    })

    it('rejects null', () => {
      expect(() => security.validateManifestPermissions(null))
        .toThrow(/must be an array/)
    })

    it('rejects object', () => {
      expect(() => security.validateManifestPermissions({ config: 'read' }))
        .toThrow(/must be an array/)
    })

    it('rejects array with invalid permissions', () => {
      const permissions = ['config:read', 'invalid:permission']
      expect(() => security.validateManifestPermissions(permissions))
        .toThrow(/Unknown permission/)
    })

    it('rejects array with non-string values', () => {
      const permissions = ['config:read', 123]
      expect(() => security.validateManifestPermissions(permissions))
        .toThrow(/Unknown permission/)
    })

    it('rejects duplicate permissions', () => {
      const permissions = ['config:read', 'config:read']
      expect(() => security.validateManifestPermissions(permissions))
        .toThrow(/Duplicate permission/)
    })
  })

  describe('getAllPermissions', () => {
    it('returns array of all permissions', () => {
      const permissions = security.getAllPermissions()
      expect(Array.isArray(permissions)).toBe(true)
      expect(permissions).toHaveLength(16)
    })

    it('includes all permission values', () => {
      const permissions = security.getAllPermissions()
      expect(permissions).toContain('config:read')
      expect(permissions).toContain('database:write')
      expect(permissions).toContain('events:emit')
      expect(permissions).toContain('network:http')
      expect(permissions).toContain('graphql:extend')
    })

    it('returns a new array each time', () => {
      const perms1 = security.getAllPermissions()
      const perms2 = security.getAllPermissions()
      expect(perms1).not.toBe(perms2)
      expect(perms1).toEqual(perms2)
    })
  })

  describe('getPermissionDescription', () => {
    it('returns description for valid permission', () => {
      const desc = security.getPermissionDescription('config:read')
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThan(0)
    })

    it('returns null for invalid permission', () => {
      const desc = security.getPermissionDescription('invalid:permission')
      expect(desc).toBeNull()
    })
  })
})
