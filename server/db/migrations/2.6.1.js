exports.up = async knex => {
  // Add manifest column to existing plugins table
  const hasManifestColumn = await knex.schema.hasColumn('plugins', 'manifest')
  if (!hasManifestColumn) {
    await knex.schema.table('plugins', table => {
      table.json('manifest')
    })
  }
}

exports.down = async knex => {
  const hasManifestColumn = await knex.schema.hasColumn('plugins', 'manifest')
  if (hasManifestColumn) {
    await knex.schema.table('plugins', table => {
      table.dropColumn('manifest')
    })
  }
}
