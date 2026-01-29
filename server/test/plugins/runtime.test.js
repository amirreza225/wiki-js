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

      it('adds config API with config:write permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['config:write']
        }

        const context = runtime.createContext(plugin)

        expect(context.config).toBeDefined()
        expect(context.config.set).toBeDefined()
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

      it('adds database API with database:write permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['database:write']
        }

        const context = runtime.createContext(plugin)

        expect(context.db).toBeDefined()
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
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['events:emit']
        }

        const context = runtime.createContext(plugin)

        expect(context.events).toBeDefined()
        expect(context.events.emit).toBeDefined()
      })

      it('adds events API with events:listen permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['events:listen']
        }

        const context = runtime.createContext(plugin)

        expect(context.events).toBeDefined()
        expect(context.events.on).toBeDefined()
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

      it('adds storage API with storage:read permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['storage:read']
        }

        const context = runtime.createContext(plugin)

        expect(context.storage).toBeDefined()
        expect(context.storage.readFile).toBeDefined()
      })

      it('adds storage API with storage:write permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['storage:write']
        }

        const context = runtime.createContext(plugin)

        expect(context.storage).toBeDefined()
        expect(context.storage.writeFile).toBeDefined()
      })

      it('adds cache API with cache:read permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['cache:read']
        }

        const context = runtime.createContext(plugin)

        expect(context.cache).toBeDefined()
        expect(context.cache.get).toBeDefined()
      })

      it('adds cache API with cache:write permission', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['cache:write']
        }

        const context = runtime.createContext(plugin)

        expect(context.cache).toBeDefined()
        expect(context.cache.set).toBeDefined()
      })

      it('adds multiple APIs with multiple permissions', () => {
        const plugin = {
          id: 'test-plugin',
          version: '1.0.0',
          permissions: ['config:read', 'database:write', 'events:emit', 'cache:read']
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

    it('handles multiple arguments', () => {
      const logger = runtime.createPluginLogger('test-plugin')

      logger.info('test', { data: 'value' }, 123)

      expect(WIKI.logger.info).toHaveBeenCalledWith(
        '[Plugin:test-plugin] test',
        { data: 'value' },
        123
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
      expect(configAPI.has).toBeDefined()
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

    it('returns default value for missing keys', () => {
      const plugin = {
        id: 'test-plugin',
        config: {}
      }

      const configAPI = runtime.createConfigAPI(plugin)

      expect(configAPI.get('missing', 'default')).toBe('default')
    })

    it('checks if config has key', () => {
      const plugin = {
        id: 'test-plugin',
        config: {
          apiKey: 'secret'
        }
      }

      const configAPI = runtime.createConfigAPI(plugin)

      expect(configAPI.has('apiKey')).toBe(true)
      expect(configAPI.has('missing')).toBe(false)
    })

    it('sets config values (in-memory only)', () => {
      const plugin = {
        id: 'test-plugin',
        config: {}
      }

      const configAPI = runtime.createConfigAPI(plugin)

      configAPI.set('newKey', 'newValue')

      expect(configAPI.get('newKey')).toBe('newValue')
    })
  })

  describe('createDatabaseAPI', () => {
    it('creates database API', () => {
      const plugin = {
        id: 'test-plugin'
      }

      const dbAPI = runtime.createDatabaseAPI(plugin)

      expect(dbAPI.knex).toBeDefined()
      expect(dbAPI.models).toBeDefined()
    })

    it('provides Knex instance', () => {
      const plugin = {
        id: 'test-plugin'
      }

      const dbAPI = runtime.createDatabaseAPI(plugin)

      expect(dbAPI.knex).toBe(WIKI.db)
    })

    it('provides plugin-scoped models', () => {
      const plugin = {
        id: 'test-plugin'
      }

      const dbAPI = runtime.createDatabaseAPI(plugin)

      expect(dbAPI.models).toBeDefined()
      expect(typeof dbAPI.models).toBe('object')
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
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        installPath: '/test/path',
        permissions: []
      }
      const pluginInstance = createTestPlugin()

      await runtime.executePlugin(plugin, pluginInstance, 'init')

      expect(pluginInstance.logger).toBeDefined()
    })

    it('returns result from plugin method', async () => {
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        permissions: []
      }
      const pluginInstance = {
        async testMethod() {
          return { success: true }
        }
      }

      const result = await runtime.executePlugin(plugin, pluginInstance, 'testMethod')

      expect(result).toEqual({ success: true })
    })

    it('catches and logs errors', async () => {
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        permissions: []
      }
      const pluginInstance = {
        async failingMethod() {
          throw new Error('Test error')
        }
      }

      await expect(
        runtime.executePlugin(plugin, pluginInstance, 'failingMethod')
      ).rejects.toThrow('Test error')

      expect(WIKI.logger.error).toHaveBeenCalled()
    })

    it('passes arguments to plugin method', async () => {
      const plugin = {
        id: 'test-plugin',
        version: '1.0.0',
        permissions: []
      }
      const pluginInstance = {
        async methodWithArgs(arg1, arg2) {
          return { arg1, arg2 }
        }
      }

      const result = await runtime.executePlugin(
        plugin,
        pluginInstance,
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
    it('logs error to database', async () => {
      const plugin = {
        id: 'test-plugin'
      }
      const error = new Error('Test error')
      const context = 'init'

      await runtime.logPluginError(plugin, error, context)

      expect(WIKI.models.pluginErrors.query).toHaveBeenCalled()
    })

    it('logs error to console', async () => {
      const plugin = {
        id: 'test-plugin'
      }
      const error = new Error('Test error')

      await runtime.logPluginError(plugin, error, 'init')

      expect(WIKI.logger.error).toHaveBeenCalled()
    })

    it('includes stack trace', async () => {
      const plugin = {
        id: 'test-plugin'
      }
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n  at test.js:1:1'

      await runtime.logPluginError(plugin, error, 'init')

      const insertCall = WIKI.models.pluginErrors.query().insert
      expect(insertCall).toHaveBeenCalled()
      const errorData = insertCall.mock.calls[0][0]
      expect(errorData.stackTrace).toContain('Error: Test error')
    })
  })
})
