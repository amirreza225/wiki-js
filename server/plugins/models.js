const fs = require('fs-extra')
const path = require('path')
const { Model } = require('objection')

/**
 * Plugin Model Loader
 *
 * Handles discovery and registration of Objection.js models from plugins.
 * Enforces table naming convention: plugin_<pluginId>_*
 */
module.exports = class PluginModelLoader {
  constructor() {
    this.pluginModels = new Map() // Map<pluginId, Map<modelName, Model>>
  }

  /**
   * Discover models from plugin directory
   *
   * @param {string} pluginId - Plugin identifier
   * @param {string} pluginPath - Absolute path to plugin directory
   * @returns {Promise<Map<string, Model>>} Map of model name to model class
   */
  async discoverModels(pluginId, pluginPath) {
    const modelsPath = path.join(pluginPath, 'server', 'models')

    if (!await fs.pathExists(modelsPath)) {
      WIKI.logger.debug(`No models directory found for plugin ${pluginId}`)
      return new Map()
    }

    const models = new Map()
    const modelFiles = await fs.readdir(modelsPath)

    for (const file of modelFiles) {
      if (!file.endsWith('.js')) {
        continue
      }

      const modelPath = path.join(modelsPath, file)
      const modelName = path.basename(file, '.js')

      try {
        // Load model module
        const ModelClass = require(modelPath)

        // Validate it extends Objection Model
        if (!(ModelClass.prototype instanceof Model)) {
          WIKI.logger.warn(`Plugin ${pluginId} model ${modelName} does not extend Objection Model`)
          continue
        }

        // Validate table name prefix
        if (ModelClass.tableName) {
          this.validateTablePrefix(pluginId, ModelClass.tableName)
        }

        models.set(modelName, ModelClass)
        WIKI.logger.debug(`Discovered model ${modelName} for plugin ${pluginId}`)
      } catch (err) {
        WIKI.logger.error(`Failed to load model ${modelName} for plugin ${pluginId}: ${err.message}`)
      }
    }

    return models
  }

  /**
   * Validate table name follows plugin naming convention
   *
   * @param {string} pluginId - Plugin identifier
   * @param {string} tableName - Table name to validate
   * @throws {Error} If table name doesn't follow convention
   */
  validateTablePrefix(pluginId, tableName) {
    const expectedPrefix = `plugin_${pluginId}_`

    if (!tableName.startsWith(expectedPrefix)) {
      throw new Error(
        `Invalid table name "${tableName}" for plugin ${pluginId}. ` +
        `Table names must be prefixed with "${expectedPrefix}". ` +
        `Example: ${expectedPrefix}items`
      )
    }
  }

  /**
   * Register plugin models with Objection.js
   *
   * @param {string} pluginId - Plugin identifier
   * @param {Map<string, Model>} models - Map of model name to model class
   * @param {object} knex - Knex database instance
   */
  registerPluginModels(pluginId, models, knex) {
    if (this.pluginModels.has(pluginId)) {
      WIKI.logger.warn(`Plugin ${pluginId} models already registered, skipping`)
      return
    }

    // Bind models to database connection
    for (const [modelName, ModelClass] of models.entries()) {
      try {
        ModelClass.knex(knex)
        WIKI.logger.debug(`Registered model ${modelName} for plugin ${pluginId}`)
      } catch (err) {
        WIKI.logger.error(`Failed to register model ${modelName} for plugin ${pluginId}: ${err.message}`)
      }
    }

    // Store models for later unregistration
    this.pluginModels.set(pluginId, models)

    WIKI.logger.info(`Registered ${models.size} models for plugin ${pluginId}`)
  }

  /**
   * Unregister plugin models
   *
   * @param {string} pluginId - Plugin identifier
   */
  unregisterPluginModels(pluginId) {
    const models = this.pluginModels.get(pluginId)

    if (!models) {
      WIKI.logger.debug(`No models registered for plugin ${pluginId}`)
      return
    }

    // Clear module cache for plugin models
    for (const [modelName, ModelClass] of models.entries()) {
      const modulePath = ModelClass.__filename
      if (modulePath && require.cache[modulePath]) {
        delete require.cache[modulePath]
        WIKI.logger.debug(`Unloaded model ${modelName} for plugin ${pluginId}`)
      }
    }

    this.pluginModels.delete(pluginId)
    WIKI.logger.info(`Unregistered models for plugin ${pluginId}`)
  }

  /**
   * Get models for a specific plugin
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {Map<string, Model>|null} Map of model name to model class
   */
  getPluginModels(pluginId) {
    return this.pluginModels.get(pluginId) || null
  }

  /**
   * Check if plugin has registered models
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {boolean} True if plugin has models
   */
  hasPluginModels(pluginId) {
    return this.pluginModels.has(pluginId)
  }

  /**
   * Get all plugin models as a flat object
   *
   * @param {string} pluginId - Plugin identifier
   * @returns {object} Object with model names as keys
   */
  getPluginModelsObject(pluginId) {
    const models = this.pluginModels.get(pluginId)

    if (!models) {
      return {}
    }

    const modelsObj = {}
    for (const [modelName, ModelClass] of models.entries()) {
      modelsObj[modelName] = ModelClass
    }

    return modelsObj
  }
}
