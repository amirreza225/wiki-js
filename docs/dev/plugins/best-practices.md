# Plugin Development Best Practices

## Security Best Practices

### 1. Request Minimal Permissions

Only request permissions your plugin actually needs.

**Bad**:
```yaml
permissions:
  - database:write
  - core:read
  - config:write
  - events:emit
  - graphql:extend
  # Requesting everything "just in case"
```

**Good**:
```yaml
permissions:
  - hooks:register    # Only what we need
  - logger:use
  - config:read
```

**Rationale**: Users can see requested permissions. Excessive permissions reduce trust.

### 2. Validate All User Input

Never trust user-provided data.

**Bad**:
```javascript
async onPageSave(event) {
  // Direct database query with user input
  await this.db.knex.raw(`SELECT * FROM pages WHERE title = '${event.page.title}'`)
}
```

**Good**:
```javascript
async onPageSave(event) {
  // Parameterized query (prevents SQL injection)
  await this.db.knex('pages')
    .where('title', event.page.title)
    .select('*')
}
```

### 3. Never Store Secrets in Plaintext

Use environment variables or secure config fields.

**Bad**:
```javascript
const API_KEY = 'sk_live_123456789' // Hardcoded secret
```

**Good**:
```yaml
# In plugin.yml
config:
  schema:
    apiKey:
      type: string
      title: API Key
      format: password  # Masked in UI
      description: Your service API key
```

```javascript
async init() {
  const apiKey = await this.config.get('apiKey')
  if (!apiKey) {
    this.logger.warn('API key not configured')
    return
  }
  this.apiClient = new ApiClient(apiKey)
}
```

### 4. Sanitize Output

Prevent XSS attacks when rendering user-generated content.

**Bad**:
```javascript
return `<div>${userInput}</div>` // XSS vulnerability
```

**Good**:
```javascript
const DOMPurify = require('isomorphic-dompurify')
return DOMPurify.sanitize(userInput)
```

### 5. Validate Configuration on Activation

Fail fast if configuration is invalid.

```javascript
async activated() {
  const config = await this.config.get()
  
  if (!config.apiKey) {
    throw new Error('API key is required. Please configure the plugin.')
  }
  
  if (config.refreshInterval < 60) {
    throw new Error('Refresh interval must be at least 60 seconds')
  }
  
  // Test API connection
  try {
    await this.testApiConnection(config.apiKey)
  } catch (err) {
    throw new Error(`API connection failed: ${err.message}`)
  }
}
```

### 6. Use Rate Limiting

Prevent abuse of external API calls.

```javascript
const Bottleneck = require('bottleneck')

async init() {
  // Max 10 requests per minute
  this.limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 6000 // 60s / 10 = 6s between requests
  })
}

async makeApiCall(data) {
  return this.limiter.schedule(() => {
    return axios.post(this.apiUrl, data)
  })
}
```

## Performance Best Practices

### 1. Keep Hook Handlers Fast

Hooks should complete in < 100ms.

**Bad**:
```javascript
async onPageSave(event) {
  // Blocking call that takes 5 seconds
  await this.processPageWithHeavyComputation(event.page)
}
```

**Good**:
```javascript
async onPageSave(event) {
  // Queue for background processing
  await this.queue.add('process-page', {
    pageId: event.page.id
  })
  
  this.logger.debug(`Page ${event.page.id} queued for processing`)
}

// Process in background
async processQueue() {
  const job = await this.queue.get()
  if (job) {
    await this.processPageWithHeavyComputation(job.pageId)
  }
}
```

### 2. Cache Expensive Operations

Avoid repeated expensive computations.

**Bad**:
```javascript
async onPageRender(event) {
  // Fetches from external API on every page view
  const data = await axios.get('https://api.example.com/data')
  return this.enrichPageData(event.page, data)
}
```

**Good**:
```javascript
async onPageRender(event) {
  let data = await this.cache.get('api-data')
  
  if (!data) {
    data = await axios.get('https://api.example.com/data')
    await this.cache.set('api-data', data, 3600) // Cache for 1 hour
  }
  
  return this.enrichPageData(event.page, data)
}
```

### 3. Use Database Indexes

Optimize database queries with proper indexes.

```javascript
// In migration file
exports.up = async (knex) => {
  await knex.schema.createTable('plugin_myplugin_logs', table => {
    table.increments('id').primary()
    table.integer('pageId').notNullable()
    table.string('action').notNullable()
    table.timestamp('createdAt').defaultTo(knex.fn.now())
    
    // Add indexes on frequently queried columns
    table.index('pageId')
    table.index('action')
    table.index('createdAt')
  })
}
```

### 4. Limit Result Sets

Always use `.limit()` on queries that could return many rows.

**Bad**:
```javascript
const logs = await this.db.knex('plugin_myplugin_logs')
  .select('*') // Could return millions of rows
```

**Good**:
```javascript
const logs = await this.db.knex('plugin_myplugin_logs')
  .select('*')
  .orderBy('createdAt', 'desc')
  .limit(100) // Limit to recent 100
```

### 5. Lazy Load Dependencies

Don't load all dependencies at startup.

**Bad**:
```javascript
const axios = require('axios')
const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
const ffmpeg = require('fluent-ffmpeg')

async init() {
  this.logger.info('Plugin initialized')
}
```

**Good**:
```javascript
async init() {
  this.logger.info('Plugin initialized')
}

async scrapeWebsite(url) {
  // Load only when needed
  const axios = require('axios')
  const cheerio = require('cheerio')
  
  const html = await axios.get(url)
  return cheerio.load(html.data)
}
```

### 6. Use Async/Await Properly

Avoid sequential awaits when operations can run in parallel.

**Bad**:
```javascript
async processMultiple(pages) {
  for (const page of pages) {
    await this.processPage(page) // Sequential - slow
  }
}
```

**Good**:
```javascript
async processMultiple(pages) {
  // Parallel execution
  await Promise.all(pages.map(page => this.processPage(page)))
}
```

## Code Quality Best Practices

### 1. Handle Errors Gracefully

Always wrap async operations in try-catch.

```javascript
async onPageSave(event) {
  try {
    await this.sendWebhook(event.page)
  } catch (err) {
    // Log error but don't throw (prevents plugin from being marked as errored)
    this.logger.error(`Failed to send webhook for page ${event.page.id}`, err)
    
    // Optionally: store failed webhooks for retry
    await this.storeFailedWebhook(event.page)
  }
}
```

### 2. Use Meaningful Log Messages

Include context in log messages.

**Bad**:
```javascript
this.logger.info('Processing...')
this.logger.error('Failed')
```

**Good**:
```javascript
this.logger.info(`Processing page ${page.id}: "${page.title}"`)
this.logger.error(`Failed to send webhook for page ${page.id}`, {
  error: err.message,
  statusCode: err.response?.status,
  pageId: page.id
})
```

### 3. Clean Up Resources

Always clean up in `deactivated()` lifecycle.

```javascript
async activated() {
  // Start background timer
  this.intervalId = setInterval(() => {
    this.performPeriodicTask()
  }, 60000)
  
  // Open database connection
  this.externalDb = await this.connectToExternalDb()
}

async deactivated() {
  // Clean up timer
  if (this.intervalId) {
    clearInterval(this.intervalId)
    this.intervalId = null
  }
  
  // Close database connection
  if (this.externalDb) {
    await this.externalDb.close()
    this.externalDb = null
  }
  
  this.logger.info('Plugin deactivated and resources cleaned up')
}
```

### 4. Document Your Code

Add JSDoc comments for public functions.

```javascript
/**
 * Process a page and extract metadata
 * @param {Object} page - The page object
 * @param {number} page.id - Page ID
 * @param {string} page.content - Page markdown content
 * @returns {Promise<Object>} Extracted metadata
 * @throws {Error} If page content is invalid
 */
async extractMetadata(page) {
  // Implementation
}
```

### 5. Use TypeScript (Optional)

For better type safety and IDE support.

```typescript
// server/index.ts
interface PluginConfig {
  apiKey: string
  enabled: boolean
  refreshInterval: number
}

interface PageEvent {
  page: {
    id: number
    title: string
    content: string
  }
}

export async function onPageSave(event: PageEvent): Promise<void> {
  const config: PluginConfig = await this.config.get()
  // Your logic with full type safety
}
```

## User Experience Best Practices

### 1. Provide Clear Configuration UI

Use descriptive titles and help text.

```yaml
config:
  schema:
    apiKey:
      type: string
      title: API Key
      description: Get your API key from https://example.com/settings
      format: password
    webhookUrl:
      type: string
      title: Webhook URL
      description: The URL to send webhook notifications to
      format: uri
      example: https://hooks.example.com/webhook
    enabled:
      type: boolean
      title: Enable Notifications
      description: Turn on/off webhook notifications
      default: true
```

### 2. Fail with Helpful Error Messages

Tell users what went wrong and how to fix it.

**Bad**:
```javascript
throw new Error('Failed')
```

**Good**:
```javascript
throw new Error(
  'Failed to connect to API. Please check your API key and ensure it has the correct permissions. ' +
  'Visit https://example.com/docs for more information.'
)
```

### 3. Provide Default Configuration

Make plugins work out-of-the-box when possible.

```yaml
config:
  schema:
    refreshInterval:
      type: integer
      title: Refresh Interval (seconds)
      default: 3600  # Sensible default
      minimum: 60
      maximum: 86400
```

### 4. Log Important Events

Help admins understand what the plugin is doing.

```javascript
async activated() {
  this.logger.info('Plugin activated successfully')
  
  const config = await this.config.get()
  this.logger.info(`Configured with API URL: ${config.apiUrl}`)
  this.logger.info(`Refresh interval: ${config.refreshInterval} seconds`)
}

async onPageSave(event) {
  this.logger.debug(`Page saved: ${event.page.title} (ID: ${event.page.id})`)
}
```

### 5. Version Your Plugin Properly

Follow semantic versioning (MAJOR.MINOR.PATCH).

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

## Testing Best Practices

### 1. Write Unit Tests

Test individual functions in isolation.

```javascript
// server/utils.test.js
const { extractTags } = require('./utils')

describe('extractTags', () => {
  test('extracts hashtags from text', () => {
    const tags = extractTags('This is a #test with #multiple tags')
    expect(tags).toEqual(['test', 'multiple'])
  })
  
  test('handles empty text', () => {
    const tags = extractTags('')
    expect(tags).toEqual([])
  })
})
```

### 2. Test Hook Handlers

Mock the plugin context.

```javascript
const plugin = require('./server/index')

describe('onPageSave hook', () => {
  let context
  
  beforeEach(() => {
    context = {
      logger: { info: jest.fn(), error: jest.fn() },
      config: { get: jest.fn().mockResolvedValue({ enabled: true }) },
      db: { knex: jest.fn() }
    }
  })
  
  test('logs page save', async () => {
    const event = { page: { id: 1, title: 'Test' } }
    await plugin.onPageSave.call(context, event)
    
    expect(context.logger.info).toHaveBeenCalledWith(
      'Page saved: Test (ID: 1)'
    )
  })
})
```

### 3. Test Error Handling

Verify graceful failure.

```javascript
test('handles API failure gracefully', async () => {
  const axios = require('axios')
  axios.post.mockRejectedValue(new Error('Network error'))
  
  const event = { page: { id: 1 } }
  
  // Should not throw
  await expect(plugin.onPageSave.call(context, event)).resolves.toBeUndefined()
  
  // Should log error
  expect(context.logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Failed to send webhook'),
    expect.any(Error)
  )
})
```

### 4. Test Database Migrations

Verify migrations are reversible.

```javascript
describe('migrations', () => {
  test('up creates table', async () => {
    await migration.up(knex)
    const exists = await knex.schema.hasTable('plugin_myplugin_data')
    expect(exists).toBe(true)
  })
  
  test('down drops table', async () => {
    await migration.up(knex)
    await migration.down(knex)
    const exists = await knex.schema.hasTable('plugin_myplugin_data')
    expect(exists).toBe(false)
  })
})
```

## Deployment Best Practices

### 1. Include README

Provide clear documentation.

```markdown
# My Plugin

Brief description of what the plugin does.

## Features

- Feature 1
- Feature 2

## Configuration

1. Go to Admin > Plugins
2. Find "My Plugin" and click Configure
3. Enter your API key
4. Save

## Requirements

- Wiki.js 2.5.0 or higher
- API key from https://example.com

## Support

Report issues at: https://github.com/username/plugin/issues
```

### 2. Include LICENSE

Always include a license file.

```
MIT License

Copyright (c) 2024 Your Name

Permission is hereby granted...
```

### 3. Version Dependencies

Lock dependency versions in package.json.

```json
{
  "dependencies": {
    "axios": "1.6.0",
    "cheerio": "1.0.0-rc.12"
  }
}
```

### 4. Test Before Release

Run full test suite before publishing.

```bash
# Run tests
yarn test

# Validate manifest
yarn plugin:validate --path=./plugins/installed/myplugin

# Test installation
yarn plugin:build --plugin=myplugin
yarn plugin:install --path=./dist/myplugin.zip
```

### 5. Maintain Changelog

Document changes between versions.

```markdown
# Changelog

## [1.1.0] - 2024-01-29
### Added
- New feature X
- Support for Y

### Fixed
- Bug in Z

## [1.0.0] - 2024-01-01
### Added
- Initial release
```

## Compatibility Best Practices

### 1. Specify Version Ranges

Be explicit about compatibility.

```yaml
compatibility:
  wikijs: ">=2.5.0 <3.0.0"
  node: ">=18.0.0"
```

### 2. Handle API Changes

Check version before using new APIs.

```javascript
async init() {
  const wikiVersion = this.WIKI.version
  
  if (semver.gte(wikiVersion, '2.6.0')) {
    // Use new API available in 2.6+
    this.useNewApi()
  } else {
    // Fallback for older versions
    this.useOldApi()
  }
}
```

### 3. Deprecate Gracefully

Give users time to migrate.

```javascript
async init() {
  const config = await this.config.get()
  
  if (config.oldField) {
    this.logger.warn(
      'Config field "oldField" is deprecated and will be removed in v2.0.0. ' +
      'Please use "newField" instead.'
    )
    config.newField = config.oldField
  }
}
```

## Common Pitfalls to Avoid

### ❌ Don't Block Event Loop

```javascript
// Bad - blocks for 5 seconds
function heavyComputation() {
  const start = Date.now()
  while (Date.now() - start < 5000) {}
}
```

### ❌ Don't Mutate Core Objects

```javascript
// Bad - modifies core
this.WIKI.config.someValue = 'new value'

// Good - use plugin config
await this.config.set('someValue', 'new value')
```

### ❌ Don't Use Synchronous File Operations

```javascript
// Bad - blocks event loop
const fs = require('fs')
const data = fs.readFileSync('/path/to/file')

// Good - async
const data = await this.storage.readFile('file.txt')
```

### ❌ Don't Ignore Errors

```javascript
// Bad
async function doSomething() {
  await riskyOperation() // If this throws, whole plugin crashes
}

// Good
async function doSomething() {
  try {
    await riskyOperation()
  } catch (err) {
    this.logger.error('Operation failed', err)
  }
}
```

### ❌ Don't Leak Memory

```javascript
// Bad - event listener never removed
async activated() {
  this.events.on('page:save', this.handlePageSave)
}

// Good - cleanup in deactivated
async activated() {
  this.handlePageSave = (event) => { /* ... */ }
  this.events.on('page:save', this.handlePageSave)
}

async deactivated() {
  this.events.off('page:save', this.handlePageSave)
}
```

## Summary Checklist

### Security ✓
- [ ] Request minimal permissions
- [ ] Validate all user input
- [ ] Use parameterized queries
- [ ] Never store secrets in plaintext
- [ ] Sanitize output to prevent XSS

### Performance ✓
- [ ] Keep hooks fast (< 100ms)
- [ ] Cache expensive operations
- [ ] Use database indexes
- [ ] Limit query results
- [ ] Use async/await properly

### Code Quality ✓
- [ ] Handle errors gracefully
- [ ] Use meaningful log messages
- [ ] Clean up resources
- [ ] Document your code
- [ ] Write tests

### User Experience ✓
- [ ] Provide clear configuration UI
- [ ] Use helpful error messages
- [ ] Provide sensible defaults
- [ ] Log important events
- [ ] Include README and docs

### Deployment ✓
- [ ] Include LICENSE file
- [ ] Version dependencies
- [ ] Test before release
- [ ] Maintain changelog
- [ ] Specify version compatibility

## Related Documentation

- [Getting Started Guide](./getting-started.md)
- [API Reference](./api-reference.md)
- [Extension Points](./extension-points.md)
- [Testing Guide](./testing.md)
- [Architecture Overview](./architecture.md)
