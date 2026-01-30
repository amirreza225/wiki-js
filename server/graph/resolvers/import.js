const graphHelper = require('../../helpers/graph')

module.exports = {
  Query: {
    async import() { return {} }
  },
  Mutation: {
    async import() { return {} }
  },
  ImportQuery: {
    // Future: Add query methods for import history, status, etc.
  },
  ImportMutation: {
    /**
     * Import content from Confluence
     */
    async importFromConfluence(obj, args, context) {
      try {
        // Check permissions
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'], {})) {
          throw new WIKI.Error.AuthRequired()
        }

        const Import = require('../../models/import')

        const result = await Import.importFromConfluence({
          url: args.url,
          spaceKey: args.spaceKey,
          username: args.username,
          password: args.password,
          token: args.token,
          locale: args.locale || 'en',
          pathPrefix: args.pathPrefix,
          user: context.req.user
        })

        return {
          responseResult: graphHelper.generateSuccess('Content imported successfully'),
          success: result.success,
          pagesImported: result.pagesImported,
          errors: result.errors
        }
      } catch (err) {
        WIKI.logger.error(`Import failed: ${err.message}`)
        return {
          responseResult: graphHelper.generateError(err),
          success: false,
          pagesImported: 0,
          errors: [{ page: 'N/A', message: err.message }]
        }
      }
    },

    /**
     * Export content to Confluence
     */
    async exportToConfluence(obj, args, context) {
      try {
        // Check permissions
        if (!WIKI.auth.checkAccess(context.req.user, ['manage:system'], {})) {
          throw new WIKI.Error.AuthRequired()
        }

        const Export = require('../../models/export')

        const result = await Export.exportToConfluence({
          url: args.url,
          spaceKey: args.spaceKey,
          pageIds: args.pageIds,
          username: args.username,
          password: args.password,
          token: args.token,
          user: context.req.user
        })

        return {
          responseResult: graphHelper.generateSuccess('Content exported successfully'),
          success: result.success,
          pagesExported: result.pagesExported,
          errors: result.errors
        }
      } catch (err) {
        WIKI.logger.error(`Export failed: ${err.message}`)
        return {
          responseResult: graphHelper.generateError(err),
          success: false,
          pagesExported: 0,
          errors: [{ page: 'N/A', message: err.message }]
        }
      }
    }
  }
}
