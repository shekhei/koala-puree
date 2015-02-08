"use strict";
var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	jwt = require('../lib/jwt.js');

describe('Jwt should sign correctly', function(){
	it("should sign correctly and decode correctly", function(done){
		var payload = {name: "felix"}
		jwt.sign(payload).then(function(token){
			expect(token);
			jwt.verify(token).then(function(payload){
				expect(payload);
				expect(payload.name).eql('felix');
				done();
			}).catch(done);
		}).catch(done);
	});
});
