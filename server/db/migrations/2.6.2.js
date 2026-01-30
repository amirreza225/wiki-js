exports.up = async knex => {
  // Add level column to pluginErrors table to support all log levels
  await knex.schema.table('pluginErrors', table => {
    table.string('level').notNullable().defaultTo('error')
  })

  // Rename errorType to context for better semantics
  await knex.schema.table('pluginErrors', table => {
    table.renameColumn('errorType', 'context')
  })

  // Rename errorMessage to message
  await knex.schema.table('pluginErrors', table => {
    table.renameColumn('errorMessage', 'message')
  })

  // Update existing records to have 'error' level
  await knex('pluginErrors').update({ level: 'error' })
}

exports.down = async knex => {
  // Revert column renames
  await knex.schema.table('pluginErrors', table => {
    table.renameColumn('message', 'errorMessage')
  })

  await knex.schema.table('pluginErrors', table => {
    table.renameColumn('context', 'errorType')
  })

  // Remove level column
  await knex.schema.table('pluginErrors', table => {
    table.dropColumn('level')
  })
}
