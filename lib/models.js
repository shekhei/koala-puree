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
	schema.tableName = name.toLowerCase();
	schema.collection = name;
	schema.identity = name;
	debug(`generating model: ${path}`);
	return require('waterline').Collection.extend(schema);
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
					glob("model/*.js", function (er, files) {
						if ( er ) { return reject(er); }
						for ( var f of files ) {
							var name = f.substr(6,f.length-9)
							orm.loadCollection(genModel(f, name, app._app.env !== "production"))
							debug(`loaded ${name} into app.models`);
						}
						debug(`initalizing orm`);
						orm.initialize(config, function(err, models) {
							if ( err ) { debug(`failed to initalize orm ${err}`); return reject(err); }
							app.models = models.collections;
							debug(`completed initializaing orm`);
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
