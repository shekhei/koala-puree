"use strict"
var puree = require('../index'),
	glob = require("glob"),
	debug = require('debug')('koala-puree:models'),
	waterline = require('waterline'),
	fdbsql = require("sails-fdbsql");
var config = {
	adapters: {
		'sails-fdbsql': fdbsql
	},
	connections: {
		fdbsql: {
			adapter: 'sails-fdbsql',
			url: 'fdb://root:root@localhost:15432/eskygo',
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
