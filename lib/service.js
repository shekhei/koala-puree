"use strict";

var mdns = require('mdns'), debug = require('debug-levels')('koala-puree:service');

var mDnsBrowser, globalDnsCache = {};

var Browser=function(){
	// first search for all possible mdns
	// locate the first dnscache
	// if not located, continue caching everything
	// once located, switch off all browser, and start listening to only dnscache
	function serviceUp(service){ // lets first filter out all loopback devices, these tests would fail during loopback cases then
		debug(`serviceup: ${service.type.name}`);
		if (service.type.name !== "koala-puree") { debug(`ignoring service, service name not koala-puree`); return; }
		if (!service.txtRecord || !service.txtRecord.version) { debug(`ignoring service, service.txtRecord does not exist`); return; }
		var type = (globalDnsCache[service.txtRecord.name] = globalDnsCache[service.txtRecord.name] || {});
		var ver = type[service.txtRecord.version] = type[service.txtRecord.version] || {indices: [], services: {}};
		var id = service.host+":"+service.port;
		ver.services[id] = service;
		ver.indices.push(id);
		debug(`adding service to dns cache`);
	}
	function serviceDown(service){
		var type, ver;
		debug(`service ${service} is down`);
		if ((type = (globalDnsCache[service.type.name])) && (ver = type[service.txtRecord.version])) {
			var id = `${service.host}:${service.port}`;
			delete ver.services[id];
			ver[indices].filter(function(e){
				return e === id;
			})
		}
	}
	function browserError(){
		console.log(arguments);
	}
	if ( !mDnsBrowser ) {
		// mDnsBrowser = mdns.browseThemAll();
		// probably will require one more for loopback interface
		debug('creating service browser');
		mDnsBrowser = new mdns.Browser(mdns.tcp('koala-puree'), {resolverSequence:[
			mdns.rst.DNSServiceResolve(),
			mdns.rst.DNSServiceGetAddrInfo({families:[4]}),
		]})
		mDnsBrowser.on('serviceUp', serviceUp)
		mDnsBrowser.on('serviceChanged', serviceUp)
		mDnsBrowser.on('serviceDown', serviceDown)
		mDnsBrowser.on('error', browserError)
		debug('starting service browser');
		mDnsBrowser.start();
	}
}

Browser.prototype = {
	get: function(name, ver) {
		var time = new Date();
		// think of a way to refactor this into a generator, so we can just store that as a cache and yield everytime
		// hopeful usage would be:
		// var service = cache[service@version].next();
		// service.request(method, data, blabla);
		debug(`getting service(${name}@${ver})`);
		return new Promise(function(resolve, reject){
			function resolver() {
				debug('looping through browser caches')
				// keep trying for a specific amount of time, now hard coded, 1s
				if ( new Date() - time > 2000 ) { return reject(); }
				if ( name in globalDnsCache ) {
					var topver = undefined;
					for ( let gver in globalDnsCache[name] ) {
						if ( require('semver').satisfies(gver, ver) ) {
							if ( topver === undefined || require('semver').gt(gver, topver)) {
								topver = gver;
							}
						}
					}
					if ( topver ) {
						// lets first do round robin
						let pool = globalDnsCache[name][topver];
						var c = ( pool.lastCounter === undefined ? 0 : pool.lastCounter);

						if ( c+1 > pool.indices.length ) {
							c = -1;
						}
						pool.lastCounter++;
						// TODO: handle cases where it is not found
						return resolve(pool.services[pool.indices[c+1]]);
					}
				}
				setTimeout(resolver, 30);
			}
			process.nextTick(resolver);
		});
	},
	cache: {}
}

var Service = function(name, ver){
	this._name = name;
	this._ver = ver;
	this._browser = new Browser();
}

Service.prototype = {
	_retrieve: function () {
		debug(`retriving a service based on ${this._name}, ${this._ver}:start`);
		return this._browser.get(this._name, this._ver);
	},
	// TODO, implement a stream method
	request: function(method, path, data, headers) {
		debug(`calling general request helper: start`)
		var self = this;
		return new Promise(function(resolve, reject){
			debug(`attempting to retrieve service`);
			self._retrieve().then(function(service){
				var host = `[${service.addresses[0]}]`;
				var nsp = service.txtRecord.nsp || '/';
				if ( service.replyDomain === "local.") { // this is a local service
					host = "127.0.0.1";
				}
				var url = `ws://${host}:${service.port}${nsp}`;
				debug(`service(${self._name}@${self._ver}) resolved, connecting now@${url}`);
				let sc = (self.sioClient = self.sioClient || new require('socket.io-client')(url));
				debug(`joining into namespace: ${nsp}`)
				var realPath = "";
				if ( nsp !== "/") {realPath+=nsp;}
				if ( !nsp.endsWith("/") && !path.startsWith("/")) { realPath+= "/"}
				realPath+=path;
				sc.emit('s', method, realPath, data, headers,function(status, headers, body){
					debug(`service replied with ${status}, ${headers}, ${body}`);
					resolve({status: status, headers: headers, body:body});
				}).on('error', function(e){
					reject(e);
				});
			}, function(e){
				debug.error(`service(${self._name}@${self._ver}) failed to be resolved: ${e}`);
				reject(e);
			});
		});
	}
}
for(let method of require('methods')) {
	Service.prototype[method] = (function(method){
		return function(path, data, headers) {
			debug(`calling ${method} helper: start`)
			return this.request.call(this, method, path, data, headers );
		}
	})(method);
}

exports = module.exports = {
	Service: Service,
	Browser: Browser,
	middleware: function(){
		return {
			setup: function (app) {
				return new Promise(function(resolve, reject){
					debug("Setting up services middleware");
					app._services = {};
					app.services = function(name){
						if ( !app._services[name] ) { throw "service missing in package.json[services]";}
						return app._services[name];
					};
					for ( let name in (app._pkginfo.services || {}) ) {
						app._services[name] = new Service(name, app._pkginfo.services[name]);
					}
					resolve();
				})
			}
		}
	}
};