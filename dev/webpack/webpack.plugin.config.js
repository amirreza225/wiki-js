const fs = require('fs-extra')
const path = require('path')
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

/**
 * Generate webpack configuration for a specific plugin
 *
 * @param {string} pluginId - Plugin identifier
 * @param {string} pluginPath - Absolute path to plugin directory
 * @returns {object} Webpack configuration
 */
function createPluginWebpackConfig(pluginId, pluginPath) {
  const WIKI_ROOTPATH = path.resolve(__dirname, '../..')
  const outputPath = path.join(WIKI_ROOTPATH, 'plugins', 'cache', pluginId)

  return {
    mode: 'production',
    entry: {
      [pluginId]: path.join(pluginPath, 'client', 'index.js')
    },
    output: {
      path: outputPath,
      filename: '[name].[contenthash:8].js',
      chunkFilename: '[name].[contenthash:8].chunk.js',
      library: `WikiPlugin_${pluginId}`,
      libraryTarget: 'umd',
      publicPath: `/plugins/assets/${pluginId}/`
    },
    module: {
      rules: [
        // Vue single-file components
        {
          test: /\.vue$/,
          loader: 'vue-loader'
        },
        // JavaScript
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: {
                    browsers: ['> 1%', 'last 2 versions']
                  }
                }]
              ]
            }
          }
        },
        // CSS/SCSS
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
          ]
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'sass-loader'
          ]
        },
        // Images
        {
          test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
          loader: 'url-loader',
          options: {
            limit: 10000,
            name: 'img/[name].[hash:8].[ext]'
          }
        },
        // Fonts
        {
          test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
          loader: 'url-loader',
          options: {
            limit: 10000,
            name: 'fonts/[name].[hash:8].[ext]'
          }
        }
      ]
    },
    plugins: [
      new CleanWebpackPlugin(),
      new VueLoaderPlugin(),
      new MiniCssExtractPlugin({
        filename: '[name].[contenthash:8].css'
      })
    ],
    resolve: {
      extensions: ['.js', '.vue', '.json'],
      alias: {
        'vue$': 'vue/dist/vue.esm.js',
        '@': path.join(pluginPath, 'client')
      }
    },
    externals: [
      {
        // Don't bundle these - use from host app
        'vue': 'Vue',
        'vuex': 'Vuex',
        'vue-router': 'VueRouter',
        'axios': 'axios',
        'apollo-client': 'apolloClient',
        'graphql-tag': 'gql'
        // Note: vuetify is NOT externalized - plugins rely on globally registered components
      }
    ],
    performance: {
      hints: false
    },
    stats: {
      children: false,
      modules: false
    }
  }
}

/**
 * Build all installed plugins
 */
async function buildAllPlugins() {
  const WIKI_ROOTPATH = path.resolve(__dirname, '../..')
  const pluginsPath = path.join(WIKI_ROOTPATH, 'plugins', 'installed')

  if (!await fs.pathExists(pluginsPath)) {
    console.log('[Plugin Build] No plugins to build')
    return
  }

  const webpack = require('webpack')
  const pluginDirs = await fs.readdir(pluginsPath)
  const buildPromises = []

  for (const pluginDir of pluginDirs) {
    const pluginPath = path.join(pluginsPath, pluginDir)
    const clientIndexPath = path.join(pluginPath, 'client', 'index.js')

    // Only build plugins with client-side code
    if (!await fs.pathExists(clientIndexPath)) {
      continue
    }

    console.log(`[Plugin Build] Building plugin: ${pluginDir}`)

    const config = createPluginWebpackConfig(pluginDir, pluginPath)
    const compiler = webpack(config)

    const buildPromise = new Promise((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          console.error(`[Plugin Build] Failed to build ${pluginDir}:`, err)
          reject(err)
          return
        }

        if (stats.hasErrors()) {
          console.error(`[Plugin Build] Build errors for ${pluginDir}:`, stats.toString('errors-only'))
          reject(new Error(`Build failed for ${pluginDir}`))
          return
        }

        // Generate manifest.json
        const assets = stats.toJson({ assets: true }).assets
        const manifest = {
          plugin: pluginDir,
          version: Date.now(),
          assets: {}
        }

        assets.forEach(asset => {
          if (asset.name.endsWith('.js')) {
            manifest.js = asset.name
            manifest.assets.js = asset.name
          } else if (asset.name.endsWith('.css')) {
            manifest.css = asset.name
            manifest.assets.css = asset.name
          }
        })

        const manifestPath = path.join(WIKI_ROOTPATH, 'plugins', 'cache', pluginDir, 'manifest.json')
        fs.writeJsonSync(manifestPath, manifest, { spaces: 2 })

        console.log(`[Plugin Build] Successfully built plugin: ${pluginDir}`)
        resolve()
      })
    })

    buildPromises.push(buildPromise)
  }

  await Promise.all(buildPromises)
  console.log(`[Plugin Build] Built ${buildPromises.length} plugins`)
}

// If run directly, build all plugins
if (require.main === module) {
  buildAllPlugins().catch(err => {
    console.error('[Plugin Build] Fatal error:', err)
    process.exit(1)
  })
}

// Export functions
module.exports = createPluginWebpackConfig
module.exports.buildAllPlugins = buildAllPlugins
module.exports.createPluginWebpackConfig = createPluginWebpackConfig
