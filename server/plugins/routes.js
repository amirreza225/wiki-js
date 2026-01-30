const fs = require('fs-extra')
const path = require('path')
const express = require('express')

/**
 * Plugin Route Loader
 *
 * Handles discovery and registration of Express routes from plugins.
 * Routes are mounted at /api/plugin/<pluginId>/*
 */
module.exports = class PluginRouteLoader {
  constructor() {
    this.pluginRouters = new Map() // Map<pluginId, Router>
  }

  /**
   * Discover routes from plugin directory
   *
   * @param {string} pluginId - Plugin identifier
   * @param {string} pluginPath - Absolute path to plugin directory
   * @returns {Promise<Router|null>} Express router or null
   */
  async discoverRoutes(pluginId, pluginPath) {
    const routesPath = path.join(pluginPath, 'server', 'routes')

    if (!await fs.pathExists(routesPath)) {
      WIKI.logger.debug(`No routes directory found for plugin ${pluginId}`)
      return null
    }

    const indexPath = path.join(routesPath, 'index.js')
    if (!await fs.pathExists(indexPath)) {
      WIKI.logger.warn(`Plugin ${pluginId} has routes directory but no index.js file`)
      return null
    }

    try {
      // Load route module
      const routeModule = require(indexPath)

      // If module exports a router, use it
      if (routeModule && typeof routeModule === 'object') {
        WIKI.logger.debug(`Discovered routes for plugin ${pluginId}`)
        return routeModule
      }

      WIKI.logger.warn(`Plugin ${pluginId} routes/index.js does not export a router`)
      return null
    } catch (err) {
      WIKI.logger.error(`Failed to load routes for plugin ${pluginId}: ${err.message}`)
      return null
    }
  }

  /**
   * Register plugin routes with Express app
   *
   * @param {object} app - Express app instance
   * @param {string} pluginId - Plugin identifier
   * @param {object} router - Express router
   * @param {object} plugin - Plugin object from database
   */
  registerPluginRoutes(app, pluginId, router, plugin) {
    if (this.pluginRouters.has(pluginId)) {
      WIKI.logger.warn(`Plugin ${pluginId} routes already registered, skipping`)
      return
    }

    // Create a new router with plugin middleware
    const pluginRouter = express.Router()

    // Add plugin context to requests
    pluginRouter.use((req, res, next) => {
      req.plugin = {
        id: pluginId,
        config: plugin.config || {},
        permissions: plugin.permissions || []
      }
      next()
    })

    // Add error isolation middleware
    const wrappedRouter = this.wrapRouterWithErrorHandling(pluginId, router)

    // Mount plugin router
    pluginRouter.use(wrappedRouter)

    // Register at namespace
    const namespace = `/api/plugin/${pluginId}`
    app.use(namespace, pluginRouter)

    // Store for later unregistration
    this.pluginRouters.set(pluginId, {
      namespace,
      router: pluginRouter,
      stack: app._router.stack.length - 1 // Track position in middleware stack
    })

    WIKI.logger.info(`Registered routes for plugin ${pluginId} at ${namespace}`)
  }

  /**
   * Wrap router with error handling middleware
   *
   * @param {string} pluginId - Plugin identifier
   * @param {object} router - Express router
   * @returns {object} Wrapped router
   */
  wrapRouterWithErrorHandling(pluginId, router) {
    const wrappedRouter = express.Router()

    // Copy routes from original router
    if (router.stack) {
      router.stack.forEach(layer => {
        wrappedRouter.stack.push(layer)
      })
    } else if (typeof router === 'function') {
      // If router is a function, wrap it
      wrappedRouter.use(router)
    }

    // Add error handler
    wrappedRouter.use(async (err, req, res, next) => {
      WIKI.logger.error(`[Plugin:${pluginId}] Route error: ${err.message}`)

      // Log error to database
      try {
        await WIKI.plugins.runtime.logPluginError(pluginId, 'route_error', err)
      } catch (logErr) {
        WIKI.logger.error(`Failed to log plugin error: ${logErr.message}`)
      }

      // Send error response
      res.status(err.statusCode || 500).json({
        error: true,
        message: err.message || 'Internal plugin error',
        plugin: pluginId
      })
    })

    return wrappedRouter
  }

  /**
   * Unregister plugin routes
   *
   * @param {object} app - Express app instance
   * @param {string} pluginId - Plugin identifier
   */
  unregisterPluginRoutes(app, pluginId) {
    const routerInfo = this.pluginRouters.get(pluginId)

    if (!routerInfo) {
      WIKI.logger.debug(`No routes registered for plugin ${pluginId}`)
      return
    }

    // Remove from Express middleware stack
    // Note: This is tricky in Express - routes are not easily removable
    // In production, might require server restart for full cleanup
    try {
      // Remove the route from stack by filtering
      if (app._router && app._router.stack) {
        app._router.stack = app._router.stack.filter((layer, index) => {
          if (layer.name === 'router' && layer.regexp) {
            const match = layer.regexp.toString().includes(routerInfo.namespace.replace(/\//g, '\\/'))
            return !match
          }
          return true
        })
      }

      WIKI.logger.info(`Unregistered routes for plugin ${pluginId}`)
    } catch (err) {
      WIKI.logger.warn(`Failed to unregister routes for plugin ${pluginId}: ${err.message}`)
    }

    // Clear module cache
    const routesPath = path.join(WIKI.ROOTPATH, 'plugins', 'installed', pluginId, 'server', 'routes')
    if (fs.existsSync(routesPath)) {
      const indexPath = path.join(routesPath, 'index.js')
      if (require.cache[indexPath]) {
        delete require.cache[indexPath]
      }
    }

    this.pluginRouters.delete(pluginId)
  }

  /**
   * Check if plugin has registered routes
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {boolean} True if plugin has routes
   */
  hasPluginRoutes(pluginId) {
    return this.pluginRouters.has(pluginId)
  }

  /**
   * Get route info for a plugin
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {object|null} Route info or null
   */
  getPluginRouteInfo(pluginId) {
    return this.pluginRouters.get(pluginId) || null
  }

  /**
   * Create router factory for plugin context
   *
   * @param {object} plugin - Plugin object from database
   * @returns {function} Router factory function
   */
  createRouterFactory(plugin) {
    return () => {
      const router = express.Router()

      // Inject plugin context into all routes
      router.use((req, res, next) => {
        req.pluginContext = WIKI.plugins.runtime.createContext(plugin)
        next()
      })

      return router
    }
  }

  /**
   * Add permission middleware to route
   *
   * @param {string} pluginId - Plugin identifier
   * @param {string} permission - Required permission
   * @returns {function} Express middleware
   */
  createPermissionMiddleware(pluginId, permission) {
    return async (req, res, next) => {
      try {
        // Load plugin
        const plugin = await WIKI.models.plugins.query().findById(pluginId)

        if (!plugin) {
          return res.status(404).json({
            error: true,
            message: 'Plugin not found'
          })
        }

        // Check permission
        if (!WIKI.plugins.security.checkPermission(plugin, permission)) {
          return res.status(403).json({
            error: true,
            message: `Plugin does not have permission: ${permission}`
          })
        }

        next()
      } catch (err) {
        WIKI.logger.error(`Permission middleware error: ${err.message}`)
        res.status(500).json({
          error: true,
          message: 'Failed to check permissions'
        })
      }
    }
  }
}
