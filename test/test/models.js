"use strict";
var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	KoalaPuree = require('koala-puree'),
	TestApp = require('../index'),
	sioClient = require("socket.io-client"),
	mdns = require('mdns'),
	pkginfo;

require('pkginfo')(module);
pkginfo = module.exports;

describe('Puree Models', function(){
	var puree = TestApp, app, sio, socket, browser, service;
	before(function(done) {
		this.timeout(5000);
		puree.start().then(function(tapp){
			app = tapp;
			console.log('destroying all models');
			Promise.all([
				new Promise(function(resolve, reject){
					tapp.models.user.count().then(function(count){
						if ( count > 0 ) {
							tapp.models.user.destroy().then(resolve).catch(reject);
						}else {
							resolve();
						}
					})
				}),
				new Promise(function(resolve, reject){
					tapp.models.useralias.count().then(function(count){
						if ( count > 0 ) {
							tapp.models.useralias.destroy().then(resolve).catch(reject);
						}else {
							resolve();
						}
					})
				})
			]).then(function(){
				done();
			}, function(err){
				done(err);
			});
			// service = new Service('koala-puree-test', '0.0.1');
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
	it("should contain a User model", function(done){
		expect(app).to.have.property("models");
		expect(app.models).to.have.property("user");
		done();
	});
	it('Should add a new user', function(done){
		app.models.user.create({name: "felix", aliases: [{type: 'openid', value:'abc'}]}).populate('aliases').exec(function(err, user){
			if ( err ) { return done(err);}
			expect(user.name).eql('felix');
			done();
		})
	})
	it('Should be able to retrive previous user', function(done){
		app.models.user.findOne({name: "felix"}).populate('aliases').then(function(user){
			expect(user.name).eql('felix');
			expect(user.aliases.length).eql(1);
			expect(user.aliases[0].type).eql('openid');
			done();
		}).catch(function(err){
			done(err);
		});
	})
});