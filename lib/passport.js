

var passport = require('koa-passport'),
	ensureLoggedin = require('koa-ensure-login'),
	Service = require('./service.js').Service,
	JWT = require('../index.js').Spices.JWT;
debug("koala-puree:passport is included")

exports = module.exports = function(){
	return {
		setup: function(puree) {
			return new Promise(function(resolve, reject){
				//TODO reconsider if using a service version on its own is any good
				var userServ = new Service('eskygo-user-service', '~0.0.1');
				puree._app.use(passport);
				passport.use(new EskygoStrategy(
				function(alias, provider, password, done) {
					userServ.post('/user/check', {alias:alias, provider: provider, password: password}, {}, function(){

					})
				});
				passport.serializeUser(function(user, done){
					JWT.sign({userId: user.id}, function(key){
						done(undefined, id);
					}).catch(done);
				})
				passport.deserializeUser(function(key, done){
					JWT.verify(key, function(obj){
						if ( obj.userId ) {
							userServ.get(`/user/${obj.userId}`,{},{}, function(){
								console.log(arguments);
								done(obj);
							})
						} else {
							done("session faulty");
						}
					}).catch(done);

				})
				puree.ensureLoggedIn = ensureLoggedIn;
				resolve();
			})
		}
	}
}
