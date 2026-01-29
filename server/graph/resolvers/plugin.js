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
     * Get errors for a specific plugin
     */
    async errors(obj, args) {
      return WIKI.models.pluginErrors.query()
        .where('pluginId', args.pluginId)
        .orderBy('createdAt', 'desc')
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
        await WIKI.models.plugins.query()
          .patch({
            config: args.config,
            updatedAt: new Date().toISOString()
          })
          .where('id', args.id)

        return {
          responseResult: graphHelper.generateSuccess('Plugin configuration updated')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
