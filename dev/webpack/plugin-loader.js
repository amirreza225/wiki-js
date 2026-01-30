const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')

/**
 * Wiki.js Plugin Loader Webpack Plugin
 *
 * Discovers and registers Vue components from installed plugins
 */
class WikiPluginLoaderPlugin {
  constructor(options = {}) {
    this.options = {
      pluginsPath: options.pluginsPath || path.resolve(process.cwd(), 'plugins', 'installed'),
      outputPath: options.outputPath || path.resolve(process.cwd(), 'plugins', 'cache'),
      ...options
    }
    this.discovered = false
    this.discoveredPlugins = []
  }

  apply(compiler) {
    const pluginName = 'WikiPluginLoaderPlugin'

    compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, callback) => {
      try {
        // Only discover once per build session
        if (!this.discovered) {
          await this.discoverPlugins()
          this.discovered = true
        }
        callback()
      } catch (err) {
        callback(err)
      }
    })

    compiler.hooks.emit.tapAsync(pluginName, async (compilation, callback) => {
      try {
        await this.generatePluginManifests(compilation)
        callback()
      } catch (err) {
        callback(err)
      }
    })
  }

  /**
   * Discover installed plugins and their components
   */
  async discoverPlugins() {
    if (!await fs.pathExists(this.options.pluginsPath)) {
      console.log('[Plugin Loader] No plugins directory found')
      return
    }

    const pluginDirs = await fs.readdir(this.options.pluginsPath)
    const discoveredPlugins = []

    for (const pluginDir of pluginDirs) {
      const pluginPath = path.join(this.options.pluginsPath, pluginDir)
      const stat = await fs.stat(pluginPath)

      if (!stat.isDirectory()) continue

      // Check for plugin manifest
      const manifestPath = path.join(pluginPath, 'plugin.yml')
      if (!await fs.pathExists(manifestPath)) {
        console.log(`[Plugin Loader] Skipping ${pluginDir}: no plugin.yml`)
        continue
      }

      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8')
        const manifest = yaml.load(manifestContent)

        // Discover Vue components
        const componentsPath = path.join(pluginPath, 'client', 'components')
        const components = await this.discoverComponents(componentsPath, manifest.id)

        if (components.length > 0) {
          discoveredPlugins.push({
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            path: pluginPath,
            components
          })
          console.log(`[Plugin Loader] Discovered ${components.length} components in plugin: ${manifest.id}`)
        }
      } catch (err) {
        console.warn(`[Plugin Loader] Failed to process plugin ${pluginDir}:`, err.message)
      }
    }

    this.discoveredPlugins = discoveredPlugins
  }

  /**
   * Discover Vue components in a directory
   */
  async discoverComponents(componentsPath, pluginId) {
    const components = []

    if (!await fs.pathExists(componentsPath)) {
      return components
    }

    const files = await fs.readdir(componentsPath)

    for (const file of files) {
      if (file.endsWith('.vue')) {
        const componentName = path.basename(file, '.vue')
        const registrationName = `Plugin${this.capitalize(pluginId)}${this.capitalize(componentName)}`

        components.push({
          name: componentName,
          registrationName,
          path: path.join(componentsPath, file),
          file
        })
      }
    }

    return components
  }

  /**
   * Generate plugin manifests for each plugin
   */
  async generatePluginManifests(compilation) {
    if (!this.discoveredPlugins || this.discoveredPlugins.length === 0) {
      return
    }

    // Generate registration code for all plugin components
    let registrationCode = '/* Auto-generated plugin component registrations */\n\n'

    for (const plugin of this.discoveredPlugins) {
      if (plugin.components.length === 0) continue

      registrationCode += `// Plugin: ${plugin.name} (${plugin.id})\n`

      for (const component of plugin.components) {
        // Generate import statement
        const importPath = component.path.replace(/\\/g, '/')
        registrationCode += `import ${component.registrationName} from '${importPath}'\n`
      }

      registrationCode += '\n'
    }

    // Generate Vue component registrations
    registrationCode += 'export function registerPluginComponents(Vue) {\n'

    for (const plugin of this.discoveredPlugins) {
      for (const component of plugin.components) {
        registrationCode += `  Vue.component('${component.registrationName}', ${component.registrationName})\n`
      }
    }

    registrationCode += '}\n\n'

    // Generate plugin metadata
    registrationCode += 'export const pluginMetadata = ' + JSON.stringify(
      this.discoveredPlugins.map(p => ({
        id: p.id,
        name: p.name,
        version: p.version,
        components: p.components.map(c => ({
          name: c.name,
          registrationName: c.registrationName
        }))
      })),
      null,
      2
    ) + '\n'

    // Add to compilation assets
    compilation.assets['plugin-components.js'] = {
      source: () => registrationCode,
      size: () => registrationCode.length
    }

    console.log(`[Plugin Loader] Generated plugin-components.js with ${this.discoveredPlugins.length} plugins`)
  }

  /**
   * Capitalize first letter of string
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())
  }
}

module.exports = WikiPluginLoaderPlugin
