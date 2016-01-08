"use strict";
var extend = require("extend"),
    jwt = require("jsonwebtoken");

var DEFAULTINITOPTIONS = {
    key: "notasecret",
    alg: "HS256"
};

class JWT {
  constructor(options) {
      options = extend(DEFAULTINITOPTIONS, options);
      this._key = options.key;
      this._alg = options.alg;
  }
  sign(payload, options) {
      options = options || {};
      options.algorithm = this._alg;
      var self = this;
      return new Promise(function(resolve, reject){
          try {
              resolve(jwt.sign(payload, self._key, options));
          } catch(e) { reject(e);}
      });
  }
  verify(token, options) {
      options = options || {};
      options.algorithm = this._alg;
      var self = this;
      return new Promise(function(resolve, reject){
          jwt.verify(token, self._key, options, function(err, decoded){
              if ( err ) { return reject(err); }
              resolve(decoded);
          });
      });
  }
}

exports = module.exports = new JWT();
