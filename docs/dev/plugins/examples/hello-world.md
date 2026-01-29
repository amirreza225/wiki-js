# Example: Hello World Plugin

This document provides a complete walkthrough of the hello-world example plugin included with Wiki.js.

## Overview

The hello-world plugin demonstrates:
- Plugin manifest structure
- Lifecycle methods (`init`, `activated`, `deactivated`)
- Hook registration (`page:save`, `user:login`)
- Configuration access
- Logging
- Permission requests

## File Structure

```
plugins/installed/hello-world/
├── plugin.yml          # Plugin manifest
├── README.md           # Documentation
└── server/
    └── index.js        # Main entry point
```

## Plugin Manifest (`plugin.yml`)

```yaml
id: hello-world
title: Hello World Plugin
version: 1.0.0
description: A simple example plugin demonstrating basic features
author: Wiki.js
license: MIT

compatibility:
  wikijs: '>=2.5.0'

permissions:
  - hooks:register
  - logger:use
  - config:read
  - core:read

config:
  schema:
    type: object
    properties:
      enabled:
        type: boolean
        title: Enable Plugin
        default: true
      message:
        type: string
        title: Custom Message
        default: 'Hello from Hello World plugin!'
    required: []

hooks:
  - event: page:save
    handler: onPageSave
  - event: user:login
    handler: onUserLogin
```

### Manifest Breakdown

#### Basic Information
```yaml
id: hello-world              # Unique identifier (kebab-case)
title: Hello World Plugin    # Display name
version: 1.0.0              # Semantic version
description: A simple...     # Brief description
author: Wiki.js             # Author name
license: MIT                # License type
```

#### Compatibility
```yaml
compatibility:
  wikijs: '>=2.5.0'  # Requires Wiki.js 2.5.0 or higher
```

#### Permissions
```yaml
permissions:
  - hooks:register   # Register lifecycle hooks
  - logger:use       # Use logging
  - config:read      # Read plugin configuration
  - core:read        # Read core Wiki.js models
```

#### Configuration Schema
```yaml
config:
  schema:
    type: object
    properties:
      enabled:
        type: boolean
        title: Enable Plugin
        default: true
      message:
        type: string
        title: Custom Message
        default: 'Hello from Hello World plugin!'
```

This creates a configuration UI with two fields:
- A checkbox for "Enable Plugin"
- A text input for "Custom Message"

#### Hooks
```yaml
hooks:
  - event: page:save         # When a page is saved
    handler: onPageSave      # Call this function
  - event: user:login        # When a user logs in
    handler: onUserLogin     # Call this function
```

## Server Entry Point (`server/index.js`)

```javascript
/**
 * Hello World Plugin
 * Demonstrates basic plugin functionality
 */

/**
 * Initialize plugin (called once when plugin is activated)
 */
async function init() {
  this.logger.info('Hello World Plugin initialized!')
  
  // Access configuration
  const config = await this.config.get()
  if (config.enabled) {
    this.logger.info(`Plugin is enabled. Message: ${config.message}`)
  }
  
  // Access Wiki.js version (requires core:read permission)
  if (this.WIKI) {
    this.logger.info(`Running on Wiki.js version: ${this.WIKI.version}`)
  }
}

/**
 * Plugin activation (called when plugin is activated)
 */
async function activated() {
  this.logger.info('Hello World Plugin activated!')
  this.logger.info('Hooks registered: page:save, user:login')
}

/**
 * Plugin deactivation (called when plugin is deactivated)
 */
async function deactivated() {
  this.logger.info('Hello World Plugin deactivated!')
  this.logger.info('Hooks unregistered')
}

/**
 * Hook: page:save
 * Called when a page is saved (created or updated)
 * @param {Object} event - Event data
 * @param {Object} event.page - The page that was saved
 */
async function onPageSave(event) {
  const { page } = event
  
  this.logger.info(`Page saved: "${page.title}" (ID: ${page.id})`)
  this.logger.debug(`Page path: ${page.path}`)
  this.logger.debug(`Author: ${page.authorName}`)
  
  // You could perform additional actions here:
  // - Send notifications
  // - Update search index
  // - Trigger webhooks
  // - Generate analytics
  // - Store metadata in database
}

/**
 * Hook: user:login
 * Called when a user successfully logs in
 * @param {Object} event - Event data
 * @param {Object} event.user - The user who logged in
 */
async function onUserLogin(event) {
  const { user } = event
  
  this.logger.info(`User logged in: ${user.email}`)
  this.logger.debug(`User ID: ${user.id}`)
  this.logger.debug(`Is Admin: ${user.isAdmin}`)
  
  // You could perform additional actions here:
  // - Track login statistics
  // - Send welcome notifications
  // - Update user activity records
  // - Trigger security checks
}

// Export all functions
module.exports = {
  init,
  activated,
  deactivated,
  onPageSave,
  onUserLogin
}
```

### Code Breakdown

#### Lifecycle Methods

**`init()`** - Called once when plugin is first activated:
```javascript
async function init() {
  // Setup code here
  // Initialize connections, load data, etc.
  
  const config = await this.config.get()
  // Access configuration
}
```

**`activated()`** - Called each time plugin is activated:
```javascript
async function activated() {
  // Start services
  // Register routes
  // Open connections
}
```

**`deactivated()`** - Called when plugin is deactivated:
```javascript
async function deactivated() {
  // Cleanup resources
  // Close connections
  // Stop background tasks
}
```

#### Hook Handlers

**Hook functions receive event data**:
```javascript
async function onPageSave(event) {
  const { page } = event
  // page.id, page.title, page.content, page.authorName, etc.
}

async function onUserLogin(event) {
  const { user } = event
  // user.id, user.email, user.name, user.isAdmin, etc.
}
```

#### Plugin Context (`this` object)

**Logger**:
```javascript
this.logger.info('Info message')
this.logger.warn('Warning message')
this.logger.error('Error message', error)
this.logger.debug('Debug message', { data })
```

**Configuration API** (requires `config:read` permission):
```javascript
const config = await this.config.get()
console.log(config.enabled)    // true
console.log(config.message)    // 'Hello from Hello World plugin!'
```

**Plugin Metadata**:
```javascript
console.log(this.plugin.id)       // 'hello-world'
console.log(this.plugin.version)  // '1.0.0'
console.log(this.plugin.path)     // '/path/to/plugin'
```

**Core Access** (requires `core:read` permission):
```javascript
console.log(this.WIKI.version)    // Wiki.js version
```

## Installing the Example

### Method 1: Already Installed

The hello-world plugin is included with Wiki.js by default at:
```
/plugins/installed/hello-world/
```

Just activate it via GraphQL:
```graphql
mutation {
  plugins {
    activate(id: "hello-world") {
      responseResult {
        succeeded
        message
      }
    }
  }
}
```

### Method 2: Create from Scratch

Follow the [Getting Started Guide](../getting-started.md) to recreate it step-by-step.

## Testing the Plugin

### 1. Activate Plugin

```graphql
mutation {
  plugins {
    activate(id: "hello-world") {
      responseResult {
        succeeded
        message
      }
    }
  }
}
```

**Expected logs**:
```
[MASTER] info: [Plugin:hello-world] Hello World Plugin initialized!
[MASTER] info: [Plugin:hello-world] Plugin is enabled. Message: Hello from Hello World plugin!
[MASTER] info: [Plugin:hello-world] Running on Wiki.js version: 2.5.0
[MASTER] info: [Plugin:hello-world] Hello World Plugin activated!
[MASTER] info: [Plugin:hello-world] Hooks registered: page:save, user:login
```

### 2. Test page:save Hook

1. Navigate to any page in your wiki
2. Edit the page content
3. Click "Save"

**Expected log**:
```
[MASTER] info: [Plugin:hello-world] Page saved: "Test Page" (ID: 123)
```

### 3. Test user:login Hook

1. Log out of Wiki.js
2. Log back in

**Expected log**:
```
[MASTER] info: [Plugin:hello-world] User logged in: admin@example.com
```

### 4. Update Configuration

```graphql
mutation {
  plugins {
    updateConfig(id: "hello-world", config: {
      enabled: true,
      message: "Custom greeting message!"
    }) {
      responseResult {
        succeeded
      }
    }
  }
}
```

Reactivate to see new message:
```graphql
mutation {
  plugins {
    deactivate(id: "hello-world") {
      responseResult { succeeded }
    }
  }
}

mutation {
  plugins {
    activate(id: "hello-world") {
      responseResult { succeeded }
    }
  }
}
```

**Expected log**:
```
[MASTER] info: [Plugin:hello-world] Plugin is enabled. Message: Custom greeting message!
```

## Extending the Example

### Add Database Storage

Create a migration and model to store page view counts:

```javascript
// migrations/20240129_create_views.js
exports.up = async (knex) => {
  await knex.schema.createTable('plugin_helloworld_views', table => {
    table.increments('id').primary()
    table.integer('pageId').notNullable()
    table.timestamp('viewedAt').defaultTo(knex.fn.now())
    table.index('pageId')
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('plugin_helloworld_views')
}
```

Update hook to store views:
```javascript
async function onPageSave(event) {
  const { page } = event
  
  // Store view record
  await this.db.knex('plugin_helloworld_views').insert({
    pageId: page.id
  })
  
  this.logger.info(`Page saved and view recorded: ${page.title}`)
}
```

### Add External API Call

```javascript
const axios = require('axios')

async function onPageSave(event) {
  const { page } = event
  
  // Send webhook notification
  try {
    await axios.post('https://hooks.example.com/webhook', {
      event: 'page.saved',
      page: {
        id: page.id,
        title: page.title,
        path: page.path
      },
      timestamp: new Date()
    })
    this.logger.info('Webhook sent successfully')
  } catch (err) {
    this.logger.error('Failed to send webhook', err)
  }
}
```

### Add Background Task

```javascript
async function activated() {
  this.logger.info('Hello World Plugin activated!')
  
  // Start periodic task
  this.intervalId = setInterval(async () => {
    this.logger.info('Periodic task running...')
    // Perform periodic work
  }, 60000) // Every 60 seconds
}

async function deactivated() {
  // Stop periodic task
  if (this.intervalId) {
    clearInterval(this.intervalId)
  }
  
  this.logger.info('Hello World Plugin deactivated!')
}
```

## Key Concepts Demonstrated

### 1. Manifest Structure
- How to declare plugin metadata
- Permission requests
- Configuration schema
- Hook declarations

### 2. Lifecycle Methods
- When `init()` vs `activated()` are called
- Cleanup in `deactivated()`
- Accessing configuration in lifecycle methods

### 3. Hook System
- Registering hook handlers
- Receiving event data
- Logging hook execution

### 4. Plugin Context API
- Using the logger
- Accessing configuration
- Reading plugin metadata
- Accessing core (read-only)

### 5. Error Handling
- Using try-catch in async functions
- Logging errors properly
- Graceful failure

## Common Modifications

### Change Hook to Different Event

```javascript
// In plugin.yml
hooks:
  - event: asset:upload    # Instead of page:save
    handler: onAssetUpload

// In server/index.js
async function onAssetUpload(event) {
  const { asset } = event
  this.logger.info(`Asset uploaded: ${asset.filename}`)
}

module.exports = {
  init,
  activated,
  deactivated,
  onAssetUpload  // Export new handler
}
```

### Add More Configuration Options

```yaml
config:
  schema:
    properties:
      enabled:
        type: boolean
        default: true
      message:
        type: string
        default: 'Hello!'
      logLevel:
        type: string
        enum: [debug, info, warn, error]
        default: info
      maxEvents:
        type: integer
        minimum: 1
        maximum: 1000
        default: 100
```

### Add Permission and Use API

```yaml
# In plugin.yml
permissions:
  - cache:read
  - cache:write
```

```javascript
// In server/index.js
async function onPageSave(event) {
  // Store in cache
  await this.cache.set(`page:${event.page.id}`, event.page, 3600)
  this.logger.info('Page cached')
}
```

## Related Documentation

- [Getting Started Guide](../getting-started.md)
- [API Reference](../api-reference.md)
- [Extension Points](../extension-points.md)
- [Testing Guide](../testing.md)
- [Best Practices](../best-practices.md)
