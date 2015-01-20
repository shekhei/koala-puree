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
}

var puree = Puree.prototype = {
	get app() { return this._app; },
	get sio() { return this._sio; },
	set namespace(ns) { this._ns = ns; },
	get namespace() { return this._ns; },
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
	start: function(cb) {
		var server = this._server = this._app.listen(this._config.port, "::"), self = this;
		server.once('listening', function(){
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
				var ad = new mdns.Advertisement(mdns.makeServiceType({name:'koala-puree', protocol:'tcp'}), self._config.port, adSettings, function(err, service){
					debug(`service registered: ${err} ${service.name}`);
					cb(undefined, self);
				});
				ad.on('error', handleError);
				debug(`starting advertisement ${adSettings}`);
				ad.start();
			} catch(e) {
				handleError(e);
			}
		})
		require('./lib/sio')(this, server);
		return server;
	},
	close: function(){
		debug("closing server...")
		this._sio.close();
		this._server.close();
		return this._server;
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