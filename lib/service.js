"use strict";

var mdns = require("mdns"),
    debug = require("debug")("koala-puree:service");
var readYaml = require("read-yaml");
var mDnsBrowser, globalDnsCache = {};
var Promise = require("bluebird");
var methods = require('methods');
var semver = require('semver');
var pathMod = require('path');
var urlMod = require('url');
var sioClient = require('socket.io-client');
process.env.NODE_ENV = process.env.NODE_ENV || "development";

var Browser=function(){
  // first search for all possible mdns
  // locate the first dnscache
  // if not located, continue caching everything
  // once located, switch off all browser, and start listening to only dnscache
    function serviceUp(service){ // lets first filter out all loopback devices, these tests would fail during loopback cases then
        debug(`serviceup: ${service.type.name}`,service);
        if (service.type.name !== "koala-puree") { debug(`ignoring service, service name not koala-puree`); return; }
        if (!service.txtRecord || !service.txtRecord.version) { debug(`ignoring service, service.txtRecord does not exist`); return; }

        var host;
        for ( var i = 0; i< service.addresses.length; i++ ) {
            if ( !service.addresses[i].includes(":") ) {
                host = service.addresses[i];
            }
        }
        if ( !host ) { debug("ipv4 not found, ignoring service"); return; }
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
            ver.indices.filter(function(e){
                return e === id;
            });
        }
    }
    function browserError(err, service){
        debug("browser error:", err, err.stack);
        debug("service:", service);
    }
    if ( !mDnsBrowser ) {
    // mDnsBrowser = mdns.browseThemAll();
    // probably will require one more for loopback interface
        debug("creating service browser");
    // debug('')
        mDnsBrowser = new mdns.Browser(mdns.tcp("koala-puree"), {resolverSequence:[
            mdns.rst.DNSServiceResolve(),
            mdns.rst.DNSServiceGetAddrInfo({families:[4]})
      // mdns.rst.getaddrinfo({families:[4]})
      // ('DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo : mdns.rst.getaddrinfo)({families:[4]})
        ]});
        mDnsBrowser.on("serviceUp", serviceUp);
        mDnsBrowser.on("serviceChanged", serviceUp);
        mDnsBrowser.on("serviceDown", serviceDown);
        mDnsBrowser.on("error", browserError);
        debug("starting service browser");
        mDnsBrowser.start();
    }
};

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
                debug("looping through browser caches");
        // keep trying for a specific amount of time, now hard coded, 1s
                if ( new Date() - time > 2000 ) { debug("timeout"); return reject(); }
                if ( name in globalDnsCache ) {
                    debug("name is found in globaDnsCache");
                    var topver = undefined;
                    for ( let gver in globalDnsCache[name] ) {
                        if ( semver.satisfies(gver, ver) ) {
                            if ( topver === undefined || semver.gt(gver, topver)) {
                                topver = gver;
                            }
                        }
                    }
                    if ( topver ) {
                        debug("round robinning");
            // lets first do round robin
                        let pool = globalDnsCache[name][topver];
                        var c = ( (pool.lastCounter === null || pool.lastCount === undefined) ? 0 : pool.lastCounter);

                        if ( c+1 > pool.indices.length ) {
                            c = -1;
                        }
                        pool.lastCounter++;
                        debug("pool is:"+ JSON.stringify(pool.services));
                        debug("resolved with:"+ pool.services[pool.indices[c+1]]);
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
};

var Service = function(name, ver, app){
    this._name = name;
    this._ver = ver;
    this._browser = new Browser();
    this._app = app;
};
var serviceConfig;
Service.prototype = {
    _retrieve: function () {
        debug(`retriving a service based on ${this._name}, ${this._ver}:start`);
        return this._browser.get(this._name, this._ver);
    },
  // TODO, implement a stream method
    request: function(method, path, data, headers) {
        debug(`calling general request helper: start`);
        var self = this;
        function _request(sc, path, nsp, method, data, headers, resolve, reject) {
            var realPath = "";
            if ( !path.startsWith("/")) { realPath+= "/";}
            realPath+=path;
            debug(`[${method}]`, realPath, data, headers);
            sc.emit("s", method, realPath, data, headers,function(status, headers, body){
                debug(`service replied with ${status}, ${headers}, ${body}`);
                resolve({status: status, headers: headers, body:body});
            }).on("error", function(e){
                reject(e);
            });
        }

        return new Promise(function(resolve, reject){
            debug(`attempting to retrieve service`);
            if ( self.sioClient ) {
                debug(`ioClient already exists`);
                _request(self.sioClient, path, self._nsp, method, data, headers, resolve, reject);
            } else {

                if ( serviceConfig === undefined ) {
                    try {
                        serviceConfig = readYaml.sync(pathMod.resolve(self._app._basePath,"./config/services.yml"))[self._app._app.env];
                    } catch(e) {
                        debug(e.stack);
                        serviceConfig = false;
                    }
                }

                if ( serviceConfig && serviceConfig[self._name] ) {
                    var uri = urlMod.parse(serviceConfig[self._name]);
                    debug(`WARNING: ${self._name} is using ws://${uri.host}/${uri.path}`);
                    let sc = (self.sioClient = self.sioClient || new sioClient(`ws://${uri.host}${uri.path}`, {transports:["websocket"]}));
                    debug("client connection made");
                    self._nsp = uri.path;
                    _request(sc, path, uri.path, method, data, headers, resolve, reject);
                } else {
                    self._retrieve().then(function(service){
                        var nsp = service.txtRecord.nsp || "/";
                        self._nsp = nsp;
                        var host;
                        for ( var i = 0; i< service.addresses.length; i++ ) {
                            if ( !service.addresses[i].includes(":") ) {
                                host = service.addresses[i];
                            }
                        }
            // var host = `[${service.addresses[0]}]`;
            // if ( service.replyDomain === "local.") { // this is a local service
              // host = "127.0.0.1";
            // }
                        if ( !nsp.startsWith("/") ) {
                            nsp = "/"+nsp;
                        }
                        var url = `ws://${host}:${service.port}${nsp}`;
                        debug(`service(${self._name}@${self._ver}) resolved, connecting now@${url}`);
                        debug(`joining into namespace: ${nsp}`);
                        let sc = (self.sioClient = self.sioClient || new sioClient(url));
                        self.sioClient.on("error", function(err){
                            debug(err);
                            self.sioClient = undefined;
                        });
                        _request(sc, path, nsp, method, data, headers, resolve, reject);
                    }, function(e){
                        debug.error(`service(${self._name}@${self._ver}) failed to be resolved: ${e}`);
                        reject(e);
                    });
                }
            }
        });
    }
};
for(let method of methods) {
    Service.prototype[method] = (function(method){
        return function(path, data, headers) {
            debug(`calling ${method} helper: start`);
            return this.request.call(this, method, path, data, headers );
        };
    })(method);
}

exports = module.exports = {
    Service: Service,
    Browser: Browser,
    middleware: function(){
        return {
            setup: function *(next) {
                var app = this;
                yield (new Promise(function(resolve/*, reject*/){
                    debug("Setting up services middleware");
                    app._services = {};
                    app.services = function(name){
                        if ( !app._services[name] ) { throw "service missing in package.json[services]";}
                        return app._services[name];
                    };
                    debug(app._pkginfo, "&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
                    for ( let name in (app._pkginfo.services || {}) ) {
                        app._services[name] = new Service(name, app._pkginfo.services[name], app);
                    }
                    resolve();
                }));
                yield* next;
            },
            teardown: function*(next) {
                var app = this;
                debug("tearing down for lib/service.js");
                var promises = [];
                for ( var name in app._services ) {
                    promises.push(new Promise((res/*, rej*/) => {
                        if ( !app._services[name].sioClient ) {
                            return Promise.resolve(true);
                        }
                        app._services[name].sioClient.on("disconnect",()=>{
                            debug("disconnected", name);
                            res();
                        });
                        debug("disconnecting", name);
                        app._services[name].sioClient.disconnect();
                    }));
                }
                yield Promise.all(promises);
                yield* next;
            }
        };
    }
};
