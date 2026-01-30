const Model = require('objection').Model

/**
 * Export Model
 * Handles content export to external sources
 */
module.exports = class Export extends Model {
  static get tableName() { return 'exports' }

  /**
   * Export content to Confluence
   */
  static async exportToConfluence(opts) {
    const axios = require('axios')

    if (!opts.url || !opts.spaceKey || !opts.pageIds) {
      throw new Error('Confluence URL, space key, and page IDs are required')
    }

    const auth = opts.token ?
      { headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': 'application/json' } } :
      { auth: { username: opts.username, password: opts.password }, headers: { 'Content-Type': 'application/json' } }

    const exportResults = {
      pagesExported: 0,
      errors: [],
      pages: []
    }

    try {
      // Fetch pages to export
      const pages = await WIKI.models.pages.query()
        .whereIn('id', opts.pageIds)
        .select('id', 'path', 'title', 'description', 'content', 'render', 'localeCode')

      // -> Trigger content:beforeExport hook (blocking)
      if (WIKI.plugins && WIKI.plugins.hooks) {
        try {
          await WIKI.plugins.hooks.triggerBlocking('content:beforeExport', {
            destination: {
              type: 'confluence',
              url: opts.url,
              spaceKey: opts.spaceKey
            },
            pageIds: opts.pageIds,
            pages: pages.map(p => ({ id: p.id, path: p.path, title: p.title })),
            user: {
              id: opts.user.id,
              name: opts.user.name,
              email: opts.user.email
            },
            canProceed: true
          })
        } catch (hookErr) {
          throw new Error(`Export blocked: ${hookErr.message}`)
        }
      }

      const baseUrl = opts.url.replace(/\/$/, '')
      const apiUrl = `${baseUrl}/rest/api/content`

      for (const page of pages) {
        try {
          // Convert Markdown to Confluence storage format
          // For now, we'll use the rendered HTML directly
          // In the future, this could be enhanced with proper Markdown -> Confluence conversion
          let confluenceContent = page.render || page.content

          const pageData = {
            page,
            destination: {
              type: 'confluence',
              url: baseUrl,
              spaceKey: opts.spaceKey
            },
            format: 'storage'
          }

          // -> Trigger content:export hook
          if (WIKI.plugins && WIKI.plugins.hooks) {
            try {
              const hookResult = await WIKI.plugins.hooks.triggerMutable('content:export', pageData)
              if (hookResult.content) {
                confluenceContent = hookResult.content
              }
            } catch (hookErr) {
              WIKI.logger.warn(`Hook execution error (content:export): ${hookErr.message}`)
            }
          }

          // Create page in Confluence
          const confluencePayload = {
            type: 'page',
            title: page.title,
            space: {
              key: opts.spaceKey
            },
            body: {
              storage: {
                value: confluenceContent,
                representation: 'storage'
              }
            }
          }

          const response = await axios.post(apiUrl, confluencePayload, auth)

          exportResults.pagesExported++
          exportResults.pages.push({
            id: page.id,
            path: page.path,
            title: page.title,
            confluenceId: response.data.id,
            confluenceUrl: `${baseUrl}${response.data._links.webui}`
          })

          WIKI.logger.info(`Exported page to Confluence: ${page.title}`)
        } catch (pageErr) {
          WIKI.logger.error(`Failed to export page ${page.title}: ${pageErr.message}`)
          exportResults.errors.push({
            page: page.title,
            message: pageErr.message
          })
        }
      }

      // -> Trigger content:afterExport hook
      if (WIKI.plugins && WIKI.plugins.hooks) {
        try {
          await WIKI.plugins.hooks.trigger('content:afterExport', {
            destination: {
              type: 'confluence',
              url: baseUrl,
              spaceKey: opts.spaceKey
            },
            pages: exportResults.pages,
            success: exportResults.errors.length === 0,
            errors: exportResults.errors,
            totalExported: exportResults.pagesExported
          })
        } catch (hookErr) {
          WIKI.logger.warn(`Hook execution error (content:afterExport): ${hookErr.message}`)
        }
      }

      return {
        success: true,
        pagesExported: exportResults.pagesExported,
        errors: exportResults.errors
      }
    } catch (err) {
      WIKI.logger.error(`Confluence export failed: ${err.message}`)
      throw err
    }
  }

  /**
   * Export content to generic format
   */
  static async exportContent(opts) {
    // Future: Support other export formats (PDF, Markdown ZIP, etc.)
    throw new Error('Generic export not yet implemented')
  }
}
