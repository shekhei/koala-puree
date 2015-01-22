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
		puree.start().then(function(){
			service = new Service('koala-puree-test', '0.0.1');
			done();
		}, function(err) {
			return done(err);
		});
	})
	after(function(done){
		this.timeout(20000);
		puree.close().then(function(){
			done();
		},function(err){
			done(err);
		});
	})
	describe("browser should use mDns cache", function(){

	});
	describe('making service calls', function(){
		it("should be able call /test", function(done){
			this.timeout(20000);
			service.get('/test').then(function(res){

				expect(res.status).eql(200);
				expect(res.body).eql('get');
				done();
			});
		})
	})
	describe("killing service and restarting should reconnect", function(){

	})
});