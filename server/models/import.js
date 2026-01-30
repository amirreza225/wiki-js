const Model = require('objection').Model

/**
 * Import Model
 * Handles content import from external sources
 */
module.exports = class Import extends Model {
  static get tableName() { return 'imports' }

  /**
   * Import content from Confluence
   */
  static async importFromConfluence(opts) {
    const axios = require('axios')
    const TurndownService = require('turndown')

    if (!opts.url || !opts.spaceKey) {
      throw new Error('Confluence URL and space key are required')
    }

    const auth = opts.token ?
      { headers: { Authorization: `Bearer ${opts.token}` } } :
      { auth: { username: opts.username, password: opts.password } }

    const importResults = {
      pagesImported: 0,
      errors: [],
      pages: []
    }

    try {
      // -> Trigger content:beforeImport hook (blocking)
      if (WIKI.plugins && WIKI.plugins.hooks) {
        try {
          await WIKI.plugins.hooks.triggerBlocking('content:beforeImport', {
            source: {
              type: 'confluence',
              url: opts.url,
              spaceKey: opts.spaceKey
            },
            pages: [],
            user: {
              id: opts.user.id,
              name: opts.user.name,
              email: opts.user.email
            },
            canProceed: true
          })
        } catch (hookErr) {
          throw new Error(`Import blocked: ${hookErr.message}`)
        }
      }

      // Fetch all pages from Confluence space
      const baseUrl = opts.url.replace(/\/$/, '')
      const apiUrl = `${baseUrl}/rest/api/content`

      let start = 0
      const limit = 25
      let hasMore = true

      while (hasMore) {
        const response = await axios.get(apiUrl, {
          ...auth,
          params: {
            spaceKey: opts.spaceKey,
            type: 'page',
            expand: 'body.storage,version,metadata.labels',
            start,
            limit
          }
        })

        const pages = response.data.results || []

        if (pages.length === 0) {
          hasMore = false
          break
        }

        for (const confluencePage of pages) {
          try {
            // Convert Confluence storage format to Markdown
            const turndownService = new TurndownService({
              headingStyle: 'atx',
              codeBlockStyle: 'fenced'
            })

            // Handle Confluence macros
            turndownService.addRule('confluenceMacros', {
              filter: node => node.nodeName === 'AC:STRUCTURED-MACRO',
              replacement: (content, node) => {
                const macroName = node.getAttribute('ac:name')

                // Convert common macros
                if (macroName === 'code') {
                  const language = node.querySelector('ac\\:parameter[ac\\:name="language"]')?.textContent || ''
                  const code = node.querySelector('ac\\:plain-text-body')?.textContent || ''
                  return `\`\`\`${language}\n${code}\n\`\`\``
                }

                if (macroName === 'info' || macroName === 'note' || macroName === 'warning') {
                  return `> **${macroName.toUpperCase()}**: ${content}`
                }

                return content
              }
            })

            const htmlContent = confluencePage.body.storage.value
            let markdown = turndownService.turndown(htmlContent)

            const pageData = {
              id: confluencePage.id,
              title: confluencePage.title,
              content: htmlContent,
              labels: confluencePage.metadata?.labels?.results?.map(l => l.name) || [],
              lastModified: confluencePage.version.when
            }

            // -> Trigger content:import hook
            let transformedData = {
              content: markdown,
              path: confluencePage.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              metadata: {
                confluenceId: confluencePage.id,
                confluenceUrl: `${baseUrl}/pages/viewpage.action?pageId=${confluencePage.id}`,
                labels: pageData.labels,
                lastModified: pageData.lastModified
              }
            }

            if (WIKI.plugins && WIKI.plugins.hooks) {
              try {
                const hookResult = await WIKI.plugins.hooks.triggerMutable('content:import', {
                  page: pageData,
                  source: {
                    type: 'confluence',
                    url: baseUrl,
                    spaceKey: opts.spaceKey
                  },
                  transformed: transformedData
                })
                transformedData = hookResult.transformed || transformedData
              } catch (hookErr) {
                WIKI.logger.warn(`Hook execution error (content:import): ${hookErr.message}`)
              }
            }

            // Create page in Wiki.js
            const createdPage = await WIKI.models.pages.createPage({
              path: opts.pathPrefix ? `${opts.pathPrefix}/${transformedData.path}` : transformedData.path,
              locale: opts.locale || 'en',
              title: confluencePage.title,
              description: `Imported from Confluence: ${confluencePage.title}`,
              content: transformedData.content,
              isPublished: true,
              isPrivate: false,
              editor: 'markdown',
              user: opts.user,
              tags: transformedData.metadata.labels || []
            })

            importResults.pagesImported++
            importResults.pages.push({
              id: createdPage.id,
              path: createdPage.path,
              title: createdPage.title,
              confluenceId: confluencePage.id
            })

            WIKI.logger.info(`Imported Confluence page: ${confluencePage.title}`)
          } catch (pageErr) {
            WIKI.logger.error(`Failed to import Confluence page ${confluencePage.title}: ${pageErr.message}`)
            importResults.errors.push({
              page: confluencePage.title,
              message: pageErr.message
            })
          }
        }

        start += limit
        hasMore = pages.length === limit
      }

      // -> Trigger content:afterImport hook
      if (WIKI.plugins && WIKI.plugins.hooks) {
        try {
          await WIKI.plugins.hooks.trigger('content:afterImport', {
            source: {
              type: 'confluence',
              url: baseUrl,
              spaceKey: opts.spaceKey
            },
            pages: importResults.pages,
            success: importResults.errors.length === 0,
            errors: importResults.errors,
            totalImported: importResults.pagesImported
          })
        } catch (hookErr) {
          WIKI.logger.warn(`Hook execution error (content:afterImport): ${hookErr.message}`)
        }
      }

      return {
        success: true,
        pagesImported: importResults.pagesImported,
        errors: importResults.errors
      }
    } catch (err) {
      WIKI.logger.error(`Confluence import failed: ${err.message}`)
      throw err
    }
  }

  /**
   * Import content from generic source
   */
  static async importContent(opts) {
    // Future: Support other import sources (Notion, Gitbook, etc.)
    throw new Error('Generic import not yet implemented')
  }
}
