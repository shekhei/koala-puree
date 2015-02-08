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
	var puree = new TestApp(), sio, socket, browser, service;
	before(function(done) {
		this.timeout(5000);
		puree.start().then(function(){
			done();
		}, function(err) {
			return done(err);
		});
	})
	after(function(done){
		this.timeout(5000);
		puree.close().then(function(){
			done();
		},function(err){
			done(err);
		});
	})
	describe('making service calls', function(){
		it("should be able call /test", function(done){
			this.timeout(2000);
			puree.services('koala-puree-test').get('/test').then(function(res){
				expect(res.status).eql(200);
				expect(res.body).eql('get');
				done();
			});
		})
	})
	describe('making service calls twice using same service', function(){
		it("should be able call /test", function(done){
			this.timeout(2000);
			puree.services('koala-puree-test').get('/test').then(function(res){
				expect(res.status).eql(200);
				expect(res.body).eql('get');
				done();
			});
		})
	})
});
