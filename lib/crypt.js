"use strict";
var forge = require("node-forge"),
    JWT = require("./jwt.js"),
    debug = require("debug")("koala-puree:lib/crypt");

class Crypter {
  constructor(app) {
      this.hasher = forge.md.sha256.create();
      this._app = app;
      this._pass = process.env.CCRET;
      if (!this._pass && app._app._env === "production") {
          throw "secret required, please set it with export CCRET";

      }
      this._pass = this._pass || "notasecret";
  }
  hash(val) {
      var md = forge.md.sha256.create();
      md.update(val);
      return md.digest().toHex();
  }
  encrypt(val) {
      var self = this;
      debug("encrypting");
      return new Promise(function(resolve, reject){
          debug("encrypting here");
          var salt = forge.random.getBytesSync(128);
          var key = forge.pkcs5.pbkdf2(self._pass, salt, 4, 16);
          var iv = forge.random.getBytesSync(16);
          var cipher = forge.cipher.createCipher("AES-CBC", key);
          cipher.start({iv:iv});
          cipher.update(forge.util.createBuffer(val));
          cipher.finish();
          var cipherText = forge.util.encode64(cipher.output.getBytes());
          return JWT.sign({ct: cipherText, st: forge.util.encode64(salt), iv: forge.util.encode64(iv)}).then(resolve).catch(reject);
      });

  }
  decrypt(val) {
      var self = this;
      return new Promise(function(resolve, reject){
          return JWT.verify(val)
        .then(function(obj){
            var key = forge.pkcs5.pbkdf2(self._pass, forge.util.decode64(obj.st), 4, 16);
            var decipher = forge.cipher.createDecipher("AES-CBC", key);
            decipher.start({iv: forge.util.decode64(obj.iv)});
            decipher.update(forge.util.createBuffer(forge.util.decode64(obj.ct)));
            decipher.finish();
            resolve(decipher.output.toString());
        })
        .catch(reject);
      });
  }
}

exports = module.exports = function(){
    return {
        Crypter: Crypter,
        setup: function *(next) {
            this._crypter = new Crypter(this);
            yield* next;
        }
    };
};
