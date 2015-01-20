var KoalaPuree = require('koala-puree');

var TestApp = new KoalaPuree(module);

exports = module.exports = TestApp;


TestApp.get('/test', function*(next){
	this.body="get";
});
TestApp.post('/test', function*(next){
	this.body="post";
});
TestApp.get('/test/:name', function*(next){
	this.body=this.params.name;
});