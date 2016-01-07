var JWT = require("./jwt.js");

module.exports = exports = {
    setup: function*(next){
      this.JWT = JWT;
      yield *next;
  }
};
