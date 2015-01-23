exports = module.exports = function(app){

	app.get('/test', function*(next){
		this.body="get";
	});
	app.post('/test', function*(next){
		this.body="post";
	});
	app.get('/test/:name', function*(next){
		this.body=this.params.name;
	});
}