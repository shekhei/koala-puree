"use strict"
var puree = require('../index'),
	glob = require("glob"),
	debug = require('debug')('koala-puree:models'),
	waterline = require('waterline'),
	fdbsql = require("sails-fdbsql");
var DEFAULTCONFIG = {
	adapters: {
		'sails-fdbsql': fdbsql
	},
	connections: {
		fdbsql: {
			adapter: 'sails-fdbsql'
		}
	}
}

function genModel(file, name, remove) {
	remove = remove === undefined ? false : remove;
	var path = require('path').join(process.cwd(),file), schema;
	if ( remove ) {
		delete require.cache[path];
	}
	schema = require(path);
	schema.connection = 'fdbsql'
	schema.tableName = name;
	return require('waterline').Collection.extend(schema);
}

var pureeorm = exports = module.exports = function(){

	var orm;
	return {
		setup: function *(app, next) {
			return new Promise(function(resolve, reject) {
				var dburl;
				if ( app._config.db ) {
					if ( !app._config.db.url ) {
						let username = app._config.db.username || "root";
						let password = app._config.db.password || "root";
						let host = app._config.db.host || "localhost";
						let port = app._config.db.port || "15432";
						let dbname = app._config.dbname || app._config.name;
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
				} else {
					return reject("You have to have dburl defined");
				}
				var config = require('extend')({},DEFAULTCONFIG);
				config.connections.fdbsql.url = dburl;
				orm = app._orm = new waterline();
				var update = function(){
					var fs = require('fs');
					glob("models/*.js", function (er, files) {
						if ( er ) { return reject(er); }
						for ( var f of files ) {
							var name = f.substr(7,f.length-10)
							orm.loadCollection(genModel(f, name, app._app.env !== "production"))
							debug(`loaded ${name} into app.models`);
						}
						debug(`initalizing orm`);
						orm.initialize(config, function(err, models) {
							if ( err ) { debug(`failed to initalize orm ${err}`); return reject(err); }
							app.models = models.collections;
							if ( resolve ) { var tr = resolve;  resolve = undefined; return tr();}	
						});	
					})
					
				}
				if ( app._app.env !== "production") {
					// TODO first make this a very stupid setting
					require('watch')
				}

				update();	
			});	
		},
		teardown: function *(app, next) {
			return new Promise(function(resolve, reject){
				app._orm.teardown(function(err){
					if ( err ) { return reject(err); }
					resolve();
				})
			})
		}
	}

};
