const _ = require('lodash')
const fs = require('fs')
// const gqlTools = require('graphql-tools')
const path = require('path')
const autoload = require('auto-load')
const PubSub = require('graphql-subscriptions').PubSub
const { LEVEL, MESSAGE } = require('triple-beam')
const Transport = require('winston-transport')
const { createRateLimitTypeDef } = require('graphql-rate-limit-directive')
// const { GraphQLUpload } = require('graphql-upload')

/* global WIKI */

WIKI.logger.info(`Loading GraphQL Schema...`)

// Init Subscription PubSub

WIKI.GQLEmitter = new PubSub()

// Schemas

let typeDefs = [createRateLimitTypeDef()]
let schemas = fs.readdirSync(path.join(WIKI.SERVERPATH, 'graph/schemas'))
schemas.forEach(schema => {
  typeDefs.push(fs.readFileSync(path.join(WIKI.SERVERPATH, `graph/schemas/${schema}`), 'utf8'))
})

// Load plugin GraphQL schemas (requires restart for changes)
if (WIKI.data && WIKI.data.plugins) {
  for (const plugin of WIKI.data.plugins) {
    const schemaPath = path.join(plugin.installPath, 'graphql', 'schema.graphql')
    if (fs.existsSync(schemaPath)) {
      WIKI.logger.info(`Loading GraphQL schema for plugin: ${plugin.id}`)
      try {
        const pluginSchema = fs.readFileSync(schemaPath, 'utf8')

        // Basic validation: check if schema can be parsed
        if (!pluginSchema.trim()) {
          throw new Error('Schema file is empty')
        }

        // Check for common syntax errors
        if (!pluginSchema.includes('type') && !pluginSchema.includes('extend')) {
          WIKI.logger.warn(`Plugin ${plugin.id} GraphQL schema does not contain any type or extend declarations`)
        }

        // Validate balanced braces
        const openBraces = (pluginSchema.match(/\{/g) || []).length
        const closeBraces = (pluginSchema.match(/\}/g) || []).length
        if (openBraces !== closeBraces) {
          throw new Error(`Unbalanced braces in schema: ${openBraces} opening, ${closeBraces} closing`)
        }

        typeDefs.push(pluginSchema)
        WIKI.logger.info(`Successfully validated and loaded GraphQL schema for plugin: ${plugin.id}`)
      } catch (err) {
        WIKI.logger.error(`Invalid GraphQL schema in plugin ${plugin.id}: ${err.message}`)

        // Mark plugin as errored
        WIKI.models.plugins.query()
          .patch({
            status: 'error',
            state: {
              status: 'error',
              message: `Invalid GraphQL schema: ${err.message}`
            }
          })
          .where('id', plugin.id)
          .catch(dbErr => {
            WIKI.logger.error(`Failed to update plugin status: ${dbErr.message}`)
          })

        // Continue loading other plugins
        continue
      }
    }
  }
}

// Resolvers

let resolvers = {
  // Upload: GraphQLUpload
}
const resolversObj = _.values(autoload(path.join(WIKI.SERVERPATH, 'graph/resolvers')))
resolversObj.forEach(resolver => {
  _.merge(resolvers, resolver)
})

// Load plugin GraphQL resolvers (requires restart for changes)
if (WIKI.data && WIKI.data.plugins) {
  for (const plugin of WIKI.data.plugins) {
    const resolversPath = path.join(plugin.installPath, 'graphql', 'resolvers.js')
    if (fs.existsSync(resolversPath)) {
      WIKI.logger.info(`Loading GraphQL resolvers for plugin: ${plugin.id}`)
      try {
        const pluginResolvers = require(resolversPath)

        // Validate resolvers structure
        if (!pluginResolvers || typeof pluginResolvers !== 'object') {
          throw new Error('Resolvers must export an object')
        }

        _.merge(resolvers, pluginResolvers)
        WIKI.logger.info(`Successfully loaded GraphQL resolvers for plugin: ${plugin.id}`)
      } catch (err) {
        WIKI.logger.error(`Invalid GraphQL resolvers in plugin ${plugin.id}: ${err.message}`)

        // Mark plugin as errored
        WIKI.models.plugins.query()
          .patch({
            status: 'error',
            state: {
              status: 'error',
              message: `Invalid GraphQL resolvers: ${err.message}`
            }
          })
          .where('id', plugin.id)
          .catch(dbErr => {
            WIKI.logger.error(`Failed to update plugin status: ${dbErr.message}`)
          })

        // Continue loading other plugins
        continue
      }
    }
  }
}

// Directives

let schemaDirectives = {
  ...autoload(path.join(WIKI.SERVERPATH, 'graph/directives'))
}

// Live Trail Logger (admin)

class LiveTrailLogger extends Transport {
  constructor(opts) {
    super(opts)

    this.name = 'liveTrailLogger'
    this.level = 'debug'
  }

  log (info, callback = () => {}) {
    WIKI.GQLEmitter.publish('livetrail', {
      loggingLiveTrail: {
        timestamp: new Date(),
        level: info[LEVEL],
        output: info[MESSAGE]
      }
    })
    callback(null, true)
  }
}

WIKI.logger.add(new LiveTrailLogger({}))

WIKI.logger.info(`GraphQL Schema: [ OK ]`)

module.exports = {
  typeDefs,
  resolvers,
  schemaDirectives
}
