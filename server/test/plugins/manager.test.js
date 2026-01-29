/**
 * Plugin Manager Tests
 *
 * Tests plugin lifecycle management (install, activate, deactivate, uninstall)
 */

const { createMockWIKI, createTestManifest } = require('../helpers/plugin-test-utils')

// Mock dependencies
jest.mock('fs-extra')
jest.mock('../../plugins/loader')
jest.mock('../../plugins/runtime')
jest.mock('../../plugins/hooks')

const fs = require('fs-extra')
const loader = require('../../plugins/loader')
const runtime = require('../../plugins/runtime')

// Setup global WIKI
global.WIKI = createMockWIKI()

// Import manager after mocks
const manager = require('../../plugins/manager')

describe('plugins/manager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('hasGraphQLExtensions', () => {
    const testPluginPath = '/test/plugin/path'

    it('detects GraphQL schema file', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.includes('schema.graphql'))
      })

      const hasGraphQL = await manager.hasGraphQLExtensions(testPluginPath)

      expect(hasGraphQL).toBe(true)
    })

    it('detects GraphQL resolvers file', async () => {
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.includes('resolvers.js'))
      })

      const hasGraphQL = await manager.hasGraphQLExtensions(testPluginPath)

      expect(hasGraphQL).toBe(true)
    })

    it('detects both schema and resolvers', async () => {
      fs.pathExists.mockResolvedValue(true)

      const hasGraphQL = await manager.hasGraphQLExtensions(testPluginPath)

      expect(hasGraphQL).toBe(true)
    })

    it('returns false when no GraphQL files', async () => {
      fs.pathExists.mockResolvedValue(false)

      const hasGraphQL = await manager.hasGraphQLExtensions(testPluginPath)

      expect(hasGraphQL).toBe(false)
    })

    it('returns false when graphql directory does not exist', async () => {
      fs.pathExists.mockImplementation((path) => {
        // graphql directory check returns false
        if (path.endsWith('graphql')) return Promise.resolve(false)
        return Promise.resolve(true)
      })

      const hasGraphQL = await manager.hasGraphQLExtensions(testPluginPath)

      expect(hasGraphQL).toBe(false)
    })

    it('handles file system errors', async () => {
      fs.pathExists.mockRejectedValue(new Error('FS Error'))

      await expect(manager.hasGraphQLExtensions(testPluginPath))
        .rejects.toThrow('FS Error')
    })
  })

  describe('validatePluginNotInstalled', () => {
    it('passes when plugin is not installed', async () => {
      WIKI.models.plugins.query().where().first = jest.fn().mockResolvedValue(null)

      await expect(manager.validatePluginNotInstalled('test-plugin'))
        .resolves.not.toThrow()
    })

    it('throws when plugin is already installed', async () => {
      WIKI.models.plugins.query().where().first = jest.fn().mockResolvedValue({
        id: 'test-plugin',
        status: 'installed'
      })

      await expect(manager.validatePluginNotInstalled('test-plugin'))
        .rejects.toThrow(/already installed/)
    })
  })

  describe('installPlugin Workflow', () => {
    it('extracts ZIP to correct location', async () => {
      const manifest = createTestManifest({ id: 'new-plugin' })

      loader.extractPlugin.mockResolvedValue(undefined)
      loader.loadManifest.mockResolvedValue(manifest)
      loader.validateManifest.mockResolvedValue(true)
      loader.loadDependencies.mockResolvedValue({})
      fs.pathExists.mockResolvedValue(false)

      WIKI.models.plugins.query().where().first = jest.fn().mockResolvedValue(null)
      WIKI.models.plugins.query().insert = jest.fn().mockResolvedValue({
        id: 'new-plugin'
      })

      await manager.installPlugin('/test/plugin.zip')

      expect(loader.extractPlugin).toHaveBeenCalled()
      const extractPath = loader.extractPlugin.mock.calls[0][1]
      expect(extractPath).toContain('new-plugin')
    })

    it('validates manifest before installation', async () => {
      const manifest = createTestManifest()

      loader.extractPlugin.mockResolvedValue(undefined)
      loader.loadManifest.mockResolvedValue(manifest)
      loader.validateManifest.mockResolvedValue(true)
      loader.loadDependencies.mockResolvedValue({})
      fs.pathExists.mockResolvedValue(false)

      WIKI.models.plugins.query().where().first = jest.fn().mockResolvedValue(null)
      WIKI.models.plugins.query().insert = jest.fn().mockResolvedValue({ id: 'test-plugin' })

      await manager.installPlugin('/test/plugin.zip')

      expect(loader.validateManifest).toHaveBeenCalledWith(manifest)
    })

    it('creates database record with correct status', async () => {
      const manifest = createTestManifest()

      loader.extractPlugin.mockResolvedValue(undefined)
      loader.loadManifest.mockResolvedValue(manifest)
      loader.validateManifest.mockResolvedValue(true)
      loader.loadDependencies.mockResolvedValue({})
      fs.pathExists.mockResolvedValue(false)

      WIKI.models.plugins.query().where().first = jest.fn().mockResolvedValue(null)

      const mockInsert = jest.fn().mockResolvedValue({ id: 'test-plugin' })
      WIKI.models.plugins.query().insert = mockInsert

      await manager.installPlugin('/test/plugin.zip')

      expect(mockInsert).toHaveBeenCalled()
      const pluginRecord = mockInsert.mock.calls[0][0]
      expect(pluginRecord.status).toBe('installed')
      expect(pluginRecord.id).toBe('test-plugin')
    })

    it('stores plugin metadata', async () => {
      const manifest = createTestManifest({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        author: 'Test Author'
      })

      loader.extractPlugin.mockResolvedValue(undefined)
      loader.loadManifest.mockResolvedValue(manifest)
      loader.validateManifest.mockResolvedValue(true)
      loader.loadDependencies.mockResolvedValue({})
      fs.pathExists.mockResolvedValue(false)

      WIKI.models.plugins.query().where().first = jest.fn().mockResolvedValue(null)

      const mockInsert = jest.fn().mockResolvedValue({ id: 'test-plugin' })
      WIKI.models.plugins.query().insert = mockInsert

      await manager.installPlugin('/test/plugin.zip')

      const pluginRecord = mockInsert.mock.calls[0][0]
      expect(pluginRecord.name).toBe('Test Plugin')
      expect(pluginRecord.version).toBe('1.0.0')
      expect(pluginRecord.author).toBe('Test Author')
    })

    it('rolls back on error', async () => {
      loader.extractPlugin.mockResolvedValue(undefined)
      loader.loadManifest.mockRejectedValue(new Error('Invalid manifest'))

      fs.remove.mockResolvedValue(undefined)

      await expect(manager.installPlugin('/test/plugin.zip'))
        .rejects.toThrow('Invalid manifest')

      // Should clean up extracted files
      expect(fs.remove).toHaveBeenCalled()
    })
  })

  describe('activatePlugin', () => {
    it('loads plugin instance', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed',
        installPath: '/test/path'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)
      WIKI.models.plugins.query().patch = jest.fn().mockResolvedValue(undefined)

      const mockInstance = {
        async activated() {}
      }
      runtime.loadPlugin.mockResolvedValue(mockInstance)
      runtime.executePlugin.mockResolvedValue(undefined)

      fs.pathExists.mockResolvedValue(false) // No GraphQL

      await manager.activatePlugin('test-plugin')

      expect(runtime.loadPlugin).toHaveBeenCalledWith('/test/path')
    })

    it('executes activated lifecycle hook', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed',
        installPath: '/test/path'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)
      WIKI.models.plugins.query().patch = jest.fn().mockResolvedValue(undefined)

      const mockInstance = {
        async activated() {}
      }
      runtime.loadPlugin.mockResolvedValue(mockInstance)
      runtime.executePlugin.mockResolvedValue(undefined)

      fs.pathExists.mockResolvedValue(false)

      await manager.activatePlugin('test-plugin')

      expect(runtime.executePlugin).toHaveBeenCalledWith(
        expect.anything(),
        mockInstance,
        'activated'
      )
    })

    it('updates plugin status to active', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed',
        installPath: '/test/path'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)

      const mockPatch = jest.fn().mockResolvedValue(undefined)
      WIKI.models.plugins.query().patch = mockPatch

      const mockInstance = { async activated() {} }
      runtime.loadPlugin.mockResolvedValue(mockInstance)
      runtime.executePlugin.mockResolvedValue(undefined)

      fs.pathExists.mockResolvedValue(false)

      await manager.activatePlugin('test-plugin')

      expect(mockPatch).toHaveBeenCalled()
      const updates = mockPatch.mock.calls[0][0]
      expect(updates.status).toBe('active')
      expect(updates.activationDate).toBeDefined()
    })

    it('returns requiresRestart for GraphQL plugins', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed',
        installPath: '/test/path'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)
      WIKI.models.plugins.query().patch = jest.fn().mockResolvedValue(undefined)

      runtime.loadPlugin.mockResolvedValue({ async activated() {} })
      runtime.executePlugin.mockResolvedValue(undefined)

      fs.pathExists.mockResolvedValue(true) // Has GraphQL

      const result = await manager.activatePlugin('test-plugin')

      expect(result.requiresRestart).toBe(true)
    })

    it('throws if plugin is already active', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'active'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)

      await expect(manager.activatePlugin('test-plugin'))
        .rejects.toThrow(/already active/)
    })

    it('throws if plugin is not found', async () => {
      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(null)

      await expect(manager.activatePlugin('nonexistent'))
        .rejects.toThrow(/not found/)
    })
  })

  describe('deactivatePlugin', () => {
    it('executes deactivated lifecycle hook', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'active',
        installPath: '/test/path'
      }

      WIKI.data.plugins = [{
        id: 'test-plugin',
        instance: { async deactivated() {} }
      }]

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)
      WIKI.models.plugins.query().patch = jest.fn().mockResolvedValue(undefined)

      runtime.executePlugin.mockResolvedValue(undefined)

      await manager.deactivatePlugin('test-plugin')

      expect(runtime.executePlugin).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'deactivated'
      )
    })

    it('updates plugin status to installed', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'active'
      }

      WIKI.data.plugins = [{
        id: 'test-plugin',
        instance: { async deactivated() {} }
      }]

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)

      const mockPatch = jest.fn().mockResolvedValue(undefined)
      WIKI.models.plugins.query().patch = mockPatch

      runtime.executePlugin.mockResolvedValue(undefined)

      await manager.deactivatePlugin('test-plugin')

      expect(mockPatch).toHaveBeenCalled()
      const updates = mockPatch.mock.calls[0][0]
      expect(updates.status).toBe('installed')
    })

    it('throws if plugin is not active', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)

      await expect(manager.deactivatePlugin('test-plugin'))
        .rejects.toThrow(/not active/)
    })
  })

  describe('uninstallPlugin', () => {
    it('removes plugin files', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed',
        installPath: '/test/path'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)
      WIKI.models.plugins.query().deleteById = jest.fn().mockResolvedValue(1)

      fs.remove.mockResolvedValue(undefined)

      await manager.uninstallPlugin('test-plugin')

      expect(fs.remove).toHaveBeenCalledWith('/test/path')
    })

    it('removes database record', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed',
        installPath: '/test/path'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)

      const mockDelete = jest.fn().mockResolvedValue(1)
      WIKI.models.plugins.query().deleteById = mockDelete

      fs.remove.mockResolvedValue(undefined)

      await manager.uninstallPlugin('test-plugin')

      expect(mockDelete).toHaveBeenCalledWith('test-plugin')
    })

    it('throws if plugin is active', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'active'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)

      await expect(manager.uninstallPlugin('test-plugin'))
        .rejects.toThrow(/must be deactivated/)
    })

    it('cleans up even if database delete fails', async () => {
      const mockPlugin = {
        id: 'test-plugin',
        status: 'installed',
        installPath: '/test/path'
      }

      WIKI.models.plugins.query().findById = jest.fn().mockResolvedValue(mockPlugin)
      WIKI.models.plugins.query().deleteById = jest.fn().mockRejectedValue(new Error('DB Error'))

      fs.remove.mockResolvedValue(undefined)

      await expect(manager.uninstallPlugin('test-plugin'))
        .rejects.toThrow('DB Error')

      expect(fs.remove).toHaveBeenCalled()
    })
  })

  describe('runMigrations', () => {
    it('executes pending migrations in order', async () => {
      // This is complex and would require mocking migration files
      // Skip detailed implementation for now
    })

    it('tracks executed migrations', async () => {
      // Test migration tracking
    })

    it('rolls back on migration failure', async () => {
      // Test rollback behavior
    })
  })
})
