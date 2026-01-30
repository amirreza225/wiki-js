# Automatic Restart Implementation

## Overview

Implemented automatic graceful restart when enabling/disabling plugins that require server restart (GraphQL extensions, Vue components, Vuex modules).

## Library Used

**[http-graceful-shutdown](https://www.npmjs.com/package/http-graceful-shutdown)** (3.1.15)
- 10M+ downloads
- Handles graceful shutdown of HTTP/HTTPS servers
- Supports connection draining and cleanup hooks
- Works with Express, Koa, Fastify, and native Node.js HTTP servers

## How It Works

1. **Detection**: Comprehensive check identifies ALL features requiring restart:
   - GraphQL schema extensions (Apollo Server 2 limitation)
   - Vue components (adminPages, uiInjections)
   - Vuex store modules
   - Client-side code (requires Webpack rebuild)

2. **Automatic Restart**: When enabled, the server will:
   - Send response to client
   - Wait 3 seconds (configurable)
   - Gracefully close all connections
   - Clean up database connections
   - Exit with appropriate code (1 for dev/nodemon, 0 for production)
   - Process manager restarts the server

3. **Graceful Shutdown**: Uses `http-graceful-shutdown` to:
   - Wait up to 30 seconds for active requests to complete
   - Close database connections cleanly
   - Prevent data loss or corruption

## Configuration

**Default**: Automatic restart is **ENABLED** by default.

To disable automatic restart, add to `config.yml`:

```yaml
# Disable automatic restart when enabling plugins
autoRestartOnPluginChange: false
```

When disabled, users will see a warning message and must restart manually.

## User Experience

### With Auto-Restart (Default)

1. User enables plugin in admin UI
2. Success notification: "Plugin marked for activation..."
3. Detailed reasons shown (GraphQL, Vue components, etc.)
4. After 3 seconds: Server automatically restarts
5. User can refresh page and plugin is active

### Without Auto-Restart

1. User enables plugin
2. Warning notification with detailed reasons
3. User must manually restart: `yarn start` or restart Docker container

## Technical Details

### Files Modified

- `server/core/servers.js`: Added graceful shutdown integration
- `server/plugins/manager.js`: Added auto-restart logic and comprehensive detection
- `server/master.js`: Initialize graceful shutdown on startup
- `client/components/admin/admin-plugins.vue`: Show detailed restart reasons
- `server/graph/resolvers/plugin.js`: Return detailed reasons to frontend
- `server/graph/schemas/plugin.graphql`: Added `restartReasons` field

### New Functions

- `WIKI.servers.initGracefulShutdown()`: Initialize graceful shutdown handlers
- `WIKI.servers.gracefulRestart(delayMs)`: Trigger graceful restart
- `pluginManager.requiresRestart(pluginPath, manifest)`: Comprehensive restart detection

## Process Manager Requirements

### Development (nodemon)

**No configuration needed!** Nodemon restarts automatically on crashes.

- Exit code 1 is used in development mode to trigger nodemon restart
- This is detected automatically via `NODE_ENV=development` or debug mode
- Works seamlessly with `yarn dev`

### Production

For automatic restart to work in production, the application must be running under a process manager:

- **Docker**: Use `restart: unless-stopped` or `restart: always` in docker-compose.yml
- **systemd**: Use `Restart=always` in service file
- **PM2**: Runs by default with auto-restart
- **Kubernetes**: Deployment with `restartPolicy: Always`
- **Exit code**: 0 (clean exit) in production mode

## Testing

1. Run in development: `yarn dev`
2. Enable approval-workflow plugin (has GraphQL + Vue components)
3. Should see detailed message with reasons
4. Server should restart automatically after 3 seconds via nodemon
5. Check logs for graceful shutdown messages

## Logs to Expect

```
[Plugin Manager] Deactivating plugin approval-workflow
[Plugin Hooks] Unregistered hook page:create for plugin approval-workflow
[Plugin Manager] Plugin approval-workflow deactivated
[Plugin Manager] Triggering automatic restart for plugin approval-workflow
[Graceful Restart] Initiating graceful restart in 3000ms...
[Graceful Restart] Triggering graceful shutdown...
[Graceful Shutdown] Received signal SIGTERM, preparing to shutdown...
[Graceful Shutdown] Closing active connections...
[Graceful Shutdown] Cleanup complete
[Graceful Restart] Exiting process for restart... (code: 1)
```

Then nodemon will restart the server automatically.

## Future Enhancements

- Add countdown timer in UI showing restart progress
- Broadcast restart notification to all connected clients via WebSocket
- Add option to schedule restart at low-traffic time
- Support for plugin-specific restart delay configuration
