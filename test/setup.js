exports = module.exports = {
};
describe('hooks', function(){
	before(function(done) {
		var mDnsBrowser = exports.mDnsBrowser = new mdns.Browser(mdns.tcp('koala-puree'), {resolverSequence:[
			mdns.rst.DNSServiceResolve(),
			mdns.rst.DNSServiceGetAddrInfo({families:[4,6]})
		]})
		var puree = exports.puree = new KoalaPuree(require('path').resolve('./test/config/server.yml'));
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
})