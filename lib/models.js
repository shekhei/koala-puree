"use strict"
var puree = require('../index'),
	glob = require("glob"),
	debug = require('debug')('koala-puree:models'),
	Bookshelf = require('bookshelf'),
	Knex = require("knex"),
	checkIt = require('checkit');

var DEFAULTCONFIG = {
	"base": "app/model/",
	dialect: 'fdbsql'
}

class ModelBuilder {
	constructor(bookshelf) {
		var self = this;
		this._bookshelf = bookshelf;
		this._keys = {
			_beforeSave: function(){
				this.set('updated_at', self._bookshelf.knex.raw('now()'))
				return self._checkIt.run(this.attributes);
			},
			initialize: function(){
				this.on('saving', this._beforeSave);
				if ( self._initializer ) {
					return self._initializer.apply(this, [].slice.call(arguments,0))
				}
			},
			count: function count(key) {
				return this.query(function(qb){
					return qb.count(key||"*")
				}).fetch();
			},
		}
		this._static = {
			"delete": function del() {
				return this.query(function(qb){
					return qb.del()
				}).fetch();
			}
		}
		this._rules = {};
	}
	initialize(func) {
		this._initializer = func;
	}
	attr(key, val) {
		this._keys[key] = val;
		return this;
	}
	static(key, val) {
		this._static[key] = val;
		return this;
	}
	validate(key, rules) {
		this._rules[key] = rules;
		return this;
	}
	build() {
		this._checkIt = new checkIt(this._rules);
		return this._bookshelf.Model.extend(this._keys, this._static);
	}
}

function genModel(file, remove, bookshelf, context, app) {

	var name = require('path').basename(file, ".js");
	remove = remove === undefined ? false : remove;
	var path = file, schema;
	if ( remove ) {
		delete require.cache[path];
	}
	var modelDef = require(path);
	var builder = new ModelBuilder(bookshelf);
	modelDef.call(builder, context, app);
	builder.attr('tableName', name.replace(/(.?)([A-Z])/g, function(match, first, second){
		var s = second.toLowerCase();
		if ( first ) { s = first+"_"+s;}
		return s;
	}))

	context[name] = builder.build();

	return name;
}

var pureeorm = exports = module.exports = function(){

	var orm;
	var obj = {
		setup: function *setupModel(next) {
			
			var app = this;
			debug(`beginning model middleware`);
			var dburl;
			var connectionName = "fdb"+Math.random()+Date.now();

			if ( !app._config.db || !app._config.db.url ) {
				let config = app._config.db || {}
				let username = config.username || "root";
				let password = config.password || "root";
				let host = config.host || "localhost";
				let port = config.port || "15432";
				let dbname = config.dbname || app._config.name;
				if ( !dbname ) {
					return reject("dbname or package name has to be provided");
				}
				if ( app._app.env !== "production" ) {
					dbname = `${dbname}-${app._app.env}`;
				}
				dburl = `fdb://${username}:${password}@${host}:${port}/${dbname}`;
			} else {
				dburl = app._config.db.url
			}
			let _config = require('extend')({}, DEFAULTCONFIG,{connection:{}});
			debug("Creating waterline model");
			orm = app._orm = obj.getBookshelf(app);
			app._app.use(function*(next){
				debug("adding models to this scope")
				this.models = app.models;
				yield* next;
			});
			debug('update')
			yield new Promise(function(resolve, reject){
				var fs = require('fs');
				glob(require('path').resolve(app._basePath,_config.base+"*.js"),function (er, files) {
					console.log(files);
					if ( er ) { return reject(er); }
					debug("creating adapter identity", connectionName);
					var config = obj.getConfig(app);	
					// var schemas = [];
					var context = {};
					app.models = {};
					for ( var f of files ) {
						let name = genModel(f, app._app.env !== "production", app._orm, context, app);
						// orm.loadCollection(require('waterline').Collection.extend(schema))
						// schemas.push(schema);
						app.models[name] = context[name];
						debug(`loaded ${f} into app.models`);
					}
					if ( resolve ) { var tr = resolve;  resolve = undefined; return tr();}
					// debug(`initalizing orm`);
					// orm.initialize(_config, function(err, models) {
					// 	if ( err ) { debug(`failed to initalize orm ${err}`); return reject(err); }
					// 	// now lets call the special things
					// 	for ( var i = 0; i < schemas.length; i++) {
					// 		if ( require('util').isFunction(schemas[i].afterSchemaCreate)) {
					// 			schemas[i] = (function(schema){
					// 				var ExtraSchema = {
					// 					index: function(){
					// 						var args = arguments;
					// 						return new Promise(function(resolve){
					// 							var columns = [];

					// 							var collection = models.collections[schema.tableName],
					// 								indexName = ['idx'];

					// 							for(let column of args) {
					// 								if ( require('util').isArray(column) ) {
					// 									if ( "spatial" === column[0] ) {
					// 										indexName.push(`z_${column[1]}_${column[2]}`);
					// 										column = `${column[1]},${column[2]}`;
					// 									} else {
					// 										throw `${column[0]} is not a supported type`;
					// 									}
					// 								} else {
					// 									indexName.push(column);
					// 								}

					// 								columns.push(column);
					// 							}

					// 							indexName = indexName.join("_");
					// 							columns = columns.join(",");
					// 							var query = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${schema.tableName}(${columns});`;
					// 							debug(query);
					// 							collection.query(query, function(err){
					// 								if ( err ) { debug(`failed to create index: ${indexName}`, err);return reject(err); }
					// 								debug(`index ${indexName} finished`);
					// 								resolve();
					// 							})
					// 						});
					// 					}
					// 				}

					// 				var p = schema.afterSchemaCreate(ExtraSchema);
					// 				delete schema.afterSchemaCreate;
					// 				return p;
					// 			})(schemas[i]);

					// 		} else {
					// 			schemas[i] = true;
					// 		}
					// 	}
					// 	Promise.all(schemas).then(function(){
					// 		app.models = models.collections;
					// 		debug(`completed initializaing orm`);
					// 		if ( resolve ) { var tr = resolve;  resolve = undefined; return tr();}		
					// 	}).catch(function(err){
					// 		reject(err);
					// 	})
						
					// });	
				})
			});
			yield* next;
		},
		teardown: function(app){
			return new Promise(function(resolve, reject){
				app._orm.knex.destroy(function(){
					resolve();
				})
			});
		},
		getConfig: function(app) {
			var dburl;
			var connectionName = "fdb"+Math.random()+Date.now();
			var dbname;
			var config = require('extend')({}, DEFAULTCONFIG,{connection:{}});
			if ( !app._config.db || !app._config.db.url ) {
				var _config = app._config.db || {}
				let username = config.username || "root";
				let password = config.password || "root";
				let host = config.host || "localhost";
				let port = config.port || "15432";
				let dbname = config.dbname || app._config.name;
			
				if ( !dbname ) {
					return reject("dbname or package name has to be provided");
				}
				if ( app._app.env !== "production" ) {
					dbname = `${dbname}-${app._app.env}`;
				}
				config.connection = {
					host: host,
					user: username,
					password: password,
					port: port,
					database: dbname
				};
				dburl = `fdb://${username}:${password}@${host}:${port}/${dbname}`;
			} else {
				dburl = app._config.db.url
			}
			return config;
		},
		createMigration: function(app, name) {
			var config = obj.getConfig(app);
			config.directory = "./db/migrations";
			var bookshelf = obj.getBookshelf(app);
			return bookshelf.knex.migrate.make(name, config);
		},
		migrate: function(app){
			var config = obj.getConfig(app)
			config.directory = "./db/migrations";
			var bookshelf = obj.getBookshelf(app);
			return bookshelf.knex.migrate.latest(config);
		},
		rollback: function(app){
			var config = obj.getConfig(app)
			config.directory = "./db/migrations";
			var bookshelf = obj.getBookshelf(app);
			return bookshelf.knex.migrate.rollback(config);
		},
		getBookshelf: function(app){
			var knex = new Knex(obj.getConfig(app));
			var bookshelf = new Bookshelf(knex);
			return bookshelf;
		}
	}
	return obj;
};
