# Plugin Development Guide - Getting Started

## Overview

Wiki.js plugins allow you to extend the functionality of Wiki.js without modifying the core codebase. This guide will help you create your first plugin in under 30 minutes.

## Prerequisites

- **Node.js 18+** installed
- **Wiki.js 2.5+** running locally
- Basic knowledge of **JavaScript** and **async/await**
- Familiarity with **Vue.js 2** (for UI plugins)

## Quick Start

### 1. Create Plugin Directory

Create a new directory for your plugin in `/plugins/installed/`:

```bash
cd /path/to/wiki-js
mkdir -p plugins/installed/my-plugin
cd plugins/installed/my-plugin
```

### 2. Create Plugin Manifest

Create `plugin.yml` with your plugin metadata:

```yaml
id: my-plugin
name: My Awesome Plugin
version: 1.0.0
description: A plugin that does amazing things
author: Your Name
license: MIT

compatibility:
  wikijs: '>=2.5.0'
  node: '>=18.0.0'

permissions:
  - config:read
  - events:emit
  - database:read

config:
  schema:
    type: object
    properties:
      enabled:
        type: boolean
        default: true
      apiKey:
        type: string
        description: API key for external service
    required: []

hooks:
  page:save: true
  user:login: true
```

### 3. Create Server Entry Point

Create `server/index.js` with lifecycle hooks:

```javascript
module.exports = {
  /**
   * Initialize plugin (called once when loaded)
   */
  async init() {
    this.logger.info('My plugin initialized!')
    // Setup code here
  },

  /**
   * Called when plugin is activated
   */
  async activated() {
    this.logger.info('My plugin activated!')
    // Start services, register routes, etc.
  },

  /**
   * Called when plugin is deactivated
   */
  async deactivated() {
    this.logger.info('My plugin deactivated!')
    // Cleanup resources
  },

  /**
   * Event hooks
   */
  hooks: {
    /**
     * Called when a page is saved
     */
    'page:save': async function(page) {
      this.logger.info(`Page saved: ${page.title}`)

      // Access plugin config
      if (this.config.get('enabled')) {
        // Do something with the page
      }
    },

    /**
     * Called when a user logs in
     */
    'user:login': async function(user) {
      this.logger.info(`User logged in: ${user.email}`)
    }
  }
}
```

### 4. Test Your Plugin

Start Wiki.js in development mode:

```bash
yarn dev
```

Your plugin will be automatically discovered and can be activated via the GraphQL API.

## Using the Plugin Context API

Your plugin has access to a rich context API through the `this` object:

### Logger

```javascript
this.logger.info('Info message')
this.logger.warn('Warning message')
this.logger.error('Error message', error)
this.logger.debug('Debug message', { data })
```

### Plugin Metadata

```javascript
this.plugin.id        // 'my-plugin'
this.plugin.version   // '1.0.0'
this.plugin.path      // '/path/to/plugin'
this.plugin.config    // Plugin configuration object
```

### Configuration API (with config:read or config:write permission)

```javascript
// Get config value
const apiKey = this.config.get('apiKey')
const enabled = this.config.get('enabled', true) // with default

// Check if config key exists
if (this.config.has('apiKey')) {
  // ...
}

// Set config value (requires config:write permission)
this.config.set('lastRun', new Date())
```

### Database API (with database:read or database:write permission)

```javascript
// Access Knex query builder
const pages = await this.db.knex('pages')
  .where('isPublished', true)
  .select('id', 'title')

// Access Wiki.js models (read-only)
const users = await this.db.WIKI.models.users.query()
  .where('isActive', true)
```

### Events API (with events:emit or events:listen permission)

```javascript
// Emit custom event
this.events.emit('myplugin:event', { data: 'value' })

// Listen to custom events
this.events.on('myplugin:other', (data) => {
  this.logger.info('Event received', data)
})
```

### Storage API (with storage:read or storage:write permission)

```javascript
// Read file
const content = await this.storage.readFile('data/myfile.json')

// Write file
await this.storage.writeFile('data/output.txt', 'content')

// Check if file exists
if (await this.storage.exists('data/cache.json')) {
  // ...
}

// Delete file
await this.storage.delete('data/temp.txt')
```

### Cache API (with cache:read or cache:write permission)

```javascript
// Get cached value
const value = await this.cache.get('mykey')

// Set cached value (with TTL in seconds)
await this.cache.set('mykey', { data: 'value' }, 3600)

// Delete cached value
await this.cache.del('mykey')
```

## Available Hooks

Your plugin can hook into these lifecycle events:

### Application Hooks
- `app:start` - When Wiki.js starts
- `app:shutdown` - When Wiki.js shuts down

### Page Hooks
- `page:render` - Before a page is rendered
- `page:save` - When a page is saved
- `page:delete` - When a page is deleted
- `page:move` - When a page is moved
- `page:restore` - When a page is restored

### User Hooks
- `user:create` - When a user is created
- `user:login` - When a user logs in
- `user:logout` - When a user logs out
- `user:delete` - When a user is deleted

### Asset Hooks
- `asset:upload` - When an asset is uploaded
- `asset:delete` - When an asset is deleted
- `asset:rename` - When an asset is renamed

### Search Hooks
- `search:index` - When content is indexed
- `search:query` - When a search is performed

## Permissions System

Declare permissions your plugin needs in the manifest:

### Available Permissions

- `config:read` - Read plugin configuration
- `config:write` - Write plugin configuration
- `database:read` - Read from database
- `database:write` - Write to database
- `events:emit` - Emit events
- `events:listen` - Listen to events
- `network:http` - Make HTTP requests
- `network:external` - Access external services
- `storage:read` - Read from plugin storage
- `storage:write` - Write to plugin storage
- `cache:read` - Read from cache
- `cache:write` - Write to cache
- `ui:components` - Register UI components
- `ui:pages` - Add admin pages
- `graphql:extend` - Extend GraphQL schema
- `graphql:query` - Query GraphQL API

## Example Plugins

### Simple Logger Plugin

Logs all page saves:

```javascript
// server/index.js
module.exports = {
  async init() {
    this.logger.info('Page Logger initialized')
  },

  async activated() {
    this.logger.info('Page Logger activated')
  },

  hooks: {
    'page:save': async function(page) {
      this.logger.info(`Page "${page.title}" saved by ${page.authorName}`)
    }
  }
}
```

### Page Statistics Plugin

Tracks page view statistics:

```javascript
// server/index.js
module.exports = {
  async init() {
    this.stats = new Map()
  },

  async activated() {
    this.logger.info('Statistics plugin activated')
    await this.loadStats()
  },

  async loadStats() {
    if (await this.storage.exists('stats.json')) {
      const data = await this.storage.readFile('stats.json')
      this.stats = new Map(JSON.parse(data))
    }
  },

  async saveStats() {
    const data = JSON.stringify([...this.stats])
    await this.storage.writeFile('stats.json', data)
  },

  hooks: {
    'page:render': async function(page) {
      const count = this.stats.get(page.id) || 0
      this.stats.set(page.id, count + 1)

      // Save every 10 views
      if (count % 10 === 0) {
        await this.saveStats()
      }
    }
  }
}
```

### Webhook Notifier Plugin

Sends webhooks on page events:

```javascript
// server/index.js
const axios = require('axios')

module.exports = {
  async init() {
    this.webhookUrl = this.config.get('webhookUrl')
  },

  async sendWebhook(event, data) {
    if (!this.webhookUrl) return

    try {
      await axios.post(this.webhookUrl, {
        event,
        data,
        timestamp: new Date()
      })
      this.logger.info(`Webhook sent for ${event}`)
    } catch (error) {
      this.logger.error('Failed to send webhook', error)
    }
  },

  hooks: {
    'page:save': async function(page) {
      await this.sendWebhook('page.saved', {
        id: page.id,
        title: page.title,
        author: page.authorName
      })
    },

    'page:delete': async function(page) {
      await this.sendWebhook('page.deleted', {
        id: page.id,
        title: page.title
      })
    }
  }
}
```

## Next Steps

- Read the [API Reference](./api-reference.md) for detailed API documentation
- Learn about [Testing Your Plugin](./testing.md)
- Explore [Advanced Topics](./advanced.md) (GraphQL extensions, UI components)
- Check out [Best Practices](./best-practices.md)

## Common Issues

### Plugin Not Discovered

- Ensure plugin is in `/plugins/installed/` directory
- Check that `plugin.yml` or `plugin.json` exists
- Verify manifest syntax is valid YAML/JSON
- Restart Wiki.js or call `refreshPluginsFromDisk` mutation

### Permission Errors

- Ensure required permissions are declared in manifest
- Check that permission names are spelled correctly
- Remember: permissions are enforced at runtime

### Hook Not Triggering

- Verify hook name is correct (case-sensitive)
- Ensure plugin is activated, not just installed
- Check that hook is declared in manifest
- Look for errors in plugin logs

### Configuration Not Working

- Verify config schema is valid JSON Schema
- Ensure plugin has `config:read` permission
- Check that config values match schema types
- Use GraphQL to update config

## Support

- Documentation: https://docs.requarks.io/
- Community: https://discord.gg/rcxt9QS2jd
- Issues: https://github.com/requarks/wiki/issues
