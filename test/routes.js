var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	KoalaPuree = require('../index'),
	sioClient = require("socket.io-client");

chai.use(chaiHttp);

describe('Application', function(){
	var puree, sio, socket;
	before(function(done) {
		puree = new KoalaPuree(require('path').resolve('./test/config/server.yml'));
		puree.start().on('listening', function(err){

			if ( err ) { console.log(err); return done(err); }
			sio = sioClient('http://localhost:5000', {transports:['websocket']});
			sio.once('connect', function(sock){
				done();
			})
			
		});
		puree.get('/test', function*(next){
			this.body="get";
		});
		puree.post('/test', function*(next){
			this.body="post";
		});
		puree.get('/test/:name', function*(next){
			this.body=this.params.name;
		});
	})
	after(function(done){
		sio.disconnect();
		puree._server.once('close', function(){
			done();
		});
		puree.close();
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