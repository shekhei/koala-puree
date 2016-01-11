exports = module.exports = function(router){
    router.group("/promises", (router=> {
        router.get('/test', function*(next){
            return new Promise((res, rej) => {
                this.body = "get";
            })
        });

    }))
}
