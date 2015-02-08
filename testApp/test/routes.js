var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	TestApp = require('../index'),
	sioClient = require("socket.io-client");

chai.use(chaiHttp);

describe('Application', function(){
	var puree = new TestApp(), sio, socket;
	before(function(done) {
		this.timeout(5000);
		// this.timeout(50000);
		puree.start().then(function(){
			sio = sioClient('http://localhost:5000', {transports:['websocket']});
			// anotherSIO = sioClient('ws://218.202.236.54:8080/push/T820119/T820119');
			// console.log("trying to connect to that");
			// anotherSIO.once('connect', function(sock){
				// console.log("sock connected to ");
			// })
			// anotherSIO.once('error', function(sock){
				// console.log("sock failed to ");
			// })
			sio.once('connect', function(sock){
				done();
			})
		}, function(err){
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
	describe('routes', function(){
		it('should have a get(/test)', function(done){

			chai.request("http://localhost:5000")
				.get("/test")
				.end(function(err, res){
					if ( err ) { return done(err); }
					expect(res).to.have.status(200);
					done();
				});
		});
		it('should have a post(/test)', function(done){
			chai
				.request("http://localhost:5000")
				.post("/test")
				.end(function(err, res){
					if ( err ) { return done(err); }
					expect(res).to.have.status(200);
					done();
				});
		});
		it('should have a get(/test/:name)', function(done){
			chai.request("http://localhost:5000")
				.get("/test/felix")
				.end(function(err, res){
					if ( err ) { return done(err); }
					expect(res).to.have.status(200);
					done();
				});
		});
	})
	describe('websocket', function(){
		it('should have a get(/test)', function(done){
			sio.emit('s', "get", "/test", {},{}, function(status, headers, body){
				expect(status).eql(200);
				expect(body).eql('get')
				done();
			});
		});
		it('should have a post(/test)', function(done){
			sio.emit('s', "post", "/test", {},{}, function(status, headers, body){
				expect(status).eql(200);
				expect(body).eql('post')
				done();
			});
		});
		it('should have a get(/test/:name)', function(done){
			sio.emit('s', "get", "/test/felix", {},{}, function(status, headers, body){
				expect(status).eql(200);
				expect(body).eql('felix')
				done();
			});
		});
	})
});

