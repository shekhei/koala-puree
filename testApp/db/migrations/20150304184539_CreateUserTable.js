'use strict';

exports.up = function(knex, Promise) {
  return knex.schema.createTable('user', function(table){
  	table.increments();
  	table.string('name');
  	table.timestamps();
  }).createTable('user_alias', function(table){
  	table.increments();
  	table.string('type');
  	table.string('value');
  	table.string('provider');
  	table.decimal('lat');
  	table.decimal('lng');
  	table.integer('user_id').references('user.id');
    table.timestamp('created_at').defaultTo(knex.raw('now()'))
  	// table.timestamp('updated_at')
      // .defaultTo(knex.raw('now()'))
    table
      .timestamp('updated_at')
      .defaultTo(knex.raw('now()'));
  })
};

exports.down = function(knex, Promise) {
	return knex.schema.dropTable('user_alias').dropTable('user');
};
