var chai = require("chai"),
	expect = chai.expect,
	chaiHttp = require("chai-http"),
	KoalaPuree = require('../index'),
	sioClient = require("socket.io-client"),
	mdns = require('mdns'),
	pkginfo;

require('pkginfo')(module);
pkginfo = module.exports;

chai.use(chaiHttp);

describe('mDNS', function(){
	var puree, sio, socket, mDnsBrowser;
	before(function(done) {
		mDnsBrowser = new mdns.Browser(mdns.tcp('koala-puree'), {resolverSequence:[
			mdns.rst.DNSServiceResolve(),
			mdns.rst.DNSServiceGetAddrInfo({families:[4,6]})
		]})
		puree = new KoalaPuree(require('path').resolve('./test/config/server.yml'));
		puree.start().on('listening', function(err){
			if ( err ) { console.log(err); return done(err); }
			done();
		});
		mDnsBrowser.start();
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
		puree._server.once('close', function(err){
			console.log('completed close');
			done();
		});
		puree.close();
	})
	describe('discover', function(){
		it("should be able to discover", function(done){
			this.timeout(500000);
			mDnsBrowser.on('serviceUp', function(service){
				expect(service).to.have.property('txtRecord');
				expect(service.txtRecord).to.have.property('version');
				expect(service.txtRecord.version).eqls(pkginfo.version);
				expect(service).to.have.property('type');
				expect(service.type).to.have.property('name');
				expect(service.type.name).eqls(pkginfo.name);
				// mDnsBrowser.resolve(service, function(){
					sio = sioClient("ws://"+service.host+":"+service.port);
					sio.once('connect', function(sock){
						done();
					}).on('connect_error', function(err){
						// done(err);
					})					
				// });
				// require('dns').reverse(service.addresses[0], function(err, domains){
					// console.log(err, domains);

				// });
			});
		})
	})
});