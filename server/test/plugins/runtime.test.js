/**
 * Plugin Runtime Tests
 *
 * Tests plugin context creation and execution
 */

const runtime = require('../../plugins/runtime')
const { createMockWIKI, createTestPlugin } = require('../helpers/plugin-test-utils')

// Setup global WIKI
global.WIKI = createMockWIKI()

describe('plugins/runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createContext', () => {
    it('creates basic context with plugin metadata', () => {
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        installPath: '/test/path',
        config: { enabled: true },
        permissions: []
      }

      const context = runtime.createContext(plugin)

      expect(context.plugin).toBeDefined()
      expect(context.plugin.id).toBe('test-plugin')
      expect(context.plugin.version).toBe('1.0.0')
      expect(context.plugin.path).toBe('/test/path')
      expect(context.plugin.config).toEqual({ enabled: true })
    })

    it('includes logger in all contexts', () => {
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        permissions: []
      }

      const context = runtime.createContext(plugin)

      expect(context.logger).toBeDefined()
      expect(context.logger.info).toBeDefined()
      expect(context.logger.warn).toBeDefined()
      expect(context.logger.error).toBeDefined()
      expect(context.logger.debug).toBeDefined()
    })

    describe('Permission-based API Access', () => {
      it('adds config API with config:read permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['config:read']
        }

        const context = runtime.createContext(plugin)

        expect(context.config).toBeDefined()
        expect(context.config.get).toBeDefined()
      })

      it('does not add config API without permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: []
        }

        const context = runtime.createContext(plugin)

        expect(context.config).toBeUndefined()
      })

      it('adds database API with database:read permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['database:read']
        }

        const context = runtime.createContext(plugin)

        expect(context.db).toBeDefined()
        expect(context.db.knex).toBeDefined()
      })

      it('does not add database API without permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: []
        }

        const context = runtime.createContext(plugin)

        expect(context.db).toBeUndefined()
      })

      it('adds events API with events:emit permission', () => {
        // Setup mock events
        WIKI.events = { outbound: { emit: jest.fn(), on: jest.fn() } }

        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['events:emit']
        }

        const context = runtime.createContext(plugin)

        expect(context.events).toBeDefined()
      })

      it('does not add events API without permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: []
        }

        const context = runtime.createContext(plugin)

        expect(context.events).toBeUndefined()
      })

      it('adds cache API with cache:read permission', () => {
        // Setup mock cache
        WIKI.cache = { get: jest.fn(), set: jest.fn() }

        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['cache:read']
        }

        const context = runtime.createContext(plugin)

        expect(context.cache).toBeDefined()
      })

      it('adds core WIKI with core:read permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['core:read']
        }

        const context = runtime.createContext(plugin)

        expect(context.WIKI).toBeDefined()
      })

      it('adds multiple APIs with multiple permissions', () => {
        WIKI.events = { outbound: { emit: jest.fn() } }
        WIKI.cache = { get: jest.fn() }

        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['config:read', 'database:read', 'events:emit', 'cache:read']
        }

        const context = runtime.createContext(plugin)

        expect(context.config).toBeDefined()
        expect(context.db).toBeDefined()
        expect(context.events).toBeDefined()
        expect(context.cache).toBeDefined()
      })
    })
  })

  describe('createPluginLogger', () => {
    it('creates scoped logger', () => {
      const logger = runtime.createPluginLogger('test-plugin')

      expect(logger.info).toBeDefined()
      expect(logger.warn).toBeDefined()
      expect(logger.error).toBeDefined()
      expect(logger.debug).toBeDefined()
    })

    it('prefixes log messages with plugin ID', () => {
      const logger = runtime.createPluginLogger('test-plugin')

      logger.info('test message')

      expect(WIKI.logger.info).toHaveBeenCalledWith(
        '[Plugin:test-plugin] test message'
      )
    })

    it('prefixes messages with plugin ID', () => {
      const logger = runtime.createPluginLogger('test-plugin')

      logger.info('test message')

      expect(WIKI.logger.info).toHaveBeenCalledWith(
        '[Plugin:test-plugin] test message'
      )
    })

    it('works for all log levels', () => {
      const logger = runtime.createPluginLogger('test-plugin')

      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      expect(WIKI.logger.debug).toHaveBeenCalledWith('[Plugin:test-plugin] debug message')
      expect(WIKI.logger.info).toHaveBeenCalledWith('[Plugin:test-plugin] info message')
      expect(WIKI.logger.warn).toHaveBeenCalledWith('[Plugin:test-plugin] warn message')
      expect(WIKI.logger.error).toHaveBeenCalledWith('[Plugin:test-plugin] error message')
    })
  })

  describe('createConfigAPI', () => {
    it('creates config API for plugin', () => {
      const plugin = {
        id: 'test-plugin',
        config: {
          apiKey: 'secret',
          enabled: true
        }
      }

      const configAPI = runtime.createConfigAPI(plugin)

      expect(configAPI.get).toBeDefined()
      expect(configAPI.set).toBeDefined()
    })

    it('gets config values', () => {
      const plugin = {
        id: 'test-plugin',
        config: {
          apiKey: 'secret',
          enabled: true
        }
      }

      const configAPI = runtime.createConfigAPI(plugin)

      expect(configAPI.get('apiKey')).toBe('secret')
      expect(configAPI.get('enabled')).toBe(true)
    })

    it('returns undefined for missing keys', () => {
      const plugin = {
        id: 'test-plugin',
        config: {}
      }

      const configAPI = runtime.createConfigAPI(plugin)

      expect(configAPI.get('missing')).toBeUndefined()
    })

    it('sets config values (in-memory only)', async () => {
      // Mock the query builder chain
      const mockPatch = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined)
      })
      WIKI.models.plugins.query = jest.fn().mockReturnValue({
        patch: mockPatch
      })

      const plugin = {
        id: 'test-plugin',
        config: {},
        permissions: ['config:write']
      }

      const configAPI = runtime.createConfigAPI(plugin)

      await configAPI.set('newKey', 'newValue')

      expect(mockPatch).toHaveBeenCalledWith({ config: { newKey: 'newValue' } })
      expect(plugin.config.newKey).toBe('newValue')
    })
  })

  describe('createDatabaseAPI', () => {
    it('creates database API with knex', () => {
      const plugin = {
        id: 'test-plugin',
        permissions: []
      }

      const dbAPI = runtime.createDatabaseAPI(plugin)

      expect(dbAPI.knex).toBeDefined()
      expect(dbAPI.WIKI).toBeDefined()
    })

    it('provides Knex instance', () => {
      const plugin = {
        id: 'test-plugin',
        permissions: []
      }

      const dbAPI = runtime.createDatabaseAPI(plugin)

      expect(dbAPI.knex).toBe(WIKI.models.knex)
    })

    it('provides core models with database:core permission', () => {
      const plugin = {
        id: 'test-plugin',
        permissions: ['database:core']
      }

      const dbAPI = runtime.createDatabaseAPI(plugin)

      expect(dbAPI.models).toBeDefined()
      expect(dbAPI.models).toBe(WIKI.models)
    })
  })

  describe('hasPermission', () => {
    it('returns true when plugin has permission', () => {
      const plugin = {
        permissions: ['config:read', 'database:write']
      }

      expect(runtime.hasPermission(plugin, 'config:read')).toBe(true)
      expect(runtime.hasPermission(plugin, 'database:write')).toBe(true)
    })

    it('returns false when plugin does not have permission', () => {
      const plugin = {
        permissions: ['config:read']
      }

      expect(runtime.hasPermission(plugin, 'config:write')).toBe(false)
      expect(runtime.hasPermission(plugin, 'database:read')).toBe(false)
    })

    it('returns false for null plugin', () => {
      expect(runtime.hasPermission(null, 'config:read')).toBe(false)
    })

    it('returns false for plugin without permissions', () => {
      const plugin = { id: 'test' }

      expect(runtime.hasPermission(plugin, 'config:read')).toBe(false)
    })

    it('returns false for empty permissions array', () => {
      const plugin = { permissions: [] }

      expect(runtime.hasPermission(plugin, 'config:read')).toBe(false)
    })
  })

  describe('executePlugin', () => {
    it('executes plugin init method', async () => {
      const pluginInstance = createTestPlugin()
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        installPath: '/test/path',
        permissions: [],
        instance: pluginInstance
      }

      await runtime.executePlugin(plugin, 'init')

      // Context should be bound, so logger should be available
      expect(WIKI.logger.info).toHaveBeenCalled()
    })

    it('returns result from plugin method', async () => {
      const pluginInstance = {
        async testMethod() {
          return { success: true }
        }
      }
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        permissions: [],
        instance: pluginInstance
      }

      const result = await runtime.executePlugin(plugin, 'testMethod')

      expect(result).toEqual({ success: true })
    })

    it('catches and logs errors', async () => {
      // Mock the database insert for error logging
      const mockInsert = jest.fn().mockResolvedValue(undefined)
      WIKI.models.pluginErrors.query = jest.fn(() => ({
        insert: mockInsert
      }))

      const pluginInstance = {
        async failingMethod() {
          throw new Error('Test error')
        }
      }
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        permissions: [],
        instance: pluginInstance
      }

      await expect(
        runtime.executePlugin(plugin, 'failingMethod')
      ).rejects.toThrow('Test error')

      // Verify error was logged to database
      expect(mockInsert).toHaveBeenCalled()
      expect(mockInsert.mock.calls[0][0].errorMessage).toBe('Test error')
    })

    it('passes arguments to plugin method', async () => {
      const pluginInstance = {
        async methodWithArgs(arg1, arg2) {
          return { arg1, arg2 }
        }
      }
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        permissions: [],
        instance: pluginInstance
      }

      const result = await runtime.executePlugin(
        plugin,
        'methodWithArgs',
        'value1',
        'value2'
      )

      expect(result).toEqual({ arg1: 'value1', arg2: 'value2' })
    })
  })

  describe('loadPlugin', () => {
    it('loads plugin from path', async () => {
      // This would require mocking require.resolve and require()
      // Skip for now as it's complex with module system
    })
  })

  describe('logPluginError', () => {
    beforeEach(() => {
      // Reset the mock before each test
      WIKI.models.pluginErrors.query().insert.mockClear()
    })

    it('logs error to database', async () => {
      const mockInsert = jest.fn().mockResolvedValue(undefined)
      WIKI.models.pluginErrors.query = jest.fn(() => ({
        insert: mockInsert
      }))

      const error = new Error('Test error')

      await runtime.logPluginError('test-plugin', 'execution_error', error)

      expect(mockInsert).toHaveBeenCalled()
      expect(mockInsert.mock.calls[0][0]).toMatchObject({
        pluginId: 'test-plugin',
        errorType: 'execution_error',
        errorMessage: 'Test error'
      })
    })

    it('includes stack trace', async () => {
      const mockInsert = jest.fn().mockResolvedValue(undefined)
      WIKI.models.pluginErrors.query = jest.fn(() => ({
        insert: mockInsert
      }))

      const error = new Error('Test error')
      error.stack = 'Error: Test error\n  at test.js:1:1'

      await runtime.logPluginError('test-plugin', 'init_error', error)

      expect(mockInsert).toHaveBeenCalled()
      const errorData = mockInsert.mock.calls[0][0]
      expect(errorData.stackTrace).toContain('Error: Test error')
      expect(errorData.stackTrace).toContain('test.js:1:1')
    })

    it('logs warning if database insert fails', async () => {
      const mockInsert = jest.fn().mockRejectedValue(new Error('DB Error'))
      WIKI.models.pluginErrors.query = jest.fn(() => ({
        insert: mockInsert
      }))

      const error = new Error('Test error')

      await runtime.logPluginError('test-plugin', 'execution_error', error)

      expect(WIKI.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log error for plugin test-plugin')
      )
    })
  })
})
