const _ = require('lodash')
const EventEmitter = require('eventemitter2').EventEmitter2

/* global WIKI */

module.exports = {
  async init() {
    WIKI.logger.info('=======================================')
    WIKI.logger.info(`= Wiki.js ${_.padEnd(WIKI.version + ' ', 29, '=')}`)
    WIKI.logger.info('=======================================')
    WIKI.logger.info('Initializing...')

    WIKI.models = require('./db').init()

    try {
      await WIKI.models.onReady
      await WIKI.configSvc.loadFromDb()
      await WIKI.configSvc.applyFlags()
    } catch (err) {
      WIKI.logger.error('Database Initialization Error: ' + err.message)
      if (WIKI.IS_DEBUG) {
        WIKI.logger.error(err)
      }
      process.exit(1)
    }

    this.bootMaster()
  },
  /**
   * Pre-Master Boot Sequence
   */
  async preBootMaster() {
    try {
      await this.initTelemetry()
      WIKI.sideloader = await require('./sideloader').init()
      WIKI.cache = require('./cache').init()
      WIKI.scheduler = require('./scheduler').init()
      WIKI.servers = require('./servers')
      WIKI.events = {
        inbound: new EventEmitter(),
        outbound: new EventEmitter()
      }
      WIKI.extensions = require('./extensions')
      WIKI.asar = require('./asar')
      WIKI.plugins = {
        loader: require('../plugins/loader'),
        manager: require('../plugins/manager'),
        runtime: require('../plugins/runtime'),
        security: require('../plugins/security'),
        hooks: require('../plugins/hooks'),
        modelLoader: new (require('../plugins/models'))(),
        routeLoader: new (require('../plugins/routes'))()
      }
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Boot Master Process
   */
  async bootMaster() {
    try {
      if (WIKI.config.setup) {
        WIKI.logger.info('Starting setup wizard...')
        require('../setup')()
      } else {
        await this.preBootMaster()
        await require('../master')()
        this.postBootMaster()
      }
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Post-Master Boot Sequence
   */
  async postBootMaster() {
    await WIKI.models.analytics.refreshProvidersFromDisk()
    await WIKI.models.authentication.refreshStrategiesFromDisk()
    await WIKI.models.commentProviders.refreshProvidersFromDisk()
    await WIKI.models.editors.refreshEditorsFromDisk()
    await WIKI.models.loggers.refreshLoggersFromDisk()
    await WIKI.models.renderers.refreshRenderersFromDisk()
    await WIKI.models.searchEngines.refreshSearchEnginesFromDisk()
    await WIKI.models.storage.refreshTargetsFromDisk()
    await WIKI.models.plugins.refreshPluginsFromDisk()

    await WIKI.extensions.init()

    await WIKI.auth.activateStrategies()
    await WIKI.models.commentProviders.initProvider()
    await WIKI.models.searchEngines.initEngine()
    await WIKI.models.storage.initTargets()
    await WIKI.models.plugins.initPlugins()
    WIKI.scheduler.start()

    await WIKI.models.subscribeToNotifications()

    // -> Trigger app:start hook
    if (WIKI.plugins && WIKI.plugins.hooks) {
      try {
        await WIKI.plugins.hooks.trigger('app:start', {
          version: WIKI.version,
          startTime: new Date().toISOString()
        })
      } catch (hookErr) {
        WIKI.logger.warn(`Hook execution error (app:start): ${hookErr.message}`)
      }
    }
  },
  /**
   * Init Telemetry
   */
  async initTelemetry() {
    require('./telemetry').init()

    process.on('unhandledRejection', (err) => {
      WIKI.logger.warn(err)
      WIKI.telemetry.sendError(err)
    })
    process.on('uncaughtException', (err) => {
      WIKI.logger.warn(err)
      WIKI.telemetry.sendError(err)
    })
  },
  /**
   * Graceful shutdown
   */
  async shutdown (devMode = false) {
    // -> Trigger app:shutdown hook
    if (WIKI.plugins && WIKI.plugins.hooks) {
      try {
        await WIKI.plugins.hooks.trigger('app:shutdown', {
          shutdownTime: new Date().toISOString()
        })
      } catch (hookErr) {
        WIKI.logger.warn(`Hook execution error (app:shutdown): ${hookErr.message}`)
      }
    }

    if (WIKI.servers) {
      await WIKI.servers.stopServers()
    }
    if (WIKI.scheduler) {
      await WIKI.scheduler.stop()
    }
    if (WIKI.models) {
      await WIKI.models.unsubscribeToNotifications()
      if (WIKI.models.knex) {
        await WIKI.models.knex.destroy()
      }
    }
    if (WIKI.asar) {
      await WIKI.asar.unload()
    }
    if (!devMode) {
      process.exit(0)
    }
  }
}
