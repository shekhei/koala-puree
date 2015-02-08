"use strict";
var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	TestApp = require('../index'),
	sioClient = require("socket.io-client"),
	mdns = require('mdns'),
	pkginfo;

require('pkginfo')(module);
pkginfo = module.exports;

chai.use(chaiHttp);

describe('mDNS', function(){
	var puree = new TestApp(), sio, socket, mDnsBrowser;
	before(function(done) {
		this.timeout(5000);
		mDnsBrowser = new mdns.Browser(mdns.tcp('koala-puree'), {resolverSequence:[
			mdns.rst.DNSServiceResolve(),
			// 'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo()
			mdns.rst.DNSServiceGetAddrInfo({families:[4]})
		]})
		puree.start().then(function(app){
			done();
		}, function(err){
			if ( err ) { console.log(err); return done(err); }
		});
	})
	after(function(done){
		puree.close().then(function(){
			done();
		},function(err){
			done(err);
		});
	})
	describe('discover', function(){
		it("should be able to discover", function(done){
			this.timeout(5000);
			var completed = false;
			mDnsBrowser.on('serviceUp', function(service){
				if ( service.name !== "koala-puree-test") { return; }
				if ( completed ) { return; }
				completed = true;

				expect(service).to.have.property('txtRecord');
				expect(service.txtRecord).to.have.property('version');
				expect(service.txtRecord).to.have.property('name');
				expect(service.txtRecord.version).eqls(pkginfo.version);
				expect(service.txtRecord.name).eqls(pkginfo.name);
				expect(service).to.have.property('type');
				expect(service.type).to.have.property('name');
				expect(service.type.name).eqls("koala-puree");
				expect(service.name).eqls(pkginfo.name);

				// mDnsBrowser.resolve(service, function(){
				var connectHost = service.addresses ? service.addresses[0] : service.host;
				if ( service.replyDomain === "local.") { connectHost = "127.0.0.1"}
				sio = sioClient(`ws://${connectHost}:${service.port}`);
				console.log(`ws://${connectHost}:${service.port}`)
				if ( sio.io.readyState === "open" ) {
					mDnsBrowser.stop();
					done();
					done = undefined;
					return;
				} else {
					sio.once('connect', function(sock){
						done();
						done = undefined;
					}).once('reconnect', function(sock){
						done();
						done = undefined;
					}).on('connect_error', function(err){
						done(err);
						done = undefined;
					})
				}
				mDnsBrowser.stop();
				// });
				// require('dns').reverse(service.addresses[0], function(err, domains){
					// console.log(err, domains);

				// });
			});
			mDnsBrowser.start();
		})
	})
});