"use strict";

var passport = require("koa-passport"),
    debug = require("debug")("koala-puree:passport");

debug("koala-self:passport is included");

exports = module.exports = function(){
    return {
        setup: function*(next) {
            var self = this;
            self._app.use(passport.initialize());
            self._app.use(passport.session());
            self.passport = passport;
            yield* next;
            debug("arriving to 2nd part");
        }
    };
};
