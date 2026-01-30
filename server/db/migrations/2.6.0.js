exports.up = async knex => {
  // Create plugins table (main registry)
  await knex.schema.createTable('plugins', table => {
    table.string('id').primary()
    table.string('name').notNullable()
    table.string('version').notNullable()
    table.text('description')
    table.json('author')
    table.string('license')
    table.json('repository')
    table.string('homepage')
    table.specificType('keywords', 'text[]').defaultTo('{}')
    table.json('compatibility')
    table.json('config')
    table.json('manifest')  // Full plugin manifest including UI fields
    table.specificType('permissions', 'text[]').defaultTo('{}')
    table.boolean('isEnabled').notNullable().defaultTo(false)
    table.boolean('isInstalled').notNullable().defaultTo(false)
    table.string('installPath')
    table.string('status').notNullable().defaultTo('inactive')
    table.json('state')
    table.string('installedAt')
    table.string('updatedAt')
    table.string('activatedAt')
  })

  // Create plugin migrations table
  await knex.schema.createTable('pluginMigrations', table => {
    table.increments('id').primary()
    table.string('pluginId').notNullable()
    table.string('migrationName').notNullable()
    table.string('executedAt').notNullable()
    table.unique(['pluginId', 'migrationName'])
  })

  // Create plugin dependencies table
  await knex.schema.createTable('pluginDependencies', table => {
    table.increments('id').primary()
    table.string('pluginId').notNullable()
    table.string('dependsOn').notNullable()
    table.string('versionRange')
  })

  // Create plugin permissions table
  await knex.schema.createTable('pluginPermissions', table => {
    table.increments('id').primary()
    table.string('pluginId').notNullable()
    table.string('permission').notNullable()
    table.string('grantedAt').notNullable()
  })

  // Create plugin errors table
  await knex.schema.createTable('pluginErrors', table => {
    table.increments('id').primary()
    table.string('pluginId').notNullable()
    table.string('errorType').notNullable()
    table.text('errorMessage')
    table.text('stackTrace')
    table.string('createdAt').notNullable()
    table.boolean('resolved').notNullable().defaultTo(false)
  })
}

exports.down = async knex => {
  await knex.schema.dropTableIfExists('pluginErrors')
  await knex.schema.dropTableIfExists('pluginPermissions')
  await knex.schema.dropTableIfExists('pluginDependencies')
  await knex.schema.dropTableIfExists('pluginMigrations')
  await knex.schema.dropTableIfExists('plugins')
}
