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
	var puree = new TestApp(), app, sio, socket, browser, service;
	before(function(done) {
		this.timeout(5000);
		puree.start().then(function(tapp){
			app = tapp;
			tapp.models.UserAlias.query(function(qb){
				return qb.del();
			}).fetch().then(function(){
				tapp.models.User.query(function(qb){
					return qb.del();
				}).fetch().then(function(){done();});
			})

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
		expect(app.models).to.have.property("User");
		done();
	});
	it('Should add a new user', function(done){
		app._orm.transaction(function(t){

			return app.models.User
				.forge({name: "felix"})
				.save(null, {transacting:t})
				.tap(function(model){
					return app.models.UserAlias.forge({type: 'openid', value:'abc'}).save('user_id', model.id, {transacting:t});
				});
		}).then(function(){
			done();
		});	
	})
	it('Should be able to retrive previous user', function(done){
		app.models.User
			.forge({name: "felix"})
			.fetch({withRelated:['alias']})
			.then(function(user){
				expect(user.get('name')).eql('felix');
				expect(user.related('alias').length).eql(1);
				expect(user.related('alias').at(0).get('type')).eql('openid');
				done();
			}).catch(function(err){
				done(err);
			});
	})
});