const EventEmitter2 = require('eventemitter2')

/**
 * Plugin Test Utilities
 *
 * Provides mock factories and helpers for testing the plugin system
 */

module.exports = {
  /**
   * Create mock plugin context with specified permissions
   *
   * @param {Array<string>} permissions - Permissions to grant
   * @returns {Object} Mock context object
   */
  createMockContext(permissions = []) {
    const context = {
      plugin: {
        id: 'test-plugin',
        version: '1.0.0',
        path: '/test/path',
        config: {}
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    }

    if (permissions.includes('config:read') || permissions.includes('config:write')) {
      context.config = {
        get: jest.fn(),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn()
      }
    }

    if (permissions.includes('database:read') || permissions.includes('database:write')) {
      context.db = {
        knex: jest.fn(),
        models: {},
        WIKI: {}
      }
    }

    if (permissions.includes('events:emit')) {
      context.events = new EventEmitter2()
    }

    if (permissions.includes('storage:read') || permissions.includes('storage:write')) {
      context.storage = {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        exists: jest.fn(),
        delete: jest.fn()
      }
    }

    if (permissions.includes('cache:read') || permissions.includes('cache:write')) {
      context.cache = {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn()
      }
    }

    return context
  },

  /**
   * Create mock WIKI global object
   *
   * @returns {Object} Mock WIKI object
   */
  createMockWIKI() {
    return {
      version: '2.5.0',
      ROOTPATH: '/test/root',
      SERVERPATH: '/test/server',
      data: {
        plugins: []
      },
      models: {
        plugins: {
          query: jest.fn(() => ({
            findById: jest.fn(),
            insert: jest.fn(),
            patch: jest.fn(),
            deleteById: jest.fn(),
            where: jest.fn(() => ({
              first: jest.fn()
            }))
          }))
        },
        pluginErrors: {
          query: jest.fn(() => ({
            insert: jest.fn()
          }))
        },
        pluginMigrations: {
          query: jest.fn(() => ({
            where: jest.fn(() => ({
              first: jest.fn()
            })),
            insert: jest.fn()
          }))
        },
        pluginDependencies: {
          query: jest.fn(() => ({
            where: jest.fn(),
            insert: jest.fn()
          }))
        },
        pluginPermissions: {
          query: jest.fn(() => ({
            where: jest.fn(),
            insert: jest.fn()
          }))
        }
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      },
      plugins: {
        hooks: new EventEmitter2({
          wildcard: true,
          delimiter: ':',
          maxListeners: 100
        })
      }
    }
  },

  /**
   * Create test plugin manifest
   *
   * @param {Object} overrides - Fields to override
   * @returns {Object} Plugin manifest
   */
  createTestManifest(overrides = {}) {
    return {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test plugin for testing',
      author: 'Test Author',
      license: 'MIT',
      compatibility: {
        wikijs: '>=2.5.0',
        node: '>=18.0.0'
      },
      permissions: ['config:read', 'events:emit'],
      config: {
        schema: {
          type: 'object',
          properties: {
            enabled: {
              type: 'boolean',
              default: true
            }
          }
        }
      },
      ...overrides
    }
  },

  /**
   * Create test plugin instance with lifecycle methods
   *
   * @returns {Object} Plugin instance
   */
  createTestPlugin() {
    return {
      async init() {
        this.logger.info('Test plugin initialized')
      },
      async activated() {
        this.logger.info('Test plugin activated')
      },
      async deactivated() {
        this.logger.info('Test plugin deactivated')
      },
      hooks: {
        'test:event': async function(data) {
          this.logger.info('Test event triggered', data)
          return { processed: true }
        },
        'page:save': async function(page) {
          this.logger.info('Page save hook triggered', page.id)
        }
      }
    }
  },

  /**
   * Create mock plugin record from database
   *
   * @param {Object} overrides - Fields to override
   * @returns {Object} Plugin database record
   */
  createMockPluginRecord(overrides = {}) {
    return {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      author: 'Test Author',
      status: 'installed',
      installDate: new Date('2026-01-01'),
      updateDate: new Date('2026-01-01'),
      activationDate: null,
      installPath: '/plugins/installed/test-plugin',
      config: {},
      manifest: {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0'
      },
      ...overrides
    }
  },

  /**
   * Create mock file system structure for a plugin
   *
   * @param {Object} files - Files to include
   * @returns {Object} File structure map
   */
  createMockPluginFiles(files = {}) {
    return {
      'plugin.yml': 'id: test-plugin\nname: Test Plugin\nversion: 1.0.0',
      'server/index.js': 'module.exports = { async init() {} }',
      'package.json': '{"name": "test-plugin", "version": "1.0.0"}',
      ...files
    }
  },

  /**
   * Create mock ZIP buffer for plugin installation
   *
   * @returns {Buffer} Mock ZIP buffer
   */
  createMockPluginZip() {
    // In real tests, use adm-zip to create actual ZIP
    // For unit tests, just return a buffer
    return Buffer.from('mock-zip-content')
  },

  /**
   * Reset all mocks in WIKI object
   *
   * @param {Object} wiki - WIKI object to reset
   */
  resetMockWIKI(wiki) {
    Object.values(wiki.models).forEach(model => {
      if (model.query && model.query.mockClear) {
        model.query.mockClear()
      }
    })
    Object.values(wiki.logger).forEach(fn => {
      if (fn.mockClear) {
        fn.mockClear()
      }
    })
  },

  /**
   * Create mock Knex query builder
   *
   * @returns {Object} Mock query builder
   */
  createMockQueryBuilder() {
    const builder = {
      where: jest.fn(() => builder),
      andWhere: jest.fn(() => builder),
      orWhere: jest.fn(() => builder),
      whereIn: jest.fn(() => builder),
      first: jest.fn(),
      select: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      delete: jest.fn(() => builder),
      patch: jest.fn(() => builder),
      returning: jest.fn(() => builder),
      then: jest.fn((resolve) => resolve([]))
    }
    return builder
  }
}
