exports = module.exports = function(router){

	router.get('/test', function*(next){
		console.log("fuck fuck fuck");
		this.body = "get";
	});
	router.post('/test', function*(next){
        var params = yield this.req.body();
		this.body="post"+params.prepend;
	});
	router.get('/test/:name', function*(next){
		this.body=this.params.name;
	});
}
