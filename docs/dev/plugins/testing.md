# Testing Wiki.js Plugins

This guide covers testing strategies for Wiki.js plugins.

## Table of Contents

- [Test Utilities](#test-utilities)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [Manual Testing](#manual-testing)
- [GraphQL Testing](#graphql-testing)
- [Debugging](#debugging)

---

## Test Utilities

Wiki.js provides test utilities to help with plugin testing.

### Setup

```javascript
const {
  createMockContext,
  createMockWIKI,
  createTestManifest,
  createTestPlugin
} = require('@wikijs/test-utils') // or relative path to utilities

// Setup test environment
beforeEach(() => {
  global.WIKI = createMockWIKI()
  jest.clearAllMocks()
})
```

### Mock Context

Create a mock plugin context with specific permissions:

```javascript
const context = createMockContext(['config:read', 'database:write', 'events:emit'])

// context.config is available (has config:read)
// context.db is available (has database:write)
// context.events is available (has events:emit)
// context.logger is always available
```

### Mock Plugin

Create a test plugin instance:

```javascript
const plugin = createTestPlugin()

// Plugin has:
// - async init()
// - async activated()
// - async deactivated()
// - hooks: { 'test:event': async function() {} }
```

---

## Unit Testing

Test individual plugin components in isolation.

### Testing Lifecycle Methods

```javascript
describe('My Plugin', () => {
  let plugin
  let context

  beforeEach(() => {
    context = createMockContext(['config:read'])
    plugin = require('./server/index.js')

    // Bind context to plugin methods
    plugin.init = plugin.init.bind(context)
    plugin.activated = plugin.activated.bind(context)
  })

  test('should initialize successfully', async () => {
    await plugin.init()

    expect(context.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('initialized')
    )
  })

  test('should validate config on init', async () => {
    context.config.get.mockReturnValue(null) // No API key

    await expect(plugin.init()).rejects.toThrow('API key required')
  })

  test('should activate successfully', async () => {
    await plugin.activated()

    expect(context.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('activated')
    )
  })
})
```

### Testing Hooks

```javascript
describe('Plugin Hooks', () => {
  let plugin
  let context

  beforeEach(() => {
    context = createMockContext(['config:read', 'events:emit'])
    plugin = require('./server/index.js')

    // Bind hook context
    Object.keys(plugin.hooks).forEach(hook => {
      plugin.hooks[hook] = plugin.hooks[hook].bind(context)
    })
  })

  test('should handle page:save hook', async () => {
    const page = {
      id: 123,
      title: 'Test Page',
      content: 'Content',
      authorName: 'Test User'
    }

    await plugin.hooks['page:save'](page)

    expect(context.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Test Page')
    )
  })

  test('should emit event on page save', async () => {
    const page = { id: 123, title: 'Test' }

    const emitSpy = jest.spyOn(context.events, 'emit')

    await plugin.hooks['page:save'](page)

    expect(emitSpy).toHaveBeenCalledWith(
      'myplugin:page-processed',
      expect.objectContaining({ pageId: 123 })
    )
  })
})
```

### Testing Configuration

```javascript
describe('Plugin Configuration', () => {
  test('should get config value', () => {
    const context = createMockContext(['config:read'])
    context.config.get.mockReturnValue('test-api-key')

    const apiKey = context.config.get('apiKey')

    expect(apiKey).toBe('test-api-key')
  })

  test('should use default value', () => {
    const context = createMockContext(['config:read'])
    context.config.get.mockImplementation((key, def) => def)

    const timeout = context.config.get('timeout', 5000)

    expect(timeout).toBe(5000)
  })

  test('should set config value', () => {
    const context = createMockContext(['config:write'])

    context.config.set('lastRun', '2026-01-01')

    expect(context.config.set).toHaveBeenCalledWith('lastRun', '2026-01-01')
  })
})
```

### Testing Database Operations

```javascript
describe('Database Operations', () => {
  test('should query pages', async () => {
    const context = createMockContext(['database:read'])

    const mockPages = [
      { id: 1, title: 'Page 1' },
      { id: 2, title: 'Page 2' }
    ]

    context.db.knex.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(mockPages)
    })

    // Test your plugin code that queries pages
    const pages = await context.db.knex('pages')
      .where('isPublished', true)
      .select('id', 'title')

    expect(pages).toEqual(mockPages)
  })

  test('should insert records', async () => {
    const context = createMockContext(['database:write'])

    const mockInsert = jest.fn().mockResolvedValue([1])
    context.db.knex.mockReturnValue({
      insert: mockInsert
    })

    await context.db.knex('plugin_my_table').insert({ name: 'test' })

    expect(mockInsert).toHaveBeenCalledWith({ name: 'test' })
  })
})
```

### Testing Error Handling

```javascript
describe('Error Handling', () => {
  test('should handle missing config gracefully', async () => {
    const context = createMockContext(['config:read'])
    context.config.get.mockReturnValue(null)

    const plugin = require('./server/index.js')
    plugin.init = plugin.init.bind(context)

    await expect(plugin.init()).rejects.toThrow()

    expect(context.logger.error).toHaveBeenCalled()
  })

  test('should not crash on hook error', async () => {
    const context = createMockContext([])
    const plugin = require('./server/index.js')

    const hookHandler = plugin.hooks['page:save'].bind(context)

    // Simulate error in hook
    const badPage = null

    await expect(hookHandler(badPage)).rejects.toThrow()

    // Error should be logged
    expect(context.logger.error).toHaveBeenCalled()
  })
})
```

---

## Integration Testing

Test the plugin with real Wiki.js components.

### Setting Up Integration Tests

```javascript
// test/integration/plugin.test.js

const path = require('path')
const manager = require('../../server/plugins/manager')

describe('Plugin Integration', () => {
  beforeAll(async () => {
    // Initialize test database
    // Start Wiki.js in test mode
  })

  afterAll(async () => {
    // Cleanup
  })

  test('should install plugin from ZIP', async () => {
    const zipPath = path.join(__dirname, '../fixtures/test-plugin.zip')

    const result = await manager.installPlugin(zipPath)

    expect(result.success).toBe(true)
    expect(result.pluginId).toBe('test-plugin')
  })

  test('should activate plugin', async () => {
    await manager.installPlugin('./test-plugin.zip')

    const result = await manager.activatePlugin('test-plugin')

    expect(result.success).toBe(true)

    // Verify plugin is in active plugins list
    const activePlugins = WIKI.data.plugins.filter(p => p.status === 'active')
    expect(activePlugins.some(p => p.id === 'test-plugin')).toBe(true)
  })

  test('should trigger plugin hooks', async () => {
    await manager.installPlugin('./test-plugin.zip')
    await manager.activatePlugin('test-plugin')

    // Trigger a hook
    const results = await WIKI.plugins.hooks.trigger('page:save', {
      id: 1,
      title: 'Test Page'
    })

    // Verify hook was called
    expect(results.some(r => r.success)).toBe(true)
  })
})
```

---

## Manual Testing

Test your plugin manually during development.

### 1. Install Plugin

Place your plugin in `/plugins/installed/your-plugin/`:

```bash
cd /path/to/wiki-js
mkdir -p plugins/installed/my-plugin
cp -r /path/to/your-plugin/* plugins/installed/my-plugin/
```

### 2. Start Wiki.js

```bash
yarn dev
```

Check logs for plugin discovery:

```
[MASTER] info: [Plugins] Refreshing plugins from disk...
[MASTER] info: [Plugins] Found 1 plugins on disk
[MASTER] info: [Plugins] Plugin 'my-plugin' discovered
```

### 3. Activate via GraphQL

Open GraphQL Playground at `http://localhost:3000/graphql`.

**Authenticate first:**

```graphql
mutation {
  authentication {
    login(
      username: "admin@example.com"
      password: "your-password"
      strategy: "local"
    ) {
      jwt
    }
  }
}
```

Copy the JWT token and add it to HTTP headers:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

**Activate plugin:**

```graphql
mutation {
  plugins {
    activate(pluginId: "my-plugin") {
      operation {
        succeeded
        message
      }
      requiresRestart
    }
  }
}
```

### 4. Test Hooks

Perform actions that trigger your hooks:

- Save a page (triggers `page:save`)
- Upload an asset (triggers `asset:upload`)
- Login (triggers `user:login`)

Check logs for plugin messages:

```
[Plugin:my-plugin] Page saved: Test Page
```

### 5. Test Configuration

Update plugin configuration:

```graphql
mutation {
  plugins {
    updateConfig(
      pluginId: "my-plugin"
      config: "{\"apiKey\": \"test-key\", \"enabled\": true}"
    ) {
      operation {
        succeeded
      }
    }
  }
}
```

### 6. Check for Errors

Query plugin errors:

```graphql
query {
  plugins {
    errors(pluginId: "my-plugin") {
      id
      message
      stackTrace
      timestamp
    }
  }
}
```

---

## GraphQL Testing

Test your plugin's GraphQL extensions.

### Testing Queries

```graphql
query {
  myPluginData {
    success
    data {
      id
      name
      value
    }
  }
}
```

### Testing Mutations

```graphql
mutation {
  myPluginAction(input: {
    name: "test"
    value: "data"
  }) {
    success
    message
  }
}
```

### Automated GraphQL Testing

```javascript
const axios = require('axios')

describe('Plugin GraphQL API', () => {
  let jwt

  beforeAll(async () => {
    // Login and get JWT
    const response = await axios.post('http://localhost:3000/graphql', {
      query: `
        mutation {
          authentication {
            login(username: "admin", password: "password", strategy: "local") {
              jwt
            }
          }
        }
      `
    })

    jwt = response.data.data.authentication.login.jwt
  })

  test('should query plugin data', async () => {
    const response = await axios.post(
      'http://localhost:3000/graphql',
      {
        query: `
          query {
            myPluginData {
              success
              data { id name }
            }
          }
        `
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    )

    expect(response.data.data.myPluginData.success).toBe(true)
    expect(response.data.data.myPluginData.data).toBeInstanceOf(Array)
  })

  test('should execute plugin mutation', async () => {
    const response = await axios.post(
      'http://localhost:3000/graphql',
      {
        query: `
          mutation($input: MyPluginInput!) {
            myPluginAction(input: $input) {
              success
              message
            }
          }
        `,
        variables: {
          input: {
            name: 'test',
            value: 'data'
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      }
    )

    expect(response.data.data.myPluginAction.success).toBe(true)
  })
})
```

---

## Debugging

### Enable Debug Logging

Set `NODE_ENV=development` and debug level to see plugin logs:

```bash
NODE_ENV=development DEBUG=* yarn dev
```

### Add Debug Logs

```javascript
async activated() {
  this.logger.debug('Activation started')
  this.logger.debug('Config:', this.config.get())
  this.logger.debug('Connecting to service...')

  try {
    this.client = await connect()
    this.logger.debug('Connected successfully')
  } catch (error) {
    this.logger.error('Connection failed', error)
    throw error
  }
}
```

### Inspect Plugin State

Add a custom GraphQL query for debugging:

```graphql
# In graphql/schema.graphql
extend type Query {
  myPluginDebugInfo: JSON
}
```

```javascript
// In graphql/resolvers.js
module.exports = {
  Query: {
    myPluginDebugInfo(obj, args, context) {
      return {
        status: context.plugin.status,
        config: context.plugin.config,
        internalState: context.plugin.internalState
      }
    }
  }
}
```

### Check Plugin Files

Verify plugin files are in the correct location:

```bash
ls -la /path/to/wiki-js/plugins/installed/my-plugin/
# Should show:
# plugin.yml
# server/index.js
# package.json (if dependencies)
```

### Check Database Records

Query the database directly:

```sql
SELECT * FROM plugins WHERE id = 'my-plugin';
SELECT * FROM pluginErrors WHERE pluginId = 'my-plugin';
```

---

## Test Coverage

Aim for high test coverage:

- **Lifecycle methods**: 100%
- **Hooks**: 100%
- **Error handling**: 90%+
- **Configuration**: 90%+
- **Database operations**: 80%+

Run coverage:

```bash
yarn jest --coverage server/test/plugins/
```

---

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Plugin Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: yarn install

      - name: Run tests
        run: yarn jest server/test/plugins/

      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## Best Practices

1. **Test all lifecycle methods** - init, activated, deactivated
2. **Test all hooks** - Ensure hooks receive correct data
3. **Test error cases** - Missing config, failed connections, etc.
4. **Mock external services** - Don't make real API calls in tests
5. **Use descriptive test names** - `should handle page save when config is valid`
6. **Clean up after tests** - Remove test data, close connections
7. **Test permissions** - Verify APIs are only available with correct permissions
8. **Test GraphQL** - If your plugin extends GraphQL

---

## Next Steps

- Review [Getting Started Guide](./getting-started.md)
- Check [API Reference](./api-reference.md)
- Explore [Advanced Topics](./advanced.md)
