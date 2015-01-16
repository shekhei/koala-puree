var readYaml = require('read-yaml'), extend = require('extend');

var socketio = require('socket.io');
var mdns = require('mdns');
var debug = require('debug')('koala-puree')
require('pkginfo')(module);
var pkginfo = module.exports;

var Puree = function(config){
	if (!(this instanceof Puree)) return new Puree;
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
			var ad = new mdns.Advertisement(mdns.tcp(self._config.name), self._config.port, {
				txtRecord: {
					version: self._config.version
				}
			});
			ad.start();
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

exports = module.exports = Puree;