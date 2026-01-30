const graphHelper = require('../../helpers/graph')
const { GraphQLScalarType, Kind } = require('graphql')

// JSON scalar type - passes through any valid JSON value
const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON scalar type for arbitrary JSON values',
  serialize(value) {
    return value
  },
  parseValue(value) {
    return value
  },
  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value
      case Kind.INT:
      case Kind.FLOAT:
        return parseFloat(ast.value)
      case Kind.OBJECT:
        return parseObject(ast)
      case Kind.LIST:
        return ast.values.map(value => JSONScalar.parseLiteral(value))
      case Kind.NULL:
        return null
      default:
        return null
    }
  }
})

function parseObject(ast) {
  const value = Object.create(null)
  ast.fields.forEach(field => {
    value[field.name.value] = JSONScalar.parseLiteral(field.value)
  })
  return value
}

module.exports = {
  JSON: JSONScalar,
  Query: {
    plugins() { return {} }
  },
  Mutation: {
    plugins() { return {} }
  },
  PluginQuery: {
    /**
     * List all plugins
     */
    async list() {
      return WIKI.models.plugins.getPlugins()
    },

    /**
     * Get single plugin by ID
     */
    async single(obj, args) {
      const plugin = await WIKI.models.plugins.query().findById(args.id)
      if (!plugin) {
        throw new Error('Plugin not found')
      }
      return plugin
    },

    /**
     * Get errors for a specific plugin (backward compatibility)
     */
    async errors(obj, args) {
      return WIKI.models.pluginErrors.query()
        .where('pluginId', args.pluginId)
        .where('level', 'error')
        .orderBy('createdAt', 'desc')
        .then(logs => logs.map(log => ({
          ...log,
          errorType: log.context,
          errorMessage: log.message
        })))
    },

    /**
     * Get logs for a specific plugin (all levels or filtered by level)
     */
    async logs(obj, args) {
      let query = WIKI.models.pluginErrors.query()
        .where('pluginId', args.pluginId)

      // Filter by level if specified
      if (args.level) {
        query = query.where('level', args.level)
      }

      return query.orderBy('createdAt', 'desc').limit(500)
    }
  },
  PluginMutation: {
    /**
     * Install plugin from ZIP file
     */
    async install(obj, args) {
      try {
        await WIKI.plugins.manager.installPlugin(args.zipPath)
        return {
          responseResult: graphHelper.generateSuccess('Plugin installed successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Activate a plugin
     */
    async activate(obj, args) {
      try {
        const result = await WIKI.plugins.manager.activatePlugin(args.id)
        return {
          responseResult: graphHelper.generateSuccess(
            result.requiresRestart
              ? 'Plugin marked for activation. Server restart required.'
              : 'Plugin activated successfully'
          ),
          requiresRestart: result.requiresRestart
        }
      } catch (err) {
        return {
          responseResult: graphHelper.generateError(err),
          requiresRestart: false
        }
      }
    },

    /**
     * Deactivate a plugin
     */
    async deactivate(obj, args) {
      try {
        const result = await WIKI.plugins.manager.deactivatePlugin(args.id)
        return {
          responseResult: graphHelper.generateSuccess(
            result.requiresRestart
              ? 'Plugin marked for deactivation. Server restart required.'
              : 'Plugin deactivated successfully'
          ),
          requiresRestart: result.requiresRestart
        }
      } catch (err) {
        return {
          responseResult: graphHelper.generateError(err),
          requiresRestart: false
        }
      }
    },

    /**
     * Uninstall a plugin
     */
    async uninstall(obj, args) {
      try {
        await WIKI.plugins.manager.uninstallPlugin(args.id)
        return {
          responseResult: graphHelper.generateSuccess('Plugin uninstalled successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Update plugin configuration
     */
    async updateConfig(obj, args) {
      try {
        // Update config in database
        await WIKI.models.plugins.query()
          .patch({
            config: args.config,
            updatedAt: new Date().toISOString()
          })
          .where('id', args.id)

        // Refresh plugin config in memory if plugin is loaded
        if (WIKI.plugins && WIKI.plugins.manager) {
          const loadedPlugin = await WIKI.models.plugins.query().findById(args.id)
          if (loadedPlugin && loadedPlugin.instance) {
            loadedPlugin.config = args.config
            WIKI.logger.info(`[Plugins] Refreshed config for plugin: ${args.id}`)
          }
        }

        return {
          responseResult: graphHelper.generateSuccess('Plugin configuration updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Clear logs for a specific plugin
     */
    async clearLogs(obj, args) {
      try {
        await WIKI.models.pluginErrors.query()
          .delete()
          .where('pluginId', args.pluginId)

        return {
          responseResult: graphHelper.generateSuccess('Plugin logs cleared successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
