# Plugin Extension Points

## Overview

Wiki.js plugins can extend functionality at multiple points in the application. This document details all available extension points and how to use them.

## Server-Side Extension Points

### 1. Lifecycle Hooks

Hook into application events to execute custom logic.

**Required Permission**: `hooks:register`

**Available Hooks**:

#### Application Hooks
- `app:start` - Fired when Wiki.js starts
- `app:shutdown` - Fired when Wiki.js shuts down gracefully

#### Page Hooks
- `page:render` - Before a page is rendered for display
- `page:save` - When a page is saved (create or update)
- `page:delete` - When a page is deleted
- `page:move` - When a page is moved to a new path
- `page:restore` - When a deleted page is restored

#### User Hooks
- `user:create` - When a new user account is created
- `user:login` - When a user successfully logs in
- `user:logout` - When a user logs out
- `user:delete` - When a user account is deleted

#### Asset Hooks
- `asset:upload` - When a file is uploaded
- `asset:delete` - When an asset is deleted
- `asset:rename` - When an asset is renamed

#### Search Hooks
- `search:index` - When content is indexed for search
- `search:query` - When a search query is performed

**Usage**:

In `plugin.yml`:
```yaml
hooks:
  - event: page:save
    handler: onPageSave
  - event: user:login
    handler: onUserLogin
```

In `server/index.js`:
```javascript
module.exports = {
  async onPageSave(event) {
    const { page } = event
    this.logger.info(`Page saved: ${page.title}`)
    
    // Access page data
    console.log(page.id, page.path, page.content)
    
    // Your custom logic
    await this.sendNotification(`Page "${page.title}" was updated`)
  },

  async onUserLogin(event) {
    const { user } = event
    this.logger.info(`User logged in: ${user.email}`)
    
    // Track login analytics
    await this.trackEvent('user.login', {
      userId: user.id,
      timestamp: new Date()
    })
  }
}
```

**Event Data Structures**:

```javascript
// page:save
{ page: { id, path, title, content, isPublished, authorId, authorName, ... } }

// user:login
{ user: { id, email, name, isAdmin, ... } }

// asset:upload
{ asset: { id, filename, path, size, ext, mime, ... } }
```

### 2. Database Models

Register custom database tables using Objection.js ORM.

**Required Permission**: `database:write`

**Table Naming**: All plugin tables must be prefixed with `plugin_<plugin-id>_`

**Usage**:

Create `server/models/MyModel.js`:
```javascript
const Model = require('objection').Model

class PluginMyPluginData extends Model {
  static get tableName() {
    return 'plugin_myplugin_data'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['pageId'],
      properties: {
        id: { type: 'integer' },
        pageId: { type: 'integer' },
        data: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  }
}

module.exports = PluginMyPluginData
```

Create migration in `migrations/20260129_create_data_table.js`:
```javascript
exports.up = async (knex) => {
  await knex.schema.createTable('plugin_myplugin_data', table => {
    table.increments('id').primary()
    table.integer('pageId').notNullable()
    table.json('data')
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    
    table.index('pageId')
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('plugin_myplugin_data')
}
```

Use in plugin code:
```javascript
async onPageSave(event) {
  const MyModel = require('./models/MyModel')
  
  await MyModel.query().insert({
    pageId: event.page.id,
    data: { timestamp: new Date() }
  })
}
```

### 3. API Routes (Express)

Add custom REST API endpoints.

**Required Permission**: `api:extend`

**Status**: Phase 2 (not yet implemented)

**Planned Usage**:

```javascript
// server/routes.js
module.exports = {
  async register(router) {
    router.get('/api/myplugin/stats', async (req, res) => {
      const stats = await this.getStats()
      res.json(stats)
    })

    router.post('/api/myplugin/webhook', async (req, res) => {
      await this.handleWebhook(req.body)
      res.sendStatus(200)
    })
  }
}
```

### 4. GraphQL Extensions

Extend the GraphQL schema with custom types, queries, and mutations.

**Required Permission**: `graphql:extend`

**⚠️ CRITICAL**: Requires server restart to activate/deactivate

**Usage**:

Create `graphql/schema.graphql`:
```graphql
extend type Query {
  myPluginData(pageId: Int!): MyPluginData
}

extend type Mutation {
  myPluginUpdate(pageId: Int!, data: JSON!): DefaultResponse
}

type MyPluginData {
  id: Int!
  pageId: Int!
  data: JSON
  createdAt: Date!
}
```

Create `graphql/resolvers.js`:
```javascript
module.exports = {
  Query: {
    async myPluginData(obj, args, context, info) {
      const MyModel = require('../server/models/MyModel')
      return await MyModel.query()
        .where('pageId', args.pageId)
        .first()
    }
  },
  
  Mutation: {
    async myPluginUpdate(obj, args, context, info) {
      // Check authentication
      if (!context.req.user || !context.req.user.permissions.includes('manage:system')) {
        throw new Error('Unauthorized')
      }
      
      const MyModel = require('../server/models/MyModel')
      await MyModel.query()
        .insert({
          pageId: args.pageId,
          data: args.data
        })
      
      return {
        responseResult: {
          succeeded: true,
          message: 'Data updated successfully'
        }
      }
    }
  }
}
```

**Restart Detection**: When activating/deactivating, the system detects GraphQL extensions and returns `requiresRestart: true`.

### 5. Background Jobs

Schedule background tasks.

**Required Permission**: `core:read` (to access scheduler)

**Status**: Phase 2 (not yet implemented)

**Planned Usage**:

```javascript
async activated() {
  // Schedule job every hour
  this.jobId = this.WIKI.scheduler.registerJob('0 * * * *', async () => {
    await this.performHourlyTask()
  })
}

async deactivated() {
  // Cleanup job
  this.WIKI.scheduler.unregisterJob(this.jobId)
}
```

### 6. Custom Events

Emit and listen to custom events for inter-plugin communication.

**Required Permissions**: `events:emit`, `events:listen`

**Usage**:

Emit events:
```javascript
async onPageSave(event) {
  // Notify other plugins
  this.events.emit('myplugin:page-analyzed', {
    pageId: event.page.id,
    score: 95,
    tags: ['important', 'featured']
  })
}
```

Listen to events:
```javascript
async init() {
  // Listen to events from other plugins
  this.events.on('otherplugin:data-updated', (data) => {
    this.logger.info('Received data from other plugin', data)
  })
  
  // Wildcard listeners
  this.events.on('myplugin:*', (data) => {
    this.logger.debug('My plugin event:', data)
  })
}
```

## Client-Side Extension Points

**Status**: Phase 2 (not yet implemented)

**⚠️ CRITICAL**: Requires `yarn build` (~30s) and page reload

### 1. Vue Components

Register reusable Vue components.

**Required Permission**: `ui:extend`

**Planned Structure**:

```
client/
├── components/
│   ├── MyWidget.vue
│   └── MyDialog.vue
└── index.js
```

**Planned Usage**:

```javascript
// client/index.js
export default {
  components: {
    'my-widget': () => import('./components/MyWidget.vue'),
    'my-dialog': () => import('./components/MyDialog.vue')
  }
}
```

### 2. Admin Pages

Add full pages to the admin panel.

**Required Permission**: `ui:pages`

**Planned Usage**:

```javascript
// client/pages/Settings.vue
<template>
  <v-container>
    <v-card>
      <v-card-title>My Plugin Settings</v-card-title>
      <v-card-text>
        <!-- Your UI here -->
      </v-card-text>
    </v-card>
  </v-container>
</template>

// In plugin.yml
menuItems:
  - title: My Plugin
    icon: mdi-puzzle
    route: /plugins/myplugin/settings
    permission: manage:system
```

### 3. UI Injection Points

Inject components into existing pages at predefined slots.

**Required Permission**: `ui:extend`

**Planned Injection Points**:
- `page-toolbar` - Page view toolbar
- `editor-sidebar` - Editor sidebar
- `admin-dashboard` - Admin dashboard widgets
- `page-footer` - Page footer
- `navigation-menu` - Navigation menu items

**Planned Usage**:

```javascript
// plugin.yml
injections:
  - slot: page-toolbar
    component: MyToolbarButton
    position: end
  - slot: editor-sidebar
    component: MyEditorPanel
```

### 4. Vuex Store Modules

Register Vuex state management modules.

**Planned Usage**:

```javascript
// client/store/index.js
export default {
  namespaced: true,
  state: {
    data: []
  },
  mutations: {
    SET_DATA(state, data) {
      state.data = data
    }
  },
  actions: {
    async fetchData({ commit }) {
      const response = await this.$apollo.query({ ... })
      commit('SET_DATA', response.data)
    }
  }
}
```

## Storage and Data

### 1. Plugin-Specific Storage

Store files in plugin-specific directory.

**Required Permission**: `storage:read`, `storage:write`

**Usage**:

```javascript
// Write file
await this.storage.writeFile('data.json', JSON.stringify({ ... }))

// Read file
const content = await this.storage.readFile('data.json')
const data = JSON.parse(content)

// Check existence
if (await this.storage.exists('cache.json')) {
  // ...
}

// Delete file
await this.storage.delete('temp.txt')

// List files
const files = await this.storage.list('backups/')
```

**Storage Location**: `/plugins/data/<plugin-id>/`

### 2. Cache

Use in-memory cache for temporary data.

**Required Permission**: `cache:read`, `cache:write`

**Usage**:

```javascript
// Set with TTL (seconds)
await this.cache.set('api-response', data, 3600)

// Get
const cached = await this.cache.get('api-response')

// Delete
await this.cache.del('api-response')

// Check existence
if (await this.cache.has('api-response')) {
  // ...
}
```

## Configuration

### Configuration Schema

Define configuration UI in manifest.

**Usage**:

```yaml
config:
  schema:
    type: object
    properties:
      apiKey:
        type: string
        title: API Key
        description: Your service API key
        format: password
      apiUrl:
        type: string
        title: API URL
        default: https://api.example.com
        format: uri
      enabled:
        type: boolean
        title: Enable Integration
        default: true
      refreshInterval:
        type: integer
        title: Refresh Interval (seconds)
        minimum: 60
        maximum: 86400
        default: 3600
      features:
        type: array
        title: Enabled Features
        items:
          type: string
          enum: [feature1, feature2, feature3]
        uniqueItems: true
    required:
      - apiKey
```

**Access Configuration**:

```javascript
async init() {
  const config = await this.config.get()
  
  if (!config.enabled) {
    this.logger.info('Plugin is disabled')
    return
  }
  
  this.apiKey = config.apiKey
  this.apiUrl = config.apiUrl
  this.refreshInterval = config.refreshInterval
}
```

**Update Configuration** (requires `config:write`):

```javascript
await this.config.set({
  lastSync: new Date().toISOString(),
  recordsProcessed: 1500
})
```

## Database Access

### Read Core Models

Access Wiki.js core models (read-only).

**Required Permission**: `core:read`

**Usage**:

```javascript
// Query pages
const pages = await this.WIKI.models.pages
  .query()
  .where('isPublished', true)
  .orderBy('createdAt', 'desc')
  .limit(10)

// Query users
const admins = await this.WIKI.models.users
  .query()
  .where('isAdmin', true)

// Query assets
const images = await this.WIKI.models.assets
  .query()
  .where('kind', 'image')
```

**Available Models**:
- `pages` - Wiki pages
- `users` - User accounts
- `groups` - User groups
- `assets` - Uploaded files
- `comments` - Page comments
- `pageHistory` - Page version history
- `navigation` - Navigation menus
- `tags` - Page tags

### Raw Database Queries

Execute raw SQL queries.

**Required Permission**: `database:read` or `database:write`

**Usage**:

```javascript
// SELECT query
const results = await this.db.knex('pages')
  .select('id', 'title', 'path')
  .where('isPublished', true)
  .orderBy('createdAt', 'desc')

// INSERT query
await this.db.knex('plugin_myplugin_logs').insert({
  action: 'page_viewed',
  pageId: 123,
  createdAt: new Date()
})

// UPDATE query
await this.db.knex('plugin_myplugin_stats')
  .where('id', 1)
  .update({ views: this.db.knex.raw('views + 1') })

// DELETE query
await this.db.knex('plugin_myplugin_cache')
  .where('expiresAt', '<', new Date())
  .delete()
```

## External Integrations

### HTTP Requests

Make HTTP requests to external services.

**Required Permission**: `network:external`

**Status**: Phase 2 (not yet implemented)

**Planned Usage**:

```javascript
const axios = require('axios')

async function syncWithExternalService() {
  try {
    const response = await axios.post(this.config.get('webhookUrl'), {
      event: 'page.updated',
      data: pageData
    })
    
    this.logger.info('Webhook sent successfully')
  } catch (error) {
    this.logger.error('Failed to send webhook', error)
  }
}
```

## Internationalization

### Translation Files

Provide translations for multiple languages.

**Structure**:

```
locales/
├── en.yml
├── fr.yml
├── de.yml
└── es.yml
```

**Format** (YAML):

```yaml
# locales/en.yml
title: My Plugin
description: A plugin that does amazing things
settings:
  apiKey: API Key
  enabled: Enable Plugin
messages:
  success: Operation completed successfully
  error: An error occurred
```

**Status**: Phase 2 (not yet implemented)

## Testing Extension Points

### Unit Testing Hooks

```javascript
const plugin = require('./server/index')
const context = createMockContext()

test('onPageSave hook', async () => {
  const event = {
    page: { id: 1, title: 'Test Page' }
  }
  
  await plugin.onPageSave.call(context, event)
  
  expect(context.logger.info).toHaveBeenCalledWith('Page saved: Test Page')
})
```

### Integration Testing Database

```javascript
test('database model', async () => {
  const MyModel = require('./server/models/MyModel')
  
  const record = await MyModel.query().insert({
    pageId: 123,
    data: { test: true }
  })
  
  expect(record.id).toBeDefined()
  expect(record.pageId).toBe(123)
})
```

## Best Practices

### Hook Performance
- Keep hook handlers fast (< 100ms)
- Use background jobs for long-running tasks
- Avoid blocking the event loop

### Database
- Always use indexed columns in WHERE clauses
- Limit result sets with `.limit()`
- Use transactions for multi-step operations
- Prefix all plugin tables with `plugin_<id>_`

### Configuration
- Validate configuration on `activated()`
- Provide sensible defaults
- Use JSON Schema validation
- Document all config options

### Error Handling
- Always wrap async code in try-catch
- Log errors with context
- Don't crash on external service failures
- Validate input data

### Security
- Never store secrets in plaintext
- Validate and sanitize all user input
- Use parameterized queries (prevent SQL injection)
- Check permissions before sensitive operations

## Migration Path from Modules

Existing Wiki.js modules (authentication, search, storage) will be converted to plugins in future phases. Key differences:

**Modules** (current):
- Hardcoded in core
- Defined in `definition.yml`
- Loaded at server start

**Plugins** (future):
- Dynamic installation
- Defined in `plugin.yml`
- Activate/deactivate without restart (except GraphQL)

## Related Documentation

- [Getting Started Guide](./getting-started.md) - Create your first plugin
- [API Reference](./api-reference.md) - Complete API documentation
- [Architecture Overview](./architecture.md) - System architecture
- [Testing Guide](./testing.md) - How to test plugins
- [Best Practices](./best-practices.md) - Security and performance guidelines
