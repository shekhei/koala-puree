"use strict"
var readYaml = require('read-yaml'), extend = require('extend');

var socketio = require('socket.io');
var mdns = require('mdns');
var debug = require('debug')('koala-puree')
var Emitter = require('events').EventEmitter;

class Puree extends Emitter {
	constructor(mod, config) {
		var pkginfo = require('pkginfo')(mod);

		if (!(this instanceof Puree)) return new Puree(mod, config);
		debug(`pwd is ${require('path').resolve('.')}`)
		config = config || "./config/server.yml";

		var app = this._app = require('koala')({
			fileServer: {
				root: "./public"
			}
		});
		app.use(function*(next){
			if ( this.req.path ) {
				if (this.req.path.startsWith(self._ns+"/static")) {
					yield* this.fileServer.send(this.req.path.substr((self._ns+"/static").length));
					return; 
				}
			}
			yield* next;
		})
		//modify koa-trie-router to allow namespace stripping
		app.use(require('koa-views')(require('path').resolve('./views'), {
		  map: {
		    dust: 'dust'
		  }
		}));
		app.use(require('koa-trie-router')(app));
		var self = this;
		var router = require('koa-trie-router')(app);
		router._oldmatch = router.match;
		router.match = function(str){
			// console.log(str);
			return str.indexOf(self._ns)===0 ? router._oldmatch.call(router,str.substring(self._ns.length)) : false;
		}
		app.use(function*(next){
			this.models = self.models;
			yield next;
		});
		app.use(router);

		app.puree = this;
		this._config = extend(Puree.DEFAULTCONFIG, readYaml.sync(config)[app.env]);
		this._config.name = pkginfo.name
		this._config.version = pkginfo.version;
		this._pkginfo = pkginfo;
		this.use(require('./lib/models.js'))
		this.use(require('./lib/controllers.js'));
		this.use(require('./lib/sio.js'));
		this.use(require('./lib/mdns.js'));
		this.use(require('./lib/service.js').middleware);
	}
	get app() { return this._app; }
	get sio() { return this._sio; }
	set namespace(ns) { this._ns = ns; this.emit('namespace', ns);}
	get namespace() { return this._ns; }
	get middleware() { return this._middleware; }
	use(mw){
		this._middleware = this._middleware || [];
		debug("adding middleware");
		this._middleware.push(mw());
	}
	//* app could be a http server or another koala-puree app
	start(app) {
		var self = this;
		// if ( app instanceof Puree ) {
			// self = app.partition(this);
		// }
		return new Promise(function(resolve, reject){
			var server = self._server = self._app.listen(self._config.port, "::");
			server.once('listening', function(){

				debug(`middleware setups`);
				var setups = self._middleware.map(function(el){
					return el.setup ? el.setup(self) : true;
				})
				Promise.all(setups).then(function(){
					resolve(self);
				}, reject);
				
			})
		});
		
	}
	close(){
		debug("closing service...")
		var self = this;
		return new Promise(function(resolve, reject){
			self._server.close();
			self._server.on('close', function(err){
				debug(`server has closed, beginning of the end`);
				if ( err ) { debug(`server temination failed with ${err}`); return reject(err); }
				debug(`server closed`);
				resolve();
			})
			var setups = self._middleware.map(function(el){
				return el.teardown ? el.teardown(self) : Promise.resolve(true);
			})
			Promise.all(setups).then(function(){
				debug(`middleware teardown completed, closing server`);
				// self._server.close();
			}, reject);
		});
	}
};


Puree.DEFAULTCONFIG = {
	port: 3000,
	host: "0.0.0.0"
}
Puree.Spices = {
	Service: require('./lib/service').Service,
	Browser: require('./lib/service').Browser,
	Crypt: require('./lib/crypt')
}
exports = module.exports = Puree;


