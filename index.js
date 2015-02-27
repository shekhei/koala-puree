"use strict"
var readYaml = require('read-yaml'), extend = require('extend');

var socketio = require('socket.io');
var codust = require('co-dust');
var mdns = require('mdns');
var debug = require('debug')('koala-puree')
var Emitter = require('events').EventEmitter;
var co = require('co');
var compose = require('koa-compose');
var closest = require('closest-package');
class Puree extends Emitter {
	constructor(mod, config) {

		var closestPath = closest.sync(require('path').dirname(mod.filename));
		this._basePath = require('path').dirname(closestPath);
		var pkginfo = require('pkginfo')(mod);
		if (!(this instanceof Puree)) return new Puree(mod, config);
		debug(`pwd is ${require('path').resolve('.')}`)
		config = config || "./config/server.yml";
		process.env.NODE_ENV = process.env.NODE_ENV || "development";

		this._config = extend(Puree.DEFAULTCONFIG, readYaml.sync(config)[process.env.NODE_ENV.toLowerCase()]);
		var app = this._app = require('koala')({
			fileServer: {
				root: "./public"
			},
			session: {
				domain: this._config.passport.domain
			}
		});
		this._config.name = pkginfo.name
		this._config.version = pkginfo.version;
		this._pkginfo = pkginfo;
		app.keys = ["notasecret"]
		app.use(function*(next){
			debug("static route")
			if ( this.request.path ) {
				var path = "/static"
				if ( self._ns && self._ns !== "/" ) {
					path = self._ns+path;
				}
				if (this.request.path.startsWith(path)) {
					debug("serving file");
					yield this.fileServer.send(this.request.path.substr((self._ns+"/static").length));
					return;
				}
			}
			debug("path doesnt match");
			yield* next;
		})
		app.use(function*(next){
			debug("jwt xsrf generation")
			// jwt based xsrf token

			if ( "GET HEAD".split(" ").indexOf(this.request.method) >= 0 ) {

			}
			yield* next;
		})
		var dust = new codust({base: require('path').resolve('./app/view')});
		this._dust = dust;
		var helpers = require('./lib/dust_helpers.js')
		helpers(dust._dust);
		//modify koa-trie-router to allow namespace stripping
		var self = this;
		app.use(function*(next){
			//var self = this;
			debug('co-dust middleware');
			var self = this;
			this.render = function*(path, context){
				context = context || {};
				context.loggedIn = self.req.isAuthenticated;
				context.user = self.req.user;
				if ( false === app.puree._config.cacheTemplate ) { delete app.puree._dust._dust.cache[path]; }
				self.body = yield dust.render(path, context);
			}
			yield* next;
		});



		app.puree = this;
		if( this._config.noModel != true ) {
			this.use(require('./lib/models.js'))
		}
		this.use(require('./lib/controllers.js'));
		this.use(require('./lib/sio.js'));
		if ( this._config.noMdns != true) {
			this.use(require('./lib/mdns.js'));
		}
		this.use(require('./lib/service.js').middleware);
		this.use(require('./lib/passport.js'));
		this._ns = "/";
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
	start(app, forConsole) {
		var self = this;
		return new Promise(function(resolve, reject){
			debug('starting server');
			function* startServer(next){
				yield* next;
				var server;
				if ( forConsole ) {
					debug("starting with sock");
					server = self._server = self._app.listen("/tmp/"+Math.random()+Date.now()+".sock");
				} else {
					server = self._server = self._app.listen(self._config.port, "::");
				}
				server.once('listening', function(){
					resolve(self);
					self.emit('listening', self);
				});
			}
			var serverMw = startServer;
			if ( app && "__puree_plate__" in app ) {
				debug('server is mounting');
				serverMw = function* startMounted(next){
					debug('starting server mw')
					yield* next;
					var server;
					self._mounted = true;
					self._server = app._server;
					app.once('listening', function(){
						self.emit('listening', self);
					})
					debug('resolving for mounting server');
					resolve(self);
				}
			}
			debug('preparing to start server');
			try {
				var fn = co.wrap(compose([serverMw].concat(self._middleware.map(function(el){
					return el.setup;
				}).filter(function(el){return undefined !== el;}))));
			} catch(e) { console.log(e); }
			debug('starting server...');
			fn.call(self).catch(reject);

		});
	}
	close(){
		debug("closing service...")
		var self = this;
		return new Promise(function(resolve, reject){
			if ( !self._mounted ) {
				self._server.close();
				self._server.on('close', function(err){
					debug(`server has closed, beginning of the end`);
					if ( err ) { debug(`server temination failed with ${err}`); return reject(err); }
					debug(`server closed`);
					resolve();
				})

			} else {
				resolve();
			}
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
	host: "0.0.0.0",
	passport: {
		domain: "localhost",
		loginUrl: 'locahost/login'
	}
}
Puree.Spices = {
	Service: require('./lib/service').Service,
	Browser: require('./lib/service').Browser,
	Crypt: require('./lib/crypt'),
	JWT: require('./lib/jwt')
}
exports = module.exports = Puree;


