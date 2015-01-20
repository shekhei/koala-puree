"use strict";
var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	KoalaPuree = require('koala-puree'),
	TestApp = require('../index'),
	PureeService = KoalaPuree.Spices,
	Service = PureeService.Service,
	Browser = PureeService.Browser,
	sioClient = require("socket.io-client"),
	mdns = require('mdns'),
	pkginfo;

require('pkginfo')(module);
pkginfo = module.exports;

chai.use(chaiHttp);

describe('Puree Infra', function(){
	var puree = TestApp, sio, socket, browser, service;
	before(function(done) {
		puree.start(function(err,app){
			if ( err ) { console.log(err); return done(err); }
			service = new Service('koala-puree', '0.0.1');
			done();
		});
	})
	after(function(done){
		puree._server.once('close', function(err){
			console.log('completed close');
			done();
		});
		puree.close();
	})
	describe("browser should use mDns cache", function(){

	});
	describe('making service calls', function(){
		it("should be able call /test", function(done){
			this.timeout(2000);
			var fn = require('co').wrap(service.get);
			fn.call(service, '/test').then(function(res){
				expect(res.body).to.be('get');
				done();
			})
		})
	})
	describe("killing service and restarting should reconnect", function(){

	})
});