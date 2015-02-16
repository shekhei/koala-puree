"use strict"

var passport = require('koa-passport'),
	ensureLoggedin = require('koa-ensure-login'),
	Service = require('./service.js').Service,
	JWT = require('../index.js').Spices.JWT,
	Crypt = require('../index.js').Spices.Crypt,
	debug = require('debug')('koala-puree:passport'),
	strategy = require('passport-strategy');
debug("koala-puree:passport is included")

class EskygoStrategy extends strategy {
	constructor(verify){
		super();
		this._verify = verify;
		this.name = "eskygo"; 
	}
	authenticate(req, options) {
		var self = this;

		this._verify(options.username, "eskygo", Crypt.hash(options.password), function verified(err, user, info){
			if ( err ) { return self.error(err); }
			if ( !user ) { req.session=null; return self.pass(); }
			self.success(user, info);
		});
	}
}

exports = module.exports = function(){
	return {
		setup: function*(next) {
			puree = this;
			yield (new Promise(function(resolve, reject){
				//TODO reconsider if using a service version on its own is any good
				var userServ = new Service('eskygo-user-service', '~0.0.1');
				puree._app.use(passport.initialize());
				puree._app.use(passport.session());
				passport.use(
					new EskygoStrategy(function(alias, provider, password, done) {
						console.log("strategy verification");
						userServ.post('/user/check', {alias:alias, provider: provider, password: password}, {}).then(function(res){
							var body = JSON.parse(res.body);
							userServ.get(`/user/${body.userId}`,{},{}).then(function(res){
								done(null, JSON.parse(res.body))
							})
						});
					})
				);
				passport.serializeUser(function(user, done){
					debug(`serializing user: ${user.id}`)
					JWT.sign({userId: user.id}).then(function(key){
						debug(`generated key ${key}`)
						done(undefined, key);
					}).catch(done);
				})
				passport.deserializeUser(function(key, done){
					JWT.verify(key).then(function(obj){
						if ( obj.userId ) {
							userServ.get(`/user/${obj.userId}`,{},{}).then(function(res){
								done(null, JSON.parse(res.body));
							})
						} else {
							debug('session faulty');
							done(null, false);
							// this.logout();
							// this.redirect(404);
							// done(new Error("session doesnt contain a user"), undefined);
						}
					}).catch(done);

				})
				puree.ensureLoggedIn = function*(next){
					var self = this;
					if ( !this.isAuthenticated() ) {

						var origUrl = require('url').resolve('http://'+this.req.headers.host+'/', this.req.url);
						console.log(origUrl);
						var token = yield JWT.sign({origUrl:origUrl})
						return this.redirect(puree._config.passport.loginUrl+"?t="+token);
					}
					yield next;
					
				};
				puree.passport = passport;
				resolve();
			}));
			yield* next;
		}
	}
}
