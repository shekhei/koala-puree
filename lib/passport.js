"use strict"

var passport = require('koa-passport'),
	ensureLoggedin = require('koa-ensure-login'),
	Service = require('./service.js').Service,
	JWT = require('../index.js').Spices.JWT,
	Crypt = require('../index.js').Spices.Crypt,
	debug = require('debug')('koala-self:passport'),
	strategy = require('passport-strategy');
debug("koala-self:passport is included")

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
			user.alias = username;
			self.success(user, info);
		});
	}
}

exports = module.exports = function(){
	return {
		setup: function*(next) {
			var self = this;

			yield (new Promise(function(resolve, reject){
				//TODO reconsider if using a service version on its own is any good
				self._app.use(passport.initialize());
				self._app.use(passport.session());
				passport.use(
					new EskygoStrategy(function(alias, provider, password, done) {
						console.log("strategy verification");
						self.services('eskygo-user-service').post('/users/check', {alias:alias, provider: provider, password: password}, {}).then(function(res){
							var body = JSON.parse(res.body);
							self.services('eskygo-user-service').get(`/users/${body.userId}`,{},{}).then(function(res){
								done(null, JSON.parse(res.body))
							})
						});
					})
				);
				passport.serializeUser(function(user, done){
					debug(`serializing user: ${user}`)
                    console.log(user)
					JWT.sign({user: {id:user.id, provider: user.provider, alias: user.alias}}).then(function(key){
						debug(`generated key ${key}`)
						done(undefined, key);
					}).catch(done);
				})
				passport.deserializeUser(function(key, done){
					console.log("DOESNT WORK???", key);
					JWT.verify(key).then(function(obj){
                        console.log(obj.user);
						if ( obj.user && obj.user.id && obj.user.alias ) {
							obj.user.provider = obj.user.provider || "eskygo";
							Promise.all([
								self.services('eskygo-user-service').get(`/users/${obj.user.id}`,{},{}),
								self.services('eskygo-user-service').get(`/users/${obj.user.id}/providers/${obj.user.provider}`)
								]).then(function(results){
									if ( results[0].status != 200 || results[1].status != 200 ) {
										console.log("FUCKED");
										return done(null, false);
									}
									var user = JSON.parse(results[0].body);
									user.provider = JSON.parse(results[1].body);
                                    user.alias = obj.user.alias;
									done(null, user);
								})
						} else {
							debug('session faulty');
							done(null, false);
							// this.logout();
							// this.redirect(404);
							// done(new Error("session doesnt contain a user"), undefined);
						}
					}).catch(function(err){
                        console.log("this is an error !!!!!!!!", err.stack);
                        done(null, false);
                    });

				})
				self.ensureLoggedIn = function*(next){
					if ( !this.isAuthenticated() ) {
						var origUrl = require('url').resolve('http://'+this.req.headers.host+'/', this.req.url);
						console.log(origUrl);
						var token = yield JWT.sign({origUrl:origUrl})
						return this.redirect(self._config.passport.loginUrl+"?t="+token);
					}
					yield next;
					
				};
				self.passport = passport;
				resolve();
			}));
			yield* next;
		}
	}
}
