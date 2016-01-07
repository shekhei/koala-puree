"use strict";

var passport = require("koa-passport"),
	    ensureLoggedin = require("koa-ensure-login"),
	    Service = require("./service.js").Service,
	    JWT = require("../index.js").Spices.JWT,
	    Crypt = require("../index.js").Spices.Crypt,
	    debug = require("debug")("koala-puree:passport"),
	    Promise = require("bluebird");
debug("koala-self:passport is included");

exports = module.exports = function(){
	    return {
		    setup: function*(next) {
			    var self = this;

			    yield (new Promise(function(resolve, reject){
				//TODO reconsider if using a service version on its own is any good
				    self._app.use(passport.initialize());
				    self._app.use(passport.session());
				    self.passport = passport;
				    resolve();
			}));
			    yield* next;
			    debug("arriving to 2nd part");
		}
	};
};
