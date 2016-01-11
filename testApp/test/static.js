"use strict";
var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	TestApp = require('../index'),
	sioClient = require("socket.io-client"),
	mdns = require('mdns');

chai.use(chaiHttp);

describe('Puree Static From Public folder', function(){
	var puree = new TestApp(), app, sio, socket, browser;
	before(function(done) {
		this.timeout(5000);
		puree.start().then(function(tapp){
			// service = new Service('koala-puree-test', '0.0.1');
			done();
		},function(err){
			done(err);
		});
	})
	after(function(done){
		puree.close().then(function(){
			done();
		},function(err){
			done(err);
		});
	})
	it("should get a test.js", function(done){
		chai.request("http://localhost:5000")
			.get("/static/test.js")
			.end(function(err, res){
				if ( err ) { return done(err); }
				expect(res).to.have.status(200);
				done();
			});
	});
});
