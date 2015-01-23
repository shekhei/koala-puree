var readYaml = require('read-yaml'), extend = require('extend');

var socketio = require('socket.io');
var mdns = require('mdns');
var debug = require('debug')('koala-puree')

var Puree = function(mod, config){
	require('pkginfo')(mod);
	var pkginfo = mod.exports;
	if (!(this instanceof Puree)) return new Puree;
	debug(`pwd is ${require('path').resolve('.')}`)
	config = config || "./config/server.yml";

	var app = this._app = require('koala')();
	app.use(require('koa-trie-router')(app));
	debug('attaching middleware');
	app.use(function*(next){
		debug('called middleware');
		yield next;
	});
	this._config = extend(puree.DEFAULTCONFIG, readYaml.sync(config)[app.env]);
	this._config.name = pkginfo.name
	this._config.version = pkginfo.version;
	this.use(require('./lib/models.js'))
	this.use(require('./lib/controllers.js'));
}

var puree = Puree.prototype = {
	get app() { return this._app; },
	get sio() { return this._sio; },
	set namespace(ns) { this._ns = ns; },
	get namespace() { return this._ns; },
	get middleware() { return this._middleware; },
	use: function(mw){
		this._middleware = this._middleware || [];
		debug("adding middleware");
		this._middleware.push(mw());
	},
	request: function(method, route, handler){
		return this._app[method](route, handler);
	},
	get: function(route, handler) {
		return this.request('get', route, handler);
	},
	post: function(route, handler) {
		return this.request('post', route, handler);
	},
	put: function(route, handler) {
		return this.request('put', route, handler);
	},
	delete: function(route, handler) {
		return this.request('delete', route, handler);
	},
	start: function() {
		var self = this;
		var setups = this._middleware.map(function(el){
			return el.setup ? el.setup(self) : true;
		})
		setups.push(new Promise(function(resolve, reject){
			debug("middleware setup completed, server begin listening")
			var server = self._server = self._app.listen(self._config.port, "::");
			server.once('listening', function(){
				debug("server started listening");
				var adSettings = {
					name: self._config.name,
					txtRecord: {
						name: self._config.name, // cant put into subtype, it is too long
						version: self._config.version
					},
					flags: mdns.kDNSServiceFlagsForceMulticast
				};
				// TODO: consider if ad interface should be an array, else not, loopback would not work
				if ( self._config.mdns && self._config.mdns.ad ) {
					if (undefined !== self._config.mdns.ad.interface) {
						if ( self._config.mdns.ad.interface === "lo") {
							adSettings.networkInterface = mdns.loopbackInterface();
							adSettings.host = "localhost";
						} else {
							adSettings.networkInterface = self._config.mdns.ad.interface;
						}
					}
					if (self._config.mdns.ad.domain) { 
						adSettings.domain = self._config.mdns.ad.domain;
					}
				}
				function handleError(e){
					console.log(e,e.stack);
				}
				try {
					debug(`beginning advertisement ${adSettings}`);
					this._ad = new mdns.Advertisement(mdns.makeServiceType({name:'koala-puree', protocol:'tcp'}), self._config.port, adSettings, function(err, service){
						debug(`service registered: ${err} ${service.name}`);
						resolve(self);
					});
					this._ad.on('error', handleError);
					debug(`starting advertisement ${adSettings}`);
					this._ad.start();
				} catch(e) {
					handleError(e);
				}
			}, function(err){
				handleError(err);
			})
			require('./lib/sio')(self, server);
		}));
		return new Promise(function(resolve, reject){
			Promise.all(setups).then(function(){
				resolve(self);
			});
		});
		
	},
	close: function(){
		debug("closing service...")
		var self = this;
		var setups = this._middleware.map(function(el){
			return el.teardown ? el.teardown(self) : Promise.resolve(true);
		})
		setups.push(new Promise(function(resolve, reject){
			debug(`closing server...`);

			self._server.close(function(err){
				this._ad.stop();
				debug(`server has closed, beginning of the end`);
				if ( err ) { debug(`server temination failed with ${err}`); return reject(err); }
				debug(`server closed`);
				resolve(self);
			});
			self._sio.close();
		}));
		return new Promise(function(resolve, reject){
			Promise.all(setups).then(function(){
				debug(`all teardowns completed`);
				resolve(self);
			}, function(err){
				debug(`teardown failed with error:${err}`);
				reject(err);
			});
		});
	}
};

puree.DEFAULTCONFIG = {
	port: 3000,
	host: "0.0.0.0"
}
Puree.Spices = {
	Service: require('./lib/service').Service,
	Browser: require('./lib/service').Browser
}
exports = module.exports = Puree;