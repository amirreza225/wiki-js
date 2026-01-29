# Plugin API Reference

Complete reference for the Wiki.js Plugin API.

## Table of Contents

- [Plugin Context](#plugin-context)
- [Lifecycle Methods](#lifecycle-methods)
- [Hooks System](#hooks-system)
- [Logger API](#logger-api)
- [Configuration API](#configuration-api)
- [Database API](#database-api)
- [Events API](#events-api)
- [Storage API](#storage-api)
- [Cache API](#cache-api)
- [HTTP API](#http-api)
- [GraphQL API](#graphql-api)

---

## Plugin Context

Every plugin method receives a context object as `this` with the following properties:

### `this.plugin`

Plugin metadata and information.

**Properties:**
- `id` (string) - Plugin unique identifier
- `version` (string) - Plugin version (semver)
- `path` (string) - Absolute path to plugin directory
- `config` (object) - Plugin configuration values

**Example:**
```javascript
async init() {
  console.log(this.plugin.id)      // 'my-plugin'
  console.log(this.plugin.version) // '1.0.0'
  console.log(this.plugin.path)    // '/path/to/plugins/installed/my-plugin'
  console.log(this.plugin.config)  // { enabled: true, apiKey: '...' }
}
```

### `this.logger`

Scoped logger for plugin messages. See [Logger API](#logger-api).

### `this.config`

Configuration API (requires `config:read` or `config:write` permission). See [Configuration API](#configuration-api).

### `this.db`

Database API (requires `database:read` or `database:write` permission). See [Database API](#database-api).

### `this.events`

Event emitter API (requires `events:emit` or `events:listen` permission). See [Events API](#events-api).

### `this.storage`

File storage API (requires `storage:read` or `storage:write` permission). See [Storage API](#storage-api).

### `this.cache`

Cache API (requires `cache:read` or `cache:write` permission). See [Cache API](#cache-api).

---

## Lifecycle Methods

Plugins can implement these lifecycle methods:

### `async init()`

Called once when the plugin is first loaded (before activation).

Use this for:
- One-time initialization
- Setting up internal state
- Validating dependencies

**Example:**
```javascript
async init() {
  this.logger.info('Initializing plugin')
  this.internalState = new Map()

  // Validate configuration
  if (!this.config.get('apiKey')) {
    throw new Error('API key is required')
  }
}
```

### `async activated()`

Called when the plugin is activated by an administrator.

Use this for:
- Starting services
- Registering hooks
- Connecting to external services

**Example:**
```javascript
async activated() {
  this.logger.info('Plugin activated')

  // Connect to external service
  this.client = await connectToService(this.config.get('apiKey'))

  // Load persisted data
  await this.loadData()
}
```

### `async deactivated()`

Called when the plugin is deactivated by an administrator.

Use this for:
- Cleaning up resources
- Closing connections
- Saving state

**Example:**
```javascript
async deactivated() {
  this.logger.info('Plugin deactivated')

  // Save state
  await this.saveData()

  // Close connections
  if (this.client) {
    await this.client.disconnect()
  }
}
```

---

## Hooks System

Plugins can register event hooks to respond to Wiki.js events.

### Defining Hooks

In your plugin manifest (`plugin.yml`), declare which hooks you'll use:

```yaml
hooks:
  page:save: true
  user:login: true
  asset:upload: true
```

In your plugin code, implement the hooks:

```javascript
module.exports = {
  // ... lifecycle methods ...

  hooks: {
    'page:save': async function(page) {
      // Handle page save event
    },

    'user:login': async function(user) {
      // Handle user login event
    }
  }
}
```

### Hook Context

Hook handlers are bound to the plugin context, so `this` refers to your plugin instance.

### Hook Data

Each hook receives different data:

#### Application Hooks

**`app:start`**
- Triggered when Wiki.js starts
- Data: `{}`

**`app:shutdown`**
- Triggered when Wiki.js shuts down
- Data: `{}`

#### Page Hooks

**`page:render`**
- Triggered before a page is rendered
- Data: `{ id, path, title, content, ... }`

**`page:save`**
- Triggered when a page is saved
- Data: `{ id, path, title, content, authorId, authorName, ... }`

**`page:delete`**
- Triggered when a page is deleted
- Data: `{ id, path, title }`

**`page:move`**
- Triggered when a page is moved
- Data: `{ id, oldPath, newPath, title }`

**`page:restore`**
- Triggered when a page is restored from history
- Data: `{ id, path, title, versionId }`

#### User Hooks

**`user:create`**
- Triggered when a user account is created
- Data: `{ id, email, name, ... }`

**`user:login`**
- Triggered when a user logs in
- Data: `{ id, email, name, provider }`

**`user:logout`**
- Triggered when a user logs out
- Data: `{ id, email }`

**`user:delete`**
- Triggered when a user is deleted
- Data: `{ id, email, name }`

#### Asset Hooks

**`asset:upload`**
- Triggered when an asset is uploaded
- Data: `{ id, filename, path, size, mime, ... }`

**`asset:delete`**
- Triggered when an asset is deleted
- Data: `{ id, filename, path }`

**`asset:rename`**
- Triggered when an asset is renamed
- Data: `{ id, oldFilename, newFilename, path }`

#### Search Hooks

**`search:index`**
- Triggered when content is indexed
- Data: `{ type, id, content }`

**`search:query`**
- Triggered when a search is performed
- Data: `{ query, filters, userId }`

### Hook Examples

```javascript
hooks: {
  // Log page saves
  'page:save': async function(page) {
    this.logger.info(`Page saved: ${page.title} by ${page.authorName}`)
  },

  // Send welcome email on user creation
  'user:create': async function(user) {
    await this.sendEmail(user.email, 'Welcome to the wiki!')
  },

  // Track asset uploads
  'asset:upload': async function(asset) {
    const stats = this.cache.get('upload-stats') || { count: 0, size: 0 }
    stats.count++
    stats.size += asset.size
    await this.cache.set('upload-stats', stats)
  }
}
```

---

## Logger API

All plugins have access to a scoped logger via `this.logger`.

### Methods

#### `logger.info(message, ...meta)`

Log informational message.

```javascript
this.logger.info('Plugin started')
this.logger.info('Processing page', { pageId: 123 })
```

#### `logger.warn(message, ...meta)`

Log warning message.

```javascript
this.logger.warn('API rate limit approaching')
this.logger.warn('Missing optional config', { key: 'timeout' })
```

#### `logger.error(message, ...meta)`

Log error message.

```javascript
this.logger.error('Failed to connect to service', error)
this.logger.error('Invalid data', { received: data, expected: schema })
```

#### `logger.debug(message, ...meta)`

Log debug message (only shown when debug logging is enabled).

```javascript
this.logger.debug('Processing item', { id: item.id, step: 'validation' })
```

### Log Format

All log messages are automatically prefixed with `[Plugin:plugin-id]`:

```
[Plugin:my-plugin] Plugin started
[Plugin:my-plugin] Processing page { pageId: 123 }
```

---

## Configuration API

**Requires:** `config:read` or `config:write` permission

Access and modify plugin configuration via `this.config`.

### Methods

#### `config.get(key, defaultValue?)`

Get configuration value by key.

**Parameters:**
- `key` (string) - Configuration key
- `defaultValue` (any, optional) - Value to return if key doesn't exist

**Returns:** Configuration value or default

```javascript
const apiKey = this.config.get('apiKey')
const timeout = this.config.get('timeout', 5000)
const enabled = this.config.get('enabled', true)
```

#### `config.set(key, value)`

Set configuration value (requires `config:write` permission).

**Parameters:**
- `key` (string) - Configuration key
- `value` (any) - Value to set

**Returns:** void

**Note:** This only updates the in-memory config. Use GraphQL mutation to persist changes.

```javascript
this.config.set('lastRun', new Date().toISOString())
this.config.set('counter', this.config.get('counter', 0) + 1)
```

#### `config.has(key)`

Check if configuration key exists.

**Parameters:**
- `key` (string) - Configuration key

**Returns:** boolean

```javascript
if (this.config.has('apiKey')) {
  // API key is configured
} else {
  this.logger.warn('API key not configured')
}
```

#### `config.delete(key)`

Delete configuration key (requires `config:write` permission).

**Parameters:**
- `key` (string) - Configuration key to delete

**Returns:** void

```javascript
this.config.delete('temporaryValue')
```

### Configuration Schema

Define your config schema in the plugin manifest:

```yaml
config:
  schema:
    type: object
    properties:
      apiKey:
        type: string
        description: API key for external service
      timeout:
        type: number
        default: 5000
        description: Request timeout in milliseconds
      enabled:
        type: boolean
        default: true
      features:
        type: array
        items:
          type: string
        default: []
    required:
      - apiKey
```

---

## Database API

**Requires:** `database:read` or `database:write` permission

Access the database via `this.db`.

### Properties

#### `db.knex`

Knex.js query builder instance. Use for raw queries.

```javascript
// Select pages
const pages = await this.db.knex('pages')
  .where('isPublished', true)
  .select('id', 'title', 'path')

// Count users
const userCount = await this.db.knex('users').count('* as count')

// Insert record (requires database:write)
await this.db.knex('plugin_my_table').insert({
  name: 'value',
  createdAt: new Date()
})

// Update record (requires database:write)
await this.db.knex('plugin_my_table')
  .where('id', 123)
  .update({ status: 'processed' })
```

#### `db.models`

Plugin-scoped database models. Models you define in your plugin.

**Note:** Core Wiki.js models are read-only. See `db.WIKI` for read-only access.

```javascript
// Assuming you defined a model in plugin migrations
const records = await this.db.models.MyModel.query()
  .where('status', 'active')
```

#### `db.WIKI`

Read-only access to core Wiki.js models.

```javascript
// Get active users
const users = await this.db.WIKI.models.users.query()
  .where('isActive', true)

// Get published pages
const pages = await this.db.WIKI.models.pages.query()
  .where('isPublished', true)
  .select('id', 'title', 'path')

// Get groups
const groups = await this.db.WIKI.models.groups.query()
```

### Database Tables

Plugin tables must be prefixed with `plugin_<plugin-id>_`:

```javascript
// Correct
await this.db.knex('plugin_my-plugin_events').insert({ ... })

// Incorrect (will fail validation)
await this.db.knex('my_events').insert({ ... })
```

---

## Events API

**Requires:** `events:emit` or `events:listen` permission

Emit and listen to custom events via `this.events`.

### Methods

#### `events.emit(eventName, data)`

Emit a custom event.

**Parameters:**
- `eventName` (string) - Event name (use colon notation: `plugin:event`)
- `data` (any) - Event data

```javascript
// Emit custom event
this.events.emit('myplugin:processed', {
  id: 123,
  result: 'success'
})

// Other plugins can listen to this event
```

#### `events.on(eventName, handler)`

Listen to custom events.

**Parameters:**
- `eventName` (string) - Event name (supports wildcards)
- `handler` (function) - Event handler

```javascript
// Listen to specific event
this.events.on('otherplugin:notification', (data) => {
  this.logger.info('Notification received', data)
})

// Listen to wildcard events
this.events.on('otherplugin:*', (data) => {
  this.logger.debug('Event from otherplugin', data)
})
```

#### `events.once(eventName, handler)`

Listen to event once (auto-remove after first trigger).

```javascript
this.events.once('myplugin:init', () => {
  this.logger.info('Initialization complete')
})
```

#### `events.off(eventName, handler)`

Remove event listener.

```javascript
const handler = (data) => console.log(data)
this.events.on('event', handler)

// Later...
this.events.off('event', handler)
```

---

## Storage API

**Requires:** `storage:read` or `storage:write` permission

Access plugin-specific file storage via `this.storage`.

All file paths are relative to `/plugins/data/<plugin-id>/`.

### Methods

#### `async storage.readFile(path)`

Read file contents.

**Parameters:**
- `path` (string) - Relative file path

**Returns:** Promise<string>

```javascript
const data = await this.storage.readFile('cache/data.json')
const config = JSON.parse(data)
```

#### `async storage.writeFile(path, content)`

Write file contents (requires `storage:write` permission).

**Parameters:**
- `path` (string) - Relative file path
- `content` (string) - File contents

**Returns:** Promise<void>

```javascript
const data = JSON.stringify({ timestamp: Date.now() })
await this.storage.writeFile('cache/data.json', data)
```

#### `async storage.exists(path)`

Check if file exists.

**Parameters:**
- `path` (string) - Relative file path

**Returns:** Promise<boolean>

```javascript
if (await this.storage.exists('cache/data.json')) {
  const data = await this.storage.readFile('cache/data.json')
}
```

#### `async storage.delete(path)`

Delete file (requires `storage:write` permission).

**Parameters:**
- `path` (string) - Relative file path

**Returns:** Promise<void>

```javascript
await this.storage.delete('temp/old-data.json')
```

#### `async storage.list(path)`

List files in directory.

**Parameters:**
- `path` (string) - Relative directory path

**Returns:** Promise<string[]>

```javascript
const files = await this.storage.list('cache')
// ['data.json', 'index.txt', ...]
```

---

## Cache API

**Requires:** `cache:read` or `cache:write` permission

Access in-memory cache via `this.cache`.

### Methods

#### `async cache.get(key)`

Get cached value.

**Parameters:**
- `key` (string) - Cache key

**Returns:** Promise<any | null>

```javascript
const value = await this.cache.get('user:123')
if (value) {
  // Use cached value
} else {
  // Fetch and cache
}
```

#### `async cache.set(key, value, ttl?)`

Set cached value (requires `cache:write` permission).

**Parameters:**
- `key` (string) - Cache key
- `value` (any) - Value to cache
- `ttl` (number, optional) - Time to live in seconds

**Returns:** Promise<void>

```javascript
// Cache for 1 hour
await this.cache.set('user:123', userData, 3600)

// Cache indefinitely
await this.cache.set('config', configData)
```

#### `async cache.del(key)`

Delete cached value (requires `cache:write` permission).

**Parameters:**
- `key` (string) - Cache key

**Returns:** Promise<void>

```javascript
await this.cache.del('user:123')
```

---

## HTTP API

**Requires:** `network:http` or `network:external` permission

Make HTTP requests using standard Node.js libraries.

**Note:** HTTP API is not directly provided. Use `axios` or `node-fetch` as dependencies.

### Example

```javascript
// In your plugin's package.json
{
  "dependencies": {
    "axios": "^1.6.0"
  }
}

// In your plugin code
const axios = require('axios')

async activated() {
  const response = await axios.get('https://api.example.com/data')
  this.logger.info('Fetched data', response.data)
}
```

---

## GraphQL API

**Requires:** `graphql:extend` or `graphql:query` permission

### Extending GraphQL Schema

**⚠️ IMPORTANT:** GraphQL extensions require server restart to take effect.

Create `graphql/schema.graphql`:

```graphql
extend type Query {
  myPluginData: MyPluginDataResult
}

extend type Mutation {
  myPluginAction(input: MyPluginInput!): MyPluginResult
}

type MyPluginDataResult {
  success: Boolean!
  data: [MyPluginItem!]
}

type MyPluginItem {
  id: Int!
  name: String!
  value: String
}

input MyPluginInput {
  name: String!
  value: String
}

type MyPluginResult {
  success: Boolean!
  message: String
}
```

Create `graphql/resolvers.js`:

```javascript
module.exports = {
  Query: {
    async myPluginData(obj, args, context, info) {
      // context has access to plugin instance
      const data = await context.plugin.fetchData()
      return {
        success: true,
        data
      }
    }
  },

  Mutation: {
    async myPluginAction(obj, args, context, info) {
      const { input } = args

      // Perform action
      await context.plugin.doAction(input)

      return {
        success: true,
        message: 'Action completed'
      }
    }
  }
}
```

---

## Error Handling

Always wrap plugin code in try-catch blocks:

```javascript
async activated() {
  try {
    await this.connectToService()
  } catch (error) {
    this.logger.error('Failed to connect', error)
    throw error // Propagate to mark plugin as errored
  }
}

hooks: {
  'page:save': async function(page) {
    try {
      await this.processPage(page)
    } catch (error) {
      this.logger.error('Failed to process page', error)
      // Don't throw - allow other hooks to execute
    }
  }
}
```

---

## Best Practices

1. **Always use scoped logger** - Never use console.log
2. **Validate configuration** - Check required config in init()
3. **Handle errors gracefully** - Don't crash the entire system
4. **Clean up resources** - Use deactivated() hook
5. **Use async/await** - All lifecycle methods and hooks are async
6. **Respect permissions** - Only request permissions you need
7. **Document your plugin** - Include README.md
8. **Test thoroughly** - Test all hooks and edge cases

---

## Next Steps

- See [Getting Started Guide](./getting-started.md) for examples
- Learn about [Testing Your Plugin](./testing.md)
- Explore [Advanced Topics](./advanced.md)
