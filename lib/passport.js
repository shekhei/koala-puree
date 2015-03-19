"use strict"

var passport = require('koa-passport'),
	ensureLoggedin = require('koa-ensure-login'),
	Service = require('./service.js').Service,
	JWT = require('../index.js').Spices.JWT,
	Crypt = require('../index.js').Spices.Crypt,
	debug = require('debug')('koala-puree:passport'),
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
			debug("Eskygo Strategy Verified called");
			if ( err ) {
				debug("EskygoStrategy verified error", err);
				return self.error(err);
			}
			debug("Eskygo Strategy Verified called2");
			if ( !user ) {
				debug("EskygoStrategy verified error: user is empty");
				req.session=null;
				return self.pass();
			}
			debug("Eskygo Strategy Verified called3", user);
			user.alias = options.username;
			debug("EskygoStrategy completing:", user);
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
							debug("User check replied", res.status, res.body);
							var body = JSON.parse(res.body);
							self.services('eskygo-user-service').get(`/users/${body.userId}`,{},{}).then(function(res){
								debug("User replied from service", res.status, res.body);
								done(null, JSON.parse(res.body))
							})
						});
					})
				);
				passport.serializeUser(function(user, done){
					debug('serializing user:', user);
					JWT.sign({user: {id:user.id, provider: user.provider, alias: user.alias}}).then(function(key){
						debug(`generated key ${key}`)
						done(undefined, key);
					}).catch(done);
				})
				passport.deserializeUser(function(key, done){
					debug("DOESNT WORK???", key);
					JWT.verify(key).then(function(obj){
						debug("user deserialized", obj);
						if ( obj.user && obj.user.id && obj.user.alias ) {
							obj.user.provider = obj.user.provider || "eskygo";
							Promise.all([
								self.services('eskygo-user-service').get(`/users/${obj.user.id}`,{},{}),
								self.services('eskygo-user-service').get(`/users/${obj.user.id}/providers/${obj.user.provider}`)
								]).then(function(results){
									if ( results[0].status != 200 ) {
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
				// for now this is very simple, variadic arguments, all must match
				self.ensureRole = function(roles, success, fail) {
					roles = roles.sort();

					return function*(next){
						debug("Ensuring roles", roles);
						var user = this.req.user;
						if ( !user ) {
							debug("User is not within the session, ")
							throw "this has to be used along with this.user";
						}
						if ( !user.roles ) {
							debug("Roles is not retrieved for this user yet, retrieving now");
							var userRoles = yield self.services('eskygo-user-service').get(`/users/${user.id}/roles`);
							if ( userRoles.status !== 200 ) {
								debug("failed to retrieve user_role: ",userRoles.body);
								throw "Unable to retireve roles from service for userid: "+user.id;
							}
							userRoles = JSON.parse(userRoles.body);
							debug("Retrieved roles", userRoles);
							user.roles = userRoles.sort();
						}
						if ( roles.length > user.roles ) {
							debug("Required roles are less than total numbrer of roles, quiting early")
							if ( fail ) {
								yield fail;
							}
							if ( 404 !== this.status ) {
								return;
							}
							return this.status = 401;
						}
						var j = 0;
						for ( var i = 0; i < user.roles.length; i++ ) {
							if ( user.roles[i] === roles[j]) {
								j++;
							}
						}
						if ( j < roles.length ) {
							debug("Matched roles are less than required roles, quiting")
							if ( fail ) {
								yield fail;
							}
							if ( 404 !== this.status ) {
								return;
							}
							return this.status = 401;
						}
						if ( success ) {
							yield success;
						}
						yield next;
					}
				}
				self.passport = passport;
				resolve();
			}));
			yield* next;
		}
	}
}
