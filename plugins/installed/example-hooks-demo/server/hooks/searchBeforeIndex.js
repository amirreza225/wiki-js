/**
 * Search Before Index Hook
 * Triggered before a page is indexed in the search engine
 * Perfect for generating embeddings for RAG/semantic search
 */
module.exports = async function (data) {
  if (!this.config.enabled) {
    return data
  }

  this.logger.info(`Preparing to index page: ${data.page.title}`)

  // Example: Generate embeddings here
  // const embeddings = await generateEmbeddings(data.page.content)
  // data.embeddings = embeddings

  // For this demo, we just log the content length
  this.logger.debug(`Content length for indexing: ${data.page.safeContent.length} characters`)

  return data
}
