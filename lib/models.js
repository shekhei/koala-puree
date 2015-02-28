"use strict"
var puree = require('../index'),
	glob = require("glob"),
	debug = require('debug')('koala-puree:models'),
	waterline = require('waterline'),
	fdbsql = require("sails-fdbsql");

debug('syncable? ', process.env.MODELSYNC == true)
fdbsql.syncable = (process.env.MODELSYNC == true);
var DEFAULTCONFIG = {
	"base": "app/model/",
	adapters: {
		'sails-fdbsql': fdbsql
	},
	connections: {
	}
}

function genModel(file, base, remove, connName) {
	var name = file.substr(base.length, file.length-(base.length+3));
	remove = remove === undefined ? false : remove;
	var path = require('path').join(process.cwd(),file), schema;
	if ( remove ) {
		delete require.cache[path];
	}
	schema = require(path);
	schema.connection = connName
	schema.tableName = name.toLowerCase();
	schema.collection = name;
	schema.identity = name;
	return schema;
}

var pureeorm = exports = module.exports = function(){

	var orm;
	return {
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
			let _config = require('extend')(DEFAULTCONFIG,{connections:{}});
			debug("Creating waterline model");
			orm = app._orm = new waterline();
			app._app.use(function*(next){
				debug("adding models to this scope")
				this.models = app.models;
				yield* next;
			});
			debug('update')
			yield new Promise(function(resolve, reject){
				var fs = require('fs');
				glob(_config.base+"*.js", function (er, files) {
					if ( er ) { return reject(er); }
					debug("creating adapter identity", connectionName);
					_config.connections = {};
					_config.connections[connectionName] = {};
					_config.connections[connectionName].adapter = "sails-fdbsql";
					_config.connections[connectionName].url = dburl;
					var schemas = [];
					for ( var f of files ) {
						let schema = genModel(f, _config.base, app._app.env !== "production", connectionName);
						orm.loadCollection(require('waterline').Collection.extend(schema))
						schemas.push(schema);
						debug(`loaded ${f} into app.models`);
					}
					debug(`initalizing orm`);
					orm.initialize(_config, function(err, models) {
						if ( err ) { debug(`failed to initalize orm ${err}`); return reject(err); }
						// now lets call the special things
						for ( var i = 0; i < schemas.length; i++) {
							if ( require('util').isFunction(schemas[i].afterSchemaCreate)) {
								schemas[i] = (function(schema){
									var ExtraSchema = {
										index: function(){
											var args = arguments;
											return new Promise(function(resolve){
												var columns = [];

												var collection = models.collections[schema.tableName],
													indexName = ['idx'];

												for(let column of args) {
													if ( require('util').isArray(column) ) {
														if ( "spatial" === column[0] ) {
															indexName.push(`z_${column[1]}_${column[2]}`);
															column = `${column[1]},${column[2]}`;
														} else {
															throw `${column[0]} is not a supported type`;
														}
													} else {
														indexName.push(column);
													}

													columns.push(column);
												}

												indexName = indexName.join("_");
												columns = columns.join(",");
												var query = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${schema.tableName}(${columns});`;
												debug(query);
												collection.query(query, function(err){
													if ( err ) { debug(`failed to create index: ${indexName}`, err);return reject(err); }
													debug(`index ${indexName} finished`);
													resolve();
												})
											});
										}
									}

									var p = schema.afterSchemaCreate(ExtraSchema);
									delete schema.afterSchemaCreate;
									return p;
								})(schemas[i]);

							} else {
								schemas[i] = true;
							}
						}
						Promise.all(schemas).then(function(){
							app.models = models.collections;
							debug(`completed initializaing orm`);
							if ( resolve ) { var tr = resolve;  resolve = undefined; return tr();}		
						}).catch(function(err){
							reject(err);
						})
						
					});	
				})
			});
			yield* next;
		},
		teardown: function (app) {
			return new Promise(function(resolve, reject){
				debug(`beginning teardown`);
				app._orm.teardown(function(err){
					debug(`completing teardown`);
					if ( err ) { return reject(err); }
					resolve();
				})
			})
		}
	}

};
