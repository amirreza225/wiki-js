const fs = require('fs-extra')
const path = require('path')
const AdmZip = require('adm-zip')
const yaml = require('js-yaml')
const { Validator } = require('jsonschema')
const semver = require('semver')
const security = require('./security')

/**
 * Plugin Loader Module
 * Handles extraction and validation of plugins from ZIP files
 */

// JSON Schema for plugin manifest validation
const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'version'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', // kebab-case
      minLength: 1,
      maxLength: 100
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 200
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+(?:-[a-zA-Z0-9.-]+)?(?:\\+[a-zA-Z0-9.-]+)?$' // semver
    },
    description: {
      type: 'string'
    },
    author: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        url: { type: 'string' }
      }
    },
    license: {
      type: 'string'
    },
    repository: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        url: { type: 'string' }
      }
    },
    homepage: {
      type: 'string'
    },
    keywords: {
      type: 'array',
      items: { type: 'string' }
    },
    compatibility: {
      type: 'object',
      properties: {
        wikijs: { type: 'string' },
        node: { type: 'string' }
      }
    },
    permissions: {
      type: 'array',
      items: { type: 'string' }
    },
    config: {
      type: 'object',
      properties: {
        schema: { type: 'object' }
      }
    },
    hooks: {
      type: 'array',
      items: { type: 'string' }
    },
    menuItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          label: { type: 'string' },
          icon: { type: 'string' },
          path: { type: 'string' },
          order: { type: 'number' }
        }
      }
    }
  }
}

module.exports = {
  /**
   * Extract plugin from ZIP file
   * @param {string} zipPath - Absolute path to ZIP file
   * @param {string} pluginId - Plugin identifier (kebab-case)
   * @returns {Object} Parsed manifest
   */
  async extractPlugin(zipPath, pluginId) {
    const installDir = path.join(WIKI.ROOTPATH, 'plugins', 'installed', pluginId)

    try {
      // Ensure plugins directory exists
      await fs.ensureDir(path.join(WIKI.ROOTPATH, 'plugins', 'installed'))

      // Remove existing installation if present
      if (await fs.pathExists(installDir)) {
        await fs.remove(installDir)
      }

      // Extract ZIP
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(installDir, true)

      WIKI.logger.info(`[Plugin Loader] Extracted plugin ${pluginId} to ${installDir}`)

      // Load and return manifest
      const manifest = await this.loadManifest(installDir)

      // Verify manifest ID matches
      if (manifest.id !== pluginId) {
        throw new Error(`Plugin ID mismatch: expected ${pluginId}, got ${manifest.id}`)
      }

      return manifest
    } catch (err) {
      // Clean up on failure
      if (await fs.pathExists(installDir)) {
        await fs.remove(installDir)
      }
      throw err
    }
  },

  /**
   * Load plugin manifest from directory
   * @param {string} pluginPath - Absolute path to plugin directory
   * @returns {Object} Parsed manifest object
   */
  async loadManifest(pluginPath) {
    // Try plugin.yml first (preferred)
    const ymlPath = path.join(pluginPath, 'plugin.yml')
    if (await fs.pathExists(ymlPath)) {
      const content = await fs.readFile(ymlPath, 'utf8')
      return yaml.load(content)
    }

    // Fall back to plugin.json
    const jsonPath = path.join(pluginPath, 'plugin.json')
    if (await fs.pathExists(jsonPath)) {
      const content = await fs.readFile(jsonPath, 'utf8')
      return JSON.parse(content)
    }

    throw new Error(`No manifest found (plugin.yml or plugin.json) in ${pluginPath}`)
  },

  /**
   * Validate plugin manifest against schema
   * @param {Object} manifest - Manifest object to validate
   * @throws {Error} If validation fails
   */
  async validateManifest(manifest) {
    const validator = new Validator()
    const result = validator.validate(manifest, MANIFEST_SCHEMA)

    if (!result.valid) {
      const errors = result.errors.map(e => `${e.property}: ${e.message}`).join(', ')
      throw new Error(`Invalid plugin manifest: ${errors}`)
    }

    // Validate semver version
    if (!semver.valid(manifest.version)) {
      throw new Error(`Invalid semantic version: ${manifest.version}`)
    }

    // Validate compatibility with current Wiki.js version
    if (manifest.compatibility && manifest.compatibility.wikijs) {
      const currentVersion = WIKI.version || '2.5.0' // Fallback for development
      if (!semver.satisfies(currentVersion, manifest.compatibility.wikijs)) {
        throw new Error(
          `Plugin requires Wiki.js ${manifest.compatibility.wikijs}, but current version is ${currentVersion}`
        )
      }
    }

    // Validate compatibility with current Node.js version
    if (manifest.compatibility && manifest.compatibility.node) {
      const currentNode = process.version
      if (!semver.satisfies(currentNode, manifest.compatibility.node)) {
        throw new Error(
          `Plugin requires Node.js ${manifest.compatibility.node}, but current version is ${currentNode}`
        )
      }
    }

    // Validate permissions
    if (manifest.permissions) {
      security.validateManifestPermissions(manifest.permissions)
    }

    return true
  },

  /**
   * Load plugin dependencies from package.json
   * @param {string} pluginPath - Absolute path to plugin directory
   * @returns {Object} Dependencies object or empty object
   */
  async loadDependencies(pluginPath) {
    const pkgPath = path.join(pluginPath, 'package.json')

    if (await fs.pathExists(pkgPath)) {
      const content = await fs.readFile(pkgPath, 'utf8')
      const pkg = JSON.parse(content)
      return pkg.dependencies || {}
    }

    return {}
  }
}
