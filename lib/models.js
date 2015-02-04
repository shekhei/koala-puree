"use strict"
var puree = require('../index'),
	glob = require("glob"),
	debug = require('debug')('koala-puree:models'),
	waterline = require('waterline'),
	fdbsql = require("sails-fdbsql");
var DEFAULTCONFIG = {
	"base": "app/model/",
	adapters: {
		'sails-fdbsql': fdbsql
	},
	connections: {
		fdbsql: {
			adapter: 'sails-fdbsql'
		}
	}
}

function genModel(file, base, remove) {
	var name = file.substr(base.length, file.length-(base.length+3));
	remove = remove === undefined ? false : remove;
	var path = require('path').join(process.cwd(),file), schema;
	if ( remove ) {
		delete require.cache[path];
	}
	schema = require(path);
	schema.connection = 'fdbsql'
	schema.tableName = name.toLowerCase();
	schema.collection = name;
	schema.identity = name;
	return schema;
}

var pureeorm = exports = module.exports = function(){

	var orm;
	return {
		setup: function (app) {
			return new Promise(function(resolve, reject) {
				debug(`beginning model middleware`);
				var dburl;
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
				var config = require('extend')({},DEFAULTCONFIG);
				config.connections.fdbsql.url = dburl;
				orm = app._orm = new waterline();
				var update = function(){
					var fs = require('fs');
					glob(config.base+"*.js", function (er, files) {
						if ( er ) { return reject(er); }
						var schemas = [];
						for ( var f of files ) {
							let schema = genModel(f, config.base, app._app.env !== "production")
							orm.loadCollection(require('waterline').Collection.extend(schema))
							schemas.push(schema);
							debug(`loaded ${f} into app.models`);
						}
						debug(`initalizing orm`);
						orm.initialize(config, function(err, models) {
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
																column = `z_order_lat_lon(${column[1]},${column[2]})`;
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
													var query = `CREATE INDEX ${indexName} ON ${schema.tableName}(${columns});`;
													debug(query);
													collection.query(query, function(err){
														if ( err ) { return reject(err); }
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
					
				}

				update();	
			});	
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
