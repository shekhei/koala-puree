"use strict";

var mdns = require('mdns'), debug = require('debug')('koala-puree:service');

var mDnsBrowser, globalDnsCache = {};

var Browser=function(){
	// first search for all possible mdns
	// locate the first dnscache
	// if not located, continue caching everything
	// once located, switch off all browser, and start listening to only dnscache
	function serviceUp(service){
		debug(`serviceup: ${service.type.name}`);
		if (service.type.name !== "koala-puree") { debug(`ignoring service, service name not koala-puree`); return; }
		var type = (globalDnsCache[service.type.name] = globalDnsCache[service.type.name] || {});
		if (!service.txtRecord || !service.txtRecord.version) { return; }
		var ver = type[service.txtRecord.version] = type[service.txtRecord.version] || {};
		ver[service.host+":"+service.port] = service;
	}
	function serviceDown(service){
		var type, ver;
		(type = (globalDnsCache[service.type.name])) && (ver = type[service.txtRecord.version]) && (delete ver[service.host+":"+service.port]);
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
	get: function*(name, ver) {
		debug('looping through browser caches')
		for ( servicename in globalDnsCache) {
			debug(`comparing ${servicename} with ${name}`);
		}
	},
	cache: {}
}

var Service = function(name, ver){
	this._name = name;
	this._ver = ver;
	this._browser = new Browser();
}

Service.prototype = {
	_retrieve: function *() {
		debug(`retriving a service based on ${this._name}, ${this._ver}:start`);
		var service = yield* this._browser.get(this._name, this._ver);
		debug(`retriving a service based on ${this._name}, ${this._ver}:ended with ${service}`);
		return service;
	},
	request: function*(method, data, headers) {
		debug(`calling general request helper: start`)
		var service = yield* _retrieve()
		debug(`calling general request helper: end`)
	}
}
for(let method of "get post put delete".split(" ")) {
	Service.prototype[method] = (function(method){
		return function *(data, headers) {
			debug(`calling ${method} helper: start`)
			var result = yield* this.request.call(this, method, data, headers );
			debug(`calling ${method} helper: end`)
			return result;
		}
	})(method);
}

exports = module.exports = {
	Service: Service,
	Browser: Browser
};