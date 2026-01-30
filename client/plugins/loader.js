/**
 * Client-Side Plugin Loader
 *
 * Loads and initializes plugins in the browser
 */
export default class ClientPluginLoader {
  constructor() {
    this.plugins = new Map() // Map<pluginId, pluginMetadata>
    this.initialized = false
  }

  /**
   * Load plugin manifests from server
   *
   * @returns {Promise<Array>} Array of active plugin manifests
   */
  async loadPluginManifests() {
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            query {
              plugins {
                list {
                  id
                  name
                  version
                  isEnabled
                  manifest
                  status
                }
              }
            }
          `
        })
      })

      const data = await response.json()

      if (data.errors) {
        console.error('[Plugin Loader] Failed to load plugin manifests:', data.errors)
        return []
      }

      const plugins = data.data.plugins.list || []
      const activePlugins = plugins.filter(p => p.isEnabled && p.status === 'active')

      console.info(`[Plugin Loader] Found ${activePlugins.length} active plugins`)

      return activePlugins
    } catch (err) {
      console.error('[Plugin Loader] Error loading plugin manifests:', err.message)
      return []
    }
  }

  /**
   * Load plugin assets (compiled chunks)
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {Promise<void>}
   */
  async loadPluginAssets(pluginId) {
    try {
      // Load plugin manifest to get asset paths
      const manifestResponse = await fetch(`/plugins/assets/${pluginId}/manifest.json`)
      const manifest = await manifestResponse.json()

      // Load plugin JavaScript
      if (manifest.js) {
        await this.loadScript(`/plugins/assets/${pluginId}/${manifest.js}`)
        console.info(`[Plugin Loader] Loaded assets for plugin: ${pluginId}`)
      }

      // Load plugin CSS
      if (manifest.css) {
        this.loadStylesheet(`/plugins/assets/${pluginId}/${manifest.css}`)
      }
    } catch (err) {
      console.warn(`[Plugin Loader] Failed to load assets for plugin ${pluginId}:`, err.message)
    }
  }

  /**
   * Load a JavaScript file dynamically
   *
   * @param {string} src - Script source URL
   * @returns {Promise<void>}
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
      document.head.appendChild(script)
    })
  }

  /**
   * Load a CSS file dynamically
   *
   * @param {string} href - Stylesheet URL
   */
  loadStylesheet(href) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.appendChild(link)
  }

  /**
   * Initialize a single plugin
   *
   * @param {object} plugin - Plugin metadata from server
   * @param {object} context - Plugin runtime context
   */
  async initializePlugin(plugin, context) {
    try {
      // Parse manifest if it's a string
      const pluginManifest = typeof plugin.manifest === 'string' ?
        JSON.parse(plugin.manifest) :
        (plugin.manifest || {})

      // Check if plugin has client-side code
      if (!pluginManifest.hasClientCode) {
        console.debug(`[Plugin Loader] Plugin ${plugin.id} has no client-side code`)
        return
      }

      // Load plugin assets
      await this.loadPluginAssets(plugin.id)

      // Install Vue plugin (calls the install method which registers components)
      const pluginLibraryName = `WikiPlugin_${plugin.id}`
      if (window[pluginLibraryName]) {
        const pluginModule = window[pluginLibraryName].default || window[pluginLibraryName]
        if (pluginModule && typeof pluginModule.install === 'function') {
          // Validate Vuetify is available before loading plugin
          if (!context.$vuetify) {
            console.error(`[Plugin Loader] Vuetify not available for plugin ${plugin.id}`)
            throw new Error('Vuetify must be initialized before loading plugin components')
          }

          context.Vue.use(pluginModule, {
            pluginId: plugin.id,
            manifest: pluginManifest,
            $vuetify: context.$vuetify,
            $store: context.$store,
            $router: context.$router
          })
          console.info(`[Plugin Loader] Installed Vue plugin: ${plugin.id}`)
        }
      }

      // Register Vuex store modules if declared in manifest
      if (pluginManifest.storeModules && pluginManifest.storeModules.length > 0 && context.$store) {
        await this.registerPluginStores(plugin.id, pluginManifest.storeModules, context.$store)
      }

      // Register plugin in plugins store
      if (context.$store) {
        await context.$store.dispatch('plugins/registerPlugin', {
          plugin: {
            id: plugin.id,
            name: plugin.name,
            version: plugin.version
          },
          manifest: pluginManifest
        })
      }

      // Store plugin metadata
      this.plugins.set(plugin.id, {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        manifest: pluginManifest,
        initialized: true
      })

      console.info(`[Plugin Loader] Initialized plugin: ${plugin.id}`)
    } catch (err) {
      console.error(`[Plugin Loader] Failed to initialize plugin ${plugin.id}:`, err.message)
    }
  }

  /**
   * Register plugin Vuex store modules
   *
   * @param {string} pluginId - Plugin identifier
   * @param {Array} storeModules - Array of store module names
   * @param {object} store - Vuex store instance
   */
  async registerPluginStores(pluginId, storeModules, store) {
    for (const moduleName of storeModules) {
      try {
        const moduleNamespace = `plugin_${pluginId}_${moduleName}`

        // Check if plugin has provided a store module via global registration
        // This happens when the plugin's compiled assets include store modules
        if (window.WIKI_PLUGIN_STORES && window.WIKI_PLUGIN_STORES[moduleNamespace]) {
          const storeModule = window.WIKI_PLUGIN_STORES[moduleNamespace]

          // Validate store module structure
          if (!storeModule || typeof storeModule !== 'object') {
            throw new Error(`Invalid store module structure for ${moduleNamespace}`)
          }

          // Register the module with Vuex
          store.registerModule(moduleNamespace, storeModule)
          console.info(`[Plugin Loader] Registered store module: ${moduleNamespace}`)
        } else {
          // Store module not available - plugin may not have built assets yet
          console.debug(`[Plugin Loader] Store module "${moduleNamespace}" not found. ` +
            'Plugin may need to be rebuilt with "yarn build:plugins".')
        }
      } catch (err) {
        console.warn(`[Plugin Loader] Failed to register store module ${moduleName} for plugin ${pluginId}:`, err.message)
      }
    }
  }

  /**
   * Unregister plugin Vuex store modules
   *
   * @param {string} pluginId - Plugin identifier
   * @param {Array} storeModules - Array of store module names
   * @param {object} store - Vuex store instance
   */
  unregisterPluginStores(pluginId, storeModules, store) {
    for (const moduleName of storeModules) {
      try {
        const moduleNamespace = `plugin_${pluginId}_${moduleName}`

        // Check if module is registered
        if (store.hasModule(moduleNamespace)) {
          store.unregisterModule(moduleNamespace)
          console.info(`[Plugin Loader] Unregistered store module: ${moduleNamespace}`)
        }
      } catch (err) {
        console.warn(`[Plugin Loader] Failed to unregister store module ${moduleName} for plugin ${pluginId}:`, err.message)
      }
    }
  }

  /**
   * Initialize all active plugins
   *
   * @param {object} vueContext - Vue app context ($store, $router, $apollo)
   * @returns {Promise<void>}
   */
  async initializePlugins(vueContext) {
    if (this.initialized) {
      console.warn('[Plugin Loader] Plugins already initialized')
      return
    }

    const manifests = await this.loadPluginManifests()

    if (manifests.length === 0) {
      console.info('[Plugin Loader] No active plugins to initialize')
      this.initialized = true
      return
    }

    // Create runtime context
    const { ClientPluginRuntime } = await import('./runtime')
    const runtime = new ClientPluginRuntime(vueContext)

    // Initialize each plugin
    for (const manifest of manifests) {
      const context = runtime.createContext(manifest)
      await this.initializePlugin(manifest, context)
    }

    this.initialized = true
    console.info(`[Plugin Loader] Successfully initialized ${this.plugins.size} plugins`)
  }

  /**
   * Get loaded plugin by ID
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {object|null} Plugin metadata or null
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId) || null
  }

  /**
   * Get all loaded plugins
   *
   * @returns {Array} Array of plugin metadata
   */
  getAllPlugins() {
    return Array.from(this.plugins.values())
  }

  /**
   * Check if plugin is loaded
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {boolean} True if plugin is loaded
   */
  isPluginLoaded(pluginId) {
    return this.plugins.has(pluginId)
  }
}
