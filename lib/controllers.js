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
		setup: function* (next) {
			debug("beginning controller middleware setup");
			var app = this;
			yield* next;
			var router = app._app.use(require('koa-trie-router')(app._app));
			router._oldmatch = router.match;
			router.match = function(str){
				console.log("matching str");
				return str.indexOf(self._ns)===0 ? router._oldmatch.call(router,str.substring(self._ns.length)) : false;
			}
			
			this._router = router;
			for ( let method of require('methods') ) {
				app[method] = function(route, fn){
					app._app[method](route, fn);
				}
			}
			// add a new middleware between trie-router to allow namespacing
			yield (new Promise(function(resolve, reject) {
				debug(`beginning controller middleware`);
				var update = function(){
					app.controllers = {};
					var fs = require('fs');
					glob("app/controller/*.js", function (er, files) {
						if ( er ) { return reject(er); }
						for ( var f of files ) {
							var name = f.substr(15,f.length-18)
							app.controllers[name] = genController(f, name, app._app.env !== "production");
							app.controllers[name](app);
							debug(`loaded ${name} into app.controllers`);
						}
						debug(`complete initalizing controllers`);
						resolve();
					})
					
				}

				update();	
			}));
			debug("completing controller middleware setup");
		}
	}

};
