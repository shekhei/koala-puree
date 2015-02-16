
var koa = require('koala'),
	compose = require('koa-compose'),
	socketio = require('socket.io'),
	co = require('co'),
	debug = require('debug')('koala-puree:mdns'),
	ServerResponse = require('mock-res'), IncomingMessage = require('mock-req'),
	EventEmitter = require('events').EventEmitter,
	mdns = require('mdns');

function advertise(self){
	return new Promise(function(resolve, reject){
		if ( self._ad ) { self._ad.stop(); }
		debug("Starting mdns middleware");
		var adSettings = {
			name: self._config.name,
			txtRecord: {
				name: self._config.name, // cant put into subtype, it is too long
				version: self._config.version,
				nsp: self._ns || '/'
			}//,
			//flags: mdns.kDNSServiceFlagsForceMulticast // linux avahi-compat-dns_sd cannot have flags...
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
		console.log(adSettings);
		function handleError(e){
			console.log(e,e.stack);
		}
		try {
			debug(`beginning advertisement ${adSettings}`);
			self._ad = new mdns.Advertisement(mdns.makeServiceType({name:'koala-puree', protocol:'tcp'}), self._config.port, adSettings, function(err, service){
				debug(`service registered: ${err} ${service.name}`);
				resolve(self);
			});
			self._ad.on('error', handleError);
			debug(`starting advertisement ${adSettings}`);
			self._ad.start();
		} catch(e) {
			handleError(e);
		}
	});
}

exports = module.exports = function(){
	return {
		setup: function*(next) {
			self = this;
			self.on('namespace', function(){
				advertise(self);
			})
			yield advertise(self);
			yield* next;
		},
		teardown: function(self) {
			return new Promise(function(resolve, reject){
				self._ad.stop();
				debug("closing mdns middleware");
			})
		}
	}
}