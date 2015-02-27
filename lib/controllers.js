"use strict"
var puree = require('../index'),
	glob = require("glob"),
	debug = require('debug')('koala-puree:controllers');

function genController(file, name, remove) {
	remove = remove === undefined ? false : remove;
	var path = require('path').join(file), handlers;
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
			app._app.use(function*(next){
				yield* next;
			});
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
					if ( arguments.length < 2 ) {
						throw `${method} ${route} handler has to have at least one fn`;
					}
					var fn = fn;
					if ( arguments.length > 2 ) {
						var fns = [].slice.call(arguments, 1);
						console.log(fns);
						fn = require('koa-compose')(fns);
					}
					app._app[method](route, fn);
				}
			}
			app.group = function(path, fn){
				debug("group is called with "+path);
				var router = [], mw = [].slice.call(arguments, 1, arguments.length -2);
				console.log(mw);
				for ( let method of require('methods') ) {
					router[method] = function() {

						var args = [].slice.call(arguments, 0);
						debug("group router is triggered: "+args[0]+" transform into "+path+args[0]);
						args[0] = path+args[0];

						args.splice.apply(args, [1,0].concat(mw));
						console.log(args);
						app[method].apply(app, args);
					}
				}
				arguments[arguments.length-1](router);
			}
			// add a new middleware between trie-router to allow namespacing
			yield (new Promise(function(resolve, reject) {
				debug(`beginning controller middleware`);
				var update = function(){
					app.controllers = {};
					var fs = require('fs');
					glob(require("path").resolve(app._basePath,"./app/controller/**/*.js"), function (er, files) {

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
