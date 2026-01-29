# Plugin System Architecture

## Overview

The Wiki.js plugin system provides a secure, isolated environment for extending Wiki.js functionality without modifying core code. This document explains the technical architecture, component interactions, and design constraints.

## Component Overview

The plugin system consists of six core modules:

### 1. Plugin Loader (`/server/plugins/loader.js`)

**Purpose**: Extracts, loads, and validates plugins from ZIP files.

**Key Functions**:
- `extractPlugin(zipPath, targetDir)` - Extract ZIP to plugin directory
- `loadManifest(pluginPath)` - Load and parse plugin.yml/plugin.json
- `validateManifest(manifest)` - Validate against JSON schema
- `loadDependencies(pluginPath)` - Check npm dependencies

**Validation Rules**:
- Manifest must contain: `id`, `title`, `version`, `author`, `license`
- Version must be valid semver (e.g., "1.0.0")
- Compatibility ranges checked against running versions
- Permission names validated against allowed list

### 2. Plugin Manager (`/server/plugins/manager.js`)

**Purpose**: Manages plugin lifecycle operations.

**Key Functions**:
- `installPlugin(zipPath)` - Install from ZIP file
  1. Extract ZIP
  2. Validate manifest
  3. Check dependencies
  4. Insert into database
  5. Run migrations
  
- `activatePlugin(pluginId)` - Enable plugin
  1. Load plugin code
  2. Create runtime context
  3. Call init() and activated() lifecycle methods
  4. Register hooks
  5. Detect GraphQL extensions (returns requiresRestart if found)

- `deactivatePlugin(pluginId)` - Disable plugin
  1. Call deactivated() lifecycle method
  2. Unregister hooks
  3. Update database status

- `uninstallPlugin(pluginId)` - Remove plugin
  1. Deactivate if enabled
  2. Delete from database
  3. Remove files from disk

- `runMigrations(pluginId, migrationsPath)` - Execute database migrations
  - Tracks executed migrations in `pluginMigrations` table
  - Uses Knex.js migration runner

### 3. Plugin Runtime (`/server/plugins/runtime.js`)

**Purpose**: Creates isolated execution context for plugins with permission-based API access.

**Key Functions**:
- `createContext(plugin, permissions)` - Build plugin context object
- `executePlugin(plugin, method, ...args)` - Execute plugin method with error isolation
- `loadPlugin(pluginPath)` - Load plugin code with require()

**Context Structure**:
```javascript
{
  // Always available
  plugin: { id, version, path, config },
  logger: winston.Logger,
  
  // Permission-gated APIs
  config: ConfigAPI,           // config:read, config:write
  db: DatabaseAPI,             // database:read, database:write
  events: EventEmitter,        // events:emit, events:listen
  cache: CacheAPI,             // cache:read, cache:write
  storage: StorageAPI,         // storage:read, storage:write
  WIKI: ReadOnlyWIKI          // core:read
}
```

**Error Isolation**:
- All plugin method calls wrapped in try-catch
- Errors logged to `pluginErrors` table
- Plugin marked as "errored" in database
- Core application continues running

### 4. Plugin Security (`/server/plugins/security.js`)

**Purpose**: Defines permission system and validates access.

**16 Permission Types**:
- `config:read`, `config:write` - Plugin configuration
- `database:read`, `database:write` - Database access
- `hooks:register`, `hooks:trigger` - Lifecycle hooks
- `api:extend` - REST API routes
- `graphql:extend` - GraphQL schema extensions
- `ui:extend` - UI components
- `events:emit`, `events:listen` - Event system
- `cache:read`, `cache:write` - Cache access
- `storage:read`, `storage:write` - File storage
- `core:read` - Read-only WIKI access

**Key Functions**:
- `validatePermission(permission)` - Check permission name is valid
- `checkPermission(plugin, permission)` - Check if plugin has permission
- `enforcePermission(plugin, permission)` - Throw error if missing

**Security Model**:
- **Trust-based, NOT sandboxed**: Node.js provides no real process isolation
- Permissions are validated at runtime, not enforced by OS
- Third-party plugins require manual code review before installation
- Plugins run in same process as Wiki.js

### 5. Plugin Hooks (`/server/plugins/hooks.js`)

**Purpose**: Event-based hook system for lifecycle events.

**Implementation**: EventEmitter2 with wildcard support

**Key Functions**:
- `trigger(event, data)` - Trigger hook for all registered plugins
- `registerPluginHooks(pluginId, hooks)` - Register plugin's hook handlers
- `unregisterPluginHooks(pluginId)` - Remove all hooks for plugin

**Error Handling**:
- Each hook handler wrapped in try-catch
- Failed hooks don't stop other handlers
- Errors logged to plugin error table

**Available Hooks** (to be instrumented in Phase 2):
- `app:start`, `app:shutdown`
- `page:render`, `page:save`, `page:delete`, `page:move`
- `user:create`, `user:login`, `user:logout`
- `asset:upload`, `asset:delete`
- `search:index`, `search:query`

### 6. Plugin Models

Four Objection.js models manage plugin data:

#### `plugins` (`/server/models/plugins.js`)
- Main plugin registry
- Fields: id, title, version, description, author, isEnabled, status, config, permissions
- Methods:
  - `refreshPluginsFromDisk()` - Scan disk and sync with database
  - `initPlugins()` - Activate enabled plugins on startup
  - `getPlugins()` - List all plugins

#### `pluginMigrations` (`/server/models/pluginMigrations.js`)
- Tracks executed migrations per plugin
- Fields: pluginId, version, migratedAt

#### `pluginErrors` (`/server/models/pluginErrors.js`)
- Logs plugin errors and failures
- Fields: pluginId, errorType, message, stack, context, createdAt

#### `pluginDependencies` (`/server/models/pluginDependencies.js`)
- Stores inter-plugin dependencies
- Fields: pluginId, dependsOn, version, isOptional

## Database Schema

### `plugins` Table
```sql
CREATE TABLE plugins (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  author JSON,
  license VARCHAR(50),
  isEnabled BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'installed',
  config JSON,
  permissions JSON,
  installedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `pluginMigrations` Table
```sql
CREATE TABLE pluginMigrations (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  pluginId VARCHAR(255) REFERENCES plugins(id),
  version VARCHAR(255) NOT NULL,
  migratedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `pluginErrors` Table
```sql
CREATE TABLE pluginErrors (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  pluginId VARCHAR(255) REFERENCES plugins(id),
  errorType VARCHAR(50),
  message TEXT,
  stack TEXT,
  context JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `pluginDependencies` Table
```sql
CREATE TABLE pluginDependencies (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  pluginId VARCHAR(255) REFERENCES plugins(id),
  dependsOn VARCHAR(255),
  version VARCHAR(50),
  isOptional BOOLEAN DEFAULT false
);
```

### `pluginPermissions` Table
```sql
CREATE TABLE pluginPermissions (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  pluginId VARCHAR(255) REFERENCES plugins(id),
  permission VARCHAR(100) NOT NULL,
  grantedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Plugin Lifecycle

### Installation Flow
```
1. Upload ZIP file via admin UI or GraphQL
2. Extract to /plugins/installed/<plugin-id>/
3. Load and validate plugin.yml/plugin.json
4. Check compatibility (Wiki.js version, Node.js version)
5. Validate requested permissions
6. Check npm dependencies
7. Insert into plugins table (status: 'installed', isEnabled: false)
8. Run plugin migrations
9. Store permissions in pluginPermissions table
10. Return success
```

### Activation Flow
```
1. Check plugin exists and is installed
2. Load plugin code from server/index.js
3. Create runtime context with permissions
4. Call init() lifecycle method
5. Call activated() lifecycle method
6. Register hooks in hook system
7. Update database (isEnabled: true, status: 'active')
8. Check for GraphQL extensions
9. Return { succeeded: true, requiresRestart: <boolean> }
```

### Deactivation Flow
```
1. Check plugin exists and is active
2. Load plugin code
3. Create runtime context
4. Call deactivated() lifecycle method
5. Unregister all hooks
6. Update database (isEnabled: false, status: 'installed')
7. Check for GraphQL extensions
8. Return { succeeded: true, requiresRestart: <boolean> }
```

### Uninstallation Flow
```
1. Deactivate plugin if enabled
2. Delete from pluginPermissions table
3. Delete from pluginDependencies table
4. Delete from pluginMigrations table
5. Delete from pluginErrors table
6. Delete from plugins table
7. Delete files from /plugins/installed/<plugin-id>/
8. Return success
```

## Core Integration Points

### Server Startup (`/server/core/kernel.js`)

```javascript
// Line 45: Initialize plugin system
WIKI.plugins = {
  manager: require('../plugins/manager'),
  loader: require('../plugins/loader'),
  runtime: require('../plugins/runtime'),
  security: require('../plugins/security'),
  hooks: require('../plugins/hooks')
}

// Line 87: Scan disk for plugins
await WIKI.models.plugins.refreshPluginsFromDisk()

// Line 95: Activate enabled plugins
await WIKI.models.plugins.initPlugins()
```

### GraphQL Integration (`/server/graph/index.js`)

```javascript
// Lines 28-37: Load plugin GraphQL schemas
const pluginSchemas = await loadPluginSchemas()
schemaDefinitions.push(...pluginSchemas)

// Lines 49-59: Load plugin GraphQL resolvers
const pluginResolvers = await loadPluginResolvers()
resolvers = _.merge(resolvers, pluginResolvers)
```

## Technical Constraints (CRITICAL)

### 1. GraphQL Extensions → Server Restart Required

**Why**: Apollo Server 2.25.2 loads schema at server startup only. The schema cannot be modified at runtime.

**Impact**: 
- Plugins with `/graphql/` directory must restart server to activate/deactivate
- Manager detects GraphQL extensions via `hasGraphQLExtensions()`
- Returns `requiresRestart: true` in mutation response

**Workaround**: Admin UI displays restart message and can trigger server restart.

### 2. Vue Components → Rebuild Required

**Why**: Vue 2.6 + Webpack 4 bundle components at build time. External components cannot be loaded at runtime.

**Impact**:
- UI plugins require `yarn build` (~30 seconds) to add/remove components
- Development workflow: edit code → build → restart → test

**Phase**: UI component registration planned for Phase 2.

### 3. No True Sandboxing

**Why**: Node.js `vm` module provides no real security isolation. Plugins run in same process.

**Impact**:
- Trust-based permission system only
- Third-party plugins require manual code review before installation
- Plugins can potentially access internals via prototype manipulation

**Mitigation**:
- Permission validation at runtime
- Error isolation prevents core crashes
- Manual vetting of third-party plugins required

### 4. Hook Infrastructure Must Be Built

**Status**: EventEmitter-based hook system implemented in Phase 1.

**Phase 2**: Core code needs instrumentation to trigger hooks at appropriate times.

**Example**:
```javascript
// In /server/models/pages.js
async function savePage(page) {
  // ... save logic ...
  
  // Trigger hook
  await WIKI.plugins.hooks.trigger('page:save', { page })
}
```

## Plugin Structure on Disk

```
/plugins/installed/<plugin-id>/
├── plugin.yml                    # Manifest (required)
├── README.md                     # Documentation
├── LICENSE                       # License file
├── package.json                  # npm dependencies (optional)
├── server/                       # Server-side code
│   ├── index.js                 # Main entry point (required)
│   ├── models/                  # Objection models (optional)
│   ├── routes/                  # Express routes (optional)
│   └── services/                # Business logic (optional)
├── client/                       # Client-side code (Phase 2)
│   ├── components/              # Vue components
│   ├── pages/                   # Full pages
│   └── store/                   # Vuex modules
├── graphql/                      # GraphQL extensions (optional)
│   ├── schema.graphql
│   └── resolvers.js
├── migrations/                   # Database migrations (optional)
│   └── YYYYMMDD_description.js
└── locales/                      # i18n translations (optional)
    ├── en.yml
    └── fr.yml
```

## Plugin Manifest Format

```yaml
# Required fields
id: my-plugin                     # kebab-case, unique identifier
title: My Plugin                  # Display name
version: 1.0.0                    # Semantic version
description: Plugin description
author: Author Name               # Or object with name, email, url
license: MIT

# Compatibility constraints
compatibility:
  wikijs: ">=2.5.0"              # Semver range
  node: ">=18.0.0"               # Optional

# Required permissions
permissions:
  - config:read
  - database:read
  - hooks:register
  - events:emit

# Configuration schema (JSON Schema)
config:
  schema:
    type: object
    properties:
      apiKey:
        type: string
        title: API Key
        format: password
      enabled:
        type: boolean
        title: Enable Plugin
        default: true

# Lifecycle hooks
hooks:
  - event: page:save
    handler: onPageSave
  - event: user:login
    handler: onUserLogin
```

## Plugin Entry Point

`server/index.js` must export an object with lifecycle methods and hook handlers:

```javascript
module.exports = {
  /**
   * Called once when plugin is first activated
   */
  async init() {
    this.logger.info('Plugin initialized')
    // Setup code
  },

  /**
   * Called when plugin is activated
   */
  async activated() {
    this.logger.info('Plugin activated')
    // Start services
  },

  /**
   * Called when plugin is deactivated
   */
  async deactivated() {
    this.logger.info('Plugin deactivated')
    // Cleanup resources
  },

  /**
   * Hook handlers (must match manifest)
   */
  async onPageSave(event) {
    this.logger.info(`Page saved: ${event.page.title}`)
  },

  async onUserLogin(event) {
    this.logger.info(`User logged in: ${event.user.email}`)
  }
}
```

## Performance Considerations

### Plugin Loading
- Plugins loaded lazily when activated (not at server start)
- Plugin code cached in memory after first load
- Manifest files parsed once and cached

### Hook Execution
- Hooks executed in parallel for all plugins
- Individual hook failures don't block others
- Timeout protection (future: configurable timeout per hook)

### Database Queries
- Plugin queries use same connection pool as core
- No isolation at database level
- Plugins should use Knex.js for query building

## Security Model

### Permission Validation
```javascript
// In plugin code
async function someMethod() {
  // Runtime will check 'database:read' permission before providing this.db
  const pages = await this.db.knex('pages').select('*')
}
```

### Read-Only Core Access
```javascript
// Plugins with 'core:read' get read-only proxy
this.WIKI.models.pages.query()      // ✅ Allowed (read)
this.WIKI.models.pages.query().insert()  // ❌ Will fail (write)
```

### Error Isolation
```javascript
// In runtime.js
async function executePlugin(plugin, method, ...args) {
  try {
    await plugin[method].apply(context, args)
  } catch (err) {
    // Log error, mark plugin as errored, continue execution
    await logPluginError(plugin.id, err)
  }
}
```

## GraphQL API

### Queries
- `plugins.list` - List all plugins
- `plugins.single(id)` - Get plugin details
- `plugins.errors(pluginId)` - Get plugin errors

### Mutations
- `plugins.install(file)` - Install from ZIP file
- `plugins.activate(id)` - Activate plugin
- `plugins.deactivate(id)` - Deactivate plugin
- `plugins.uninstall(id)` - Uninstall plugin
- `plugins.updateConfig(id, config)` - Update plugin configuration

### Authentication
All plugin operations require admin authentication via `@auth` directive.

## Future Enhancements (Phase 2+)

### Phase 2: Extension Points
- Database model registration
- REST API route registration
- Vue component registration
- Admin page system
- UI injection points
- Background job scheduling

### Phase 3: Development Tools
- CLI plugin generator (`yarn plugin:create`)
- Hot reload for development
- Plugin testing utilities
- Validation tool
- Build system

## Related Documentation

- [Getting Started Guide](./getting-started.md) - Create your first plugin
- [API Reference](./api-reference.md) - Complete plugin API documentation
- [Extension Points](./extension-points.md) - Available extension points
- [Testing Guide](./testing.md) - How to test plugins
- [Best Practices](./best-practices.md) - Security and performance guidelines
