/**
 * Plugin Security System Tests
 *
 * Tests permission validation and enforcement
 */

const security = require('../../plugins/security')
const { createMockWIKI } = require('../helpers/plugin-test-utils')

// Setup global WIKI
global.WIKI = createMockWIKI()

describe('plugins/security', () => {
  describe('Permission Constants', () => {
    it('exports all 16 permissions', () => {
      expect(security.PERMISSIONS).toBeDefined()
      expect(Object.keys(security.PERMISSIONS)).toHaveLength(16)
    })

    it('has config permissions', () => {
      expect(security.PERMISSIONS['config:read']).toBe('Read plugin configuration')
      expect(security.PERMISSIONS['config:write']).toBe('Write plugin configuration')
    })

    it('has database permissions', () => {
      expect(security.PERMISSIONS['database:read']).toBe('Read from database')
      expect(security.PERMISSIONS['database:write']).toBe('Write to database')
    })

    it('has events permissions', () => {
      expect(security.PERMISSIONS['events:emit']).toBe('Emit events')
      expect(security.PERMISSIONS['events:listen']).toBe('Listen to events')
    })

    it('has cache permissions', () => {
      expect(security.PERMISSIONS['cache:read']).toBe('Read from cache')
      expect(security.PERMISSIONS['cache:write']).toBe('Write to cache')
    })

    it('has filesystem permissions', () => {
      expect(security.PERMISSIONS['filesystem:read']).toBe('Read files')
      expect(security.PERMISSIONS['filesystem:write']).toBe('Write files')
    })

    it('has GraphQL permissions', () => {
      expect(security.PERMISSIONS['graphql:extend']).toBe('Extend GraphQL schema')
    })

    it('has UI permissions', () => {
      expect(security.PERMISSIONS['ui:extend']).toBe('Add UI components')
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

    beforeEach(() => {
      // Mock the database insert for error logging
      const mockInsert = jest.fn().mockResolvedValue(undefined)
      WIKI.models.pluginErrors.query = jest.fn(() => ({
        insert: mockInsert
      }))
    })

    it('does not throw for granted permission', async () => {
      await expect(security.enforcePermission(plugin, 'config:read')).resolves.not.toThrow()
    })

    it('throws for config:write when not granted', async () => {
      await expect(security.enforcePermission(plugin, 'config:write'))
        .rejects.toThrow(/does not have permission/)
    })

    it('throws for database:read when not granted', async () => {
      await expect(security.enforcePermission(plugin, 'database:read'))
        .rejects.toThrow(/does not have permission/)
    })

    it('includes plugin ID in error message', async () => {
      try {
        await security.enforcePermission(plugin, 'config:write')
        throw new Error('Should have thrown')
      } catch (error) {
        expect(error.message).toContain('test-plugin')
      }
    })

    it('includes permission name in error message', async () => {
      try {
        await security.enforcePermission(plugin, 'config:write')
        throw new Error('Should have thrown')
      } catch (error) {
        expect(error.message).toContain('config:write')
      }
    })

    it('throws for null plugin', async () => {
      await expect(security.enforcePermission(null, 'config:read'))
        .rejects.toThrow()
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
  })

  describe('getAllPermissions', () => {
    it('returns array of all permission keys', () => {
      const permissions = Object.keys(security.PERMISSIONS)
      expect(Array.isArray(permissions)).toBe(true)
      expect(permissions).toHaveLength(16)
    })

    it('includes all permission values', () => {
      const permissions = Object.keys(security.PERMISSIONS)
      expect(permissions).toContain('config:read')
      expect(permissions).toContain('database:write')
      expect(permissions).toContain('events:emit')
      expect(permissions).toContain('graphql:extend')
    })
  })

  describe('getPermissionDescription', () => {
    it('returns description for valid permission', () => {
      const desc = security.PERMISSIONS['config:read']
      expect(typeof desc).toBe('string')
      expect(desc).toBe('Read plugin configuration')
    })

    it('returns undefined for invalid permission', () => {
      const desc = security.PERMISSIONS['invalid:permission']
      expect(desc).toBeUndefined()
    })
  })
})
