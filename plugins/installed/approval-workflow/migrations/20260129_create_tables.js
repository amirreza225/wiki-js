/**
 * Create Approval Workflow Tables
 */

exports.up = async function(knex) {
  // Create approval requests table
  await knex.schema.createTable('plugin_approval-workflow_requests', table => {
    table.increments('id').primary()
    table.integer('pageId').notNullable()
    table.string('pagePath').notNullable()
    table.string('pageTitle').notNullable()
    table.integer('requesterId').notNullable()
    table.string('requesterName').notNullable()
    table.string('requesterEmail').notNullable()
    table.integer('approverId').nullable()
    table.string('approverName').nullable()
    table.enum('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending')
    table.boolean('isNew').notNullable().defaultTo(false)
    table.text('changeDescription').notNullable()
    table.text('approverNotes').nullable()
    table.string('requestedAt').notNullable()
    table.string('reviewedAt').nullable()

    // Indexes
    table.index('pageId')
    table.index('requesterId')
    table.index('status')
    table.index('requestedAt')
  })

  // Create approval settings table
  await knex.schema.createTable('plugin_approval-workflow_settings', table => {
    table.increments('id').primary()
    table.string('pathPattern').notNullable()
    table.string('locale').notNullable().defaultTo('en')
    table.boolean('requireApproval').notNullable().defaultTo(true)
    table.boolean('autoApprove').notNullable().defaultTo(false)
    table.json('approverUserIds').nullable()
    table.json('approverGroupIds').nullable()
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()

    // Indexes
    table.index('pathPattern')
    table.index('locale')
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('plugin_approval-workflow_settings')
  await knex.schema.dropTableIfExists('plugin_approval-workflow_requests')
}
