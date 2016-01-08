"use strict";
var glob = require("glob"),
    cobody = require("co-body"),
    override = require("koa-override-method"),
    fs = require("fs"),
    pathModule = require("path"),
    koaTrieRouter = require("koa-trie-router"),
    methods = require("methods"),
    debugModule = require("debug"),
    compose = require("koa-compose"),
    debug = debugModule("koala-puree:controllers");

function genController(file, name, remove) {
    remove = remove === undefined ? false : remove;
    var path = pathModule.join(file), handlers;
    if ( remove ) {
        delete require.cache[path];
    }
    debug(`generating controller: ${path}`);
    handlers = require(path);
    return handlers;
}

exports = module.exports = function pureecontrollers(){

    return {
        setup: function* (next) {
            debug("beginning controller middleware setup");
            var app = this;
            function* overrideMethodMiddleware(next){
                var body;
                debug("body middleware", this.req.url);
        // only parse if it is form, cause if not, this is not a problem
                if ( /application\/x-www-form-urlencoded/.test(this.req.headers["content-type"])) {
                    if ( this.request.method === "POST" && this.req.headers["content-type"]) {
                        body = yield cobody(this);
                        let method = override.call(this, body);
                        this.request.method = method;
                        this.req.method = method;
                        delete body._method;
                    }
                }
                this.req.body = function*(){

                    debug("body generator");
                    if ( body ) {
                        debug("body is already parsed before", body);
                        return body;
                    }
                    body = yield cobody(this);
                    delete body._method;
                    return body;
                };
                yield* next;
            }
            app._app.use(overrideMethodMiddleware);
            debug("moving to next plugin setup");
            debug("starting here&&&&&&&&&&&&&&&&&&&&&*****************");
            yield* next;
            debug("back again after next plugin");

            this._router = koaTrieRouter(app._app);
            app._app.use(this._router);

            debug("adding methods to router and app");
            for ( let method of methods ) {
                app[method] = function(route, fn){
                    if ( arguments.length < 2 ) {
                        throw `${method} ${route} handler has to have at least one fn`;
                    }
                    if ( arguments.length > 2 || Array.isArray(fn)) {
                        var fns = Array.isArray(fn) ? fn : [].slice.call(arguments,1);

                        fn = compose(fns);
                    }
                    app._app[method](route, fn);
                };
            }
            debug("adding group to app");
            var keysMap = {
                index: ["get", ""],
                show: ["get", "/:id"],
                del: ["del", "/:id"],
                update: ["put", "/:id"],
                create: ["post", ""],
                edit: ["get", "/:id/edit"],
                new: ["get", "/:id/new"]
            };
            function resources(path, obj) {
        // requires various methods to be defined
                debug("looping through in resources helper");
                var mw = [].slice.call(arguments, 1);
                obj = mw.pop();
                var self = this;
                for ( var key in keysMap ) {

                    var val = keysMap[key];
                    var fn = obj[key] || obj.prototype[key];

                    if ( fn ) {

                        (function(fn, val){
                            debug("found the key?", key, obj);
                            self[val[0]](path+val[1], mw.concat(function*(){
                                return yield fn.call(this, this.req, this.res, this.app);
                            }));
                        })(fn, val);
                    }

                }
            }
            app.group = function(path/*, fn*/){
                debug("group is called with "+path);
                var router = [], mw = [].slice.call(arguments, 1, arguments.length -1);
                for ( let method of methods ) {
                    router[method] = function() {

                        var args = [].slice.call(arguments, 0);
                        debug("group router is triggered: "+args[0]+" transform into "+path+args[0]);
                        args[0] = path+args[0];
                        args.splice.apply(args, [1,0].concat(mw));
                        debug(args);
                        app[method].apply(app, args);
                    };
                }
                router.resources = function(/*path, obj*/) {
                    resources.apply(router, arguments);
                };
                arguments[arguments.length-1](router);
            };
            app.resources = function(/*path, obj*/) {
                resources.apply(app, arguments);
            };
      // add a new middleware between trie-router to allow namespacing
            debug("loading controllers");
            try {
                yield (new Promise(function(resolve, reject) {
                    debug(`beginning controller middleware`);
                    var update = function(){
                        app._router.router.trie.child = Object.create(null);
                        app._router.router.trie.children = [];
                        app.controllers = {};
                        glob(pathModule.resolve(app._basePath,"./app/controller/**/*.js"), function (er, files) {

                            if ( er ) { return reject(er); }
                            for ( var f of files ) {
                                var name = f.substr(15,f.length-18);
                                app.controllers[name] = genController(f, name, app._app.env !== "production");
                                app.controllers[name](app, debugModule([app._config.name,"controller",name]));
                                debug(`loaded ${name} into app.controllers`);
                            }
                            debug(`complete initalizing controllers`);
                            resolve();
                        });
                    };

                    update();
                    if ( app._app.env !== "production" ) {
                        fs.watch(pathModule.resolve(app._basePath,"./app/controller/"), function(){
                            debug("something updated");
                            update();
                        });
                    }
                }));
            } catch(e) {
                debug("failed to load", e);
            }
            debug("completing controller middleware setup");
        }
    };

};
