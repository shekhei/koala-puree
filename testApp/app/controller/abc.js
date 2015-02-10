exports = module.exports = function(router){

	router.get('/test', function*(next){
		console.log("fuck fuck fuck");
		this.body = "get";
	});
	router.post('/test', function*(next){
		this.body="post";
	});
	router.get('/test/:name', function*(next){
		this.body=this.params.name;
	});
}
