var Configurer = require("dir-config-loader");

module.exports = exports = {
    setup: function*(next) {
        var _configs = Configurer.load("./configs");
        var appP = this.prototype;
        Object.defineProperty(appP, "configs", {
            get: function() {return _configs.configs; }
        });
        yield _configs;
        yield* next;
    }
};
