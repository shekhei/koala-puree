"use strict"
var puree = require('../index'),
	glob = require("glob"),
	debug = require('debug')('koala-puree:controllers');

function genController(file, name, remove) {
	remove = remove === undefined ? false : remove;
	var path = require('path').join(process.cwd(),file), handlers;
	if ( remove ) {
		delete require.cache[path];
	}
	debug(`generating controller: ${path}`);
	var handlers = require(path);
	return handlers;
}

var pureecontrollers = exports = module.exports = function(){

	return {
		setup: function (app) {
			return new Promise(function(resolve, reject) {
				debug(`beginning controller middleware`);
				var update = function(){
					app.controllers = {};
					var fs = require('fs');
					glob("controller/*.js", function (er, files) {
						if ( er ) { return reject(er); }
						for ( var f of files ) {
							var name = f.substr(7,f.length-10)
							app.controllers[name] = genController(f, name, app._app.env !== "production");
							app.controllers[name](app);
							debug(`loaded ${name} into app.controllers`);
						}
						debug(`initalizing controllers`);
						resolve();
					})
					
				}
				if ( app._app.env !== "production") {
					// TODO first make this a very stupid setting
					require('watch')
				}

				update();	
			});	
		}
	}

};
