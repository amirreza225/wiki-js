/**
 * Plugin Hooks System Tests
 *
 * Tests event-based hook system with EventEmitter2
 */

const PluginHooks = require('../../plugins/hooks')
const { createTestPlugin, createMockWIKI } = require('../helpers/plugin-test-utils')

// Setup global WIKI
global.WIKI = createMockWIKI()

describe('plugins/hooks', () => {
  let hooks

  beforeEach(() => {
    // Create fresh instance for each test
    hooks = new PluginHooks.constructor()
  })

  afterEach(() => {
    hooks.removeAllListeners()
  })

  describe('EventEmitter2 Configuration', () => {
    it('is configured with wildcard support', () => {
      expect(hooks.wildcard).toBe(true)
    })

    it('uses colon delimiter', () => {
      expect(hooks.delimiter).toBe(':')
    })

    it('allows multiple listeners', () => {
      expect(hooks._maxListeners).toBeGreaterThan(10)
    })
  })

  describe('trigger', () => {
    it('triggers registered hooks', async () => {
      const callback = jest.fn()
      hooks.on('test:event', callback)

      await hooks.trigger('test:event', { data: 'test' })

      expect(callback).toHaveBeenCalledWith({ data: 'test' })
    })

    it('triggers multiple listeners for same event', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()
      hooks.on('test:event', callback1)
      hooks.on('test:event', callback2)

      await hooks.trigger('test:event', { data: 'test' })

      expect(callback1).toHaveBeenCalledWith({ data: 'test' })
      expect(callback2).toHaveBeenCalledWith({ data: 'test' })
    })

    it('returns results from all listeners', async () => {
      hooks.on('test:event', async () => 'result1')
      hooks.on('test:event', async () => 'result2')

      const results = await hooks.trigger('test:event', {})

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[0].result).toBe('result1')
      expect(results[1].success).toBe(true)
      expect(results[1].result).toBe('result2')
    })

    it('continues execution on error', async () => {
      hooks.on('test:event', async () => {
        throw new Error('Test error')
      })
      hooks.on('test:event', async () => 'success')

      const results = await hooks.trigger('test:event', {})

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBeDefined()
      expect(results[1].success).toBe(true)
      expect(results[1].result).toBe('success')
    })

    it('logs errors but does not throw', async () => {
      hooks.on('test:event', async () => {
        throw new Error('Test error')
      })

      await expect(hooks.trigger('test:event', {})).resolves.not.toThrow()

      expect(WIKI.logger.error).toHaveBeenCalled()
    })

    it('works with wildcard listeners', async () => {
      const callback = jest.fn()
      hooks.on('page:*', callback)

      await hooks.trigger('page:save', { id: 1 })

      expect(callback).toHaveBeenCalledWith({ id: 1 })
    })

    it('works with multi-level wildcards', async () => {
      const callback = jest.fn()
      hooks.on('**', callback)

      await hooks.trigger('page:save', { id: 1 })

      expect(callback).toHaveBeenCalledWith({ id: 1 })
    })

    it('returns empty array when no listeners', async () => {
      const results = await hooks.trigger('nonexistent:event', {})

      expect(results).toEqual([])
    })

    it('passes data to all listeners', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()
      hooks.on('test:event', callback1)
      hooks.on('test:event', callback2)

      const data = { id: 123, name: 'test' }
      await hooks.trigger('test:event', data)

      expect(callback1).toHaveBeenCalledWith(data)
      expect(callback2).toHaveBeenCalledWith(data)
    })

    it('handles async listeners', async () => {
      const callback = jest.fn(async (data) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async-result'
      })
      hooks.on('test:event', callback)

      const results = await hooks.trigger('test:event', {})

      expect(results[0].result).toBe('async-result')
    })

    it('measures execution time', async () => {
      hooks.on('test:event', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const results = await hooks.trigger('test:event', {})

      expect(results[0].executionTime).toBeGreaterThan(0)
    })
  })

  describe('registerPluginHooks', () => {
    it('registers plugin hooks from instance', async () => {
      const plugin = {
        id: 'test-plugin',
        instance: createTestPlugin()
      }

      await hooks.registerPluginHooks(plugin)

      const registeredHooks = hooks.getPluginHooks('test-plugin')
      expect(registeredHooks).toContain('test:event')
      expect(registeredHooks).toContain('page:save')
    })

    it('binds hook context to plugin instance', async () => {
      let contextId
      const plugin = {
        id: 'test-plugin',
        instance: {
          pluginId: 'test-plugin',
          hooks: {
            'test:event': async function() {
              contextId = this.pluginId
            }
          }
        }
      }

      await hooks.registerPluginHooks(plugin)
      await hooks.trigger('test:event', {})

      expect(contextId).toBe('test-plugin')
    })

    it('handles plugins without hooks', async () => {
      const plugin = {
        id: 'test-plugin',
        instance: {
          async init() {}
        }
      }

      await expect(hooks.registerPluginHooks(plugin)).resolves.not.toThrow()
    })

    it('tracks which hooks belong to which plugin', async () => {
      const plugin1 = {
        id: 'plugin1',
        instance: {
          hooks: {
            'test:event1': async () => {}
          }
        }
      }
      const plugin2 = {
        id: 'plugin2',
        instance: {
          hooks: {
            'test:event2': async () => {}
          }
        }
      }

      await hooks.registerPluginHooks(plugin1)
      await hooks.registerPluginHooks(plugin2)

      const hooks1 = hooks.getPluginHooks('plugin1')
      const hooks2 = hooks.getPluginHooks('plugin2')

      expect(hooks1).toContain('test:event1')
      expect(hooks1).not.toContain('test:event2')
      expect(hooks2).toContain('test:event2')
      expect(hooks2).not.toContain('test:event1')
    })

    it('allows multiple plugins to hook same event', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      const plugin1 = {
        id: 'plugin1',
        instance: {
          hooks: {
            'page:save': callback1
          }
        }
      }
      const plugin2 = {
        id: 'plugin2',
        instance: {
          hooks: {
            'page:save': callback2
          }
        }
      }

      await hooks.registerPluginHooks(plugin1)
      await hooks.registerPluginHooks(plugin2)

      await hooks.trigger('page:save', { id: 1 })

      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('unregisterPluginHooks', () => {
    it('unregisters all hooks for a plugin', async () => {
      const callback = jest.fn()
      const plugin = {
        id: 'test-plugin',
        instance: {
          hooks: {
            'test:event': callback
          }
        }
      }

      await hooks.registerPluginHooks(plugin)
      hooks.unregisterPluginHooks('test-plugin')

      await hooks.trigger('test:event', {})

      expect(callback).not.toHaveBeenCalled()
    })

    it('clears plugin hook tracking', async () => {
      const plugin = {
        id: 'test-plugin',
        instance: {
          hooks: {
            'test:event': async () => {}
          }
        }
      }

      await hooks.registerPluginHooks(plugin)
      hooks.unregisterPluginHooks('test-plugin')

      const registeredHooks = hooks.getPluginHooks('test-plugin')
      expect(registeredHooks).toHaveLength(0)
    })

    it('does not affect other plugins hooks', async () => {
      const callback1 = jest.fn()
      const callback2 = jest.fn()

      const plugin1 = {
        id: 'plugin1',
        instance: {
          hooks: {
            'test:event': callback1
          }
        }
      }
      const plugin2 = {
        id: 'plugin2',
        instance: {
          hooks: {
            'test:event': callback2
          }
        }
      }

      await hooks.registerPluginHooks(plugin1)
      await hooks.registerPluginHooks(plugin2)

      hooks.unregisterPluginHooks('plugin1')

      await hooks.trigger('test:event', {})

      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })

    it('handles unregistering non-existent plugin', () => {
      expect(() => hooks.unregisterPluginHooks('nonexistent')).not.toThrow()
    })
  })

  describe('getPluginHooks', () => {
    it('returns list of hooks for a plugin', async () => {
      const plugin = {
        id: 'test-plugin',
        instance: {
          hooks: {
            'test:event1': async () => {},
            'test:event2': async () => {},
            'page:save': async () => {}
          }
        }
      }

      await hooks.registerPluginHooks(plugin)

      const pluginHooks = hooks.getPluginHooks('test-plugin')

      expect(pluginHooks).toHaveLength(3)
      expect(pluginHooks).toContain('test:event1')
      expect(pluginHooks).toContain('test:event2')
      expect(pluginHooks).toContain('page:save')
    })

    it('returns empty array for plugin with no hooks', () => {
      const pluginHooks = hooks.getPluginHooks('nonexistent')

      expect(pluginHooks).toEqual([])
    })
  })

  describe('Available Hook Events', () => {
    it('defines application lifecycle hooks', () => {
      const lifecycleHooks = [
        'app:start',
        'app:shutdown'
      ]

      lifecycleHooks.forEach(hook => {
        expect(() => hooks.on(hook, () => {})).not.toThrow()
      })
    })

    it('defines page hooks', () => {
      const pageHooks = [
        'page:render',
        'page:save',
        'page:delete',
        'page:move',
        'page:restore'
      ]

      pageHooks.forEach(hook => {
        expect(() => hooks.on(hook, () => {})).not.toThrow()
      })
    })

    it('defines user hooks', () => {
      const userHooks = [
        'user:create',
        'user:login',
        'user:logout',
        'user:delete'
      ]

      userHooks.forEach(hook => {
        expect(() => hooks.on(hook, () => {})).not.toThrow()
      })
    })

    it('defines asset hooks', () => {
      const assetHooks = [
        'asset:upload',
        'asset:delete',
        'asset:rename'
      ]

      assetHooks.forEach(hook => {
        expect(() => hooks.on(hook, () => {})).not.toThrow()
      })
    })

    it('defines search hooks', () => {
      const searchHooks = [
        'search:index',
        'search:query'
      ]

      searchHooks.forEach(hook => {
        expect(() => hooks.on(hook, () => {})).not.toThrow()
      })
    })
  })

  describe('Hook Data Modification', () => {
    it('allows hooks to modify data', async () => {
      hooks.on('test:transform', async (data) => {
        data.modified = true
        return data
      })

      const data = { original: true }
      const results = await hooks.trigger('test:transform', data)

      expect(results[0].result.modified).toBe(true)
      expect(data.modified).toBe(true) // Original object modified
    })

    it('collects all modifications from multiple hooks', async () => {
      hooks.on('test:transform', async (data) => {
        data.count = (data.count || 0) + 1
      })
      hooks.on('test:transform', async (data) => {
        data.count = (data.count || 0) + 1
      })

      const data = {}
      await hooks.trigger('test:transform', data)

      expect(data.count).toBe(2)
    })
  })

  describe('Error Handling', () => {
    it('isolates errors between hooks', async () => {
      const callback1 = jest.fn(() => {
        throw new Error('Error 1')
      })
      const callback2 = jest.fn()

      hooks.on('test:event', callback1)
      hooks.on('test:event', callback2)

      const results = await hooks.trigger('test:event', {})

      expect(results[0].success).toBe(false)
      expect(results[1].success).toBe(true)
      expect(callback2).toHaveBeenCalled()
    })

    it('captures error details', async () => {
      hooks.on('test:event', async () => {
        throw new Error('Specific error message')
      })

      const results = await hooks.trigger('test:event', {})

      expect(results[0].error).toBeDefined()
      expect(results[0].error.message).toContain('Specific error message')
    })

    it('includes plugin ID in error logs', async () => {
      const plugin = {
        id: 'error-plugin',
        instance: {
          hooks: {
            'test:event': async function() {
              throw new Error('Plugin error')
            }
          }
        }
      }

      await hooks.registerPluginHooks(plugin)
      await hooks.trigger('test:event', {})

      expect(WIKI.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('error-plugin')
      )
    })
  })
})
