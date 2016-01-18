

var compose = require("koa-compose"),
    socketio = require("socket.io"),
    co = require("co"),
    debug = require("debug")("koala-puree:sio"),
    ServerResponse = require("mock-res"), IncomingMessage = require("mock-req"),
    EventEmitter = require("eventemitter2").EventEmitter2,
    util = require("util"),
    extend = require("extend");
debug("koala-puree:sio is included");
require("./passport-req")(IncomingMessage.prototype);

exports = module.exports = function(){
    return {
        setup: function *setupSIO(next) {
            const puree = this;
            const koaApp = puree.app;
            var nsp = puree.ns || "/";
            function handler(origHeaders) {

                delete origHeaders["accept-encoding"];
                debug("handler with origHeader");
                return function _handler(method, route, data,headers, cb) {
                    debug("handler here");
                    debug(`entering into sio handler with (${method}, ${route}, ${data}, ${headers})`);
                    if ( undefined === cb ) { cb = headers; headers = data; }
                    if ( undefined === headers ) { cb = data; }
                    var downstream = koaApp.middleware ? koaApp.middleware : koaApp;
                    headers = headers || {};

                    headers["content-type"] = headers["content-type"] || "application/json";
                    headers = extend(origHeaders, headers);

                    if ("get head delete".split(" ").indexOf(method.toLowerCase()) >= 0 && data) {
                        route += "?"+require("querystring").stringify(data);
                    }
                    var req = new IncomingMessage({
                        method: method.toUpperCase(),
                        url: route,
                        headers: headers || {}
                    });
                    req.connection = this.conn.request.connection;
                    // require('extend')(req, this.conn.request);
                    if (("get head delete".split(" ").indexOf(method.toLowerCase()) < 0) && data) {
                        req.write(data); req.end();
                    }
                    var res = new ServerResponse();

                    // filling up the headersSent problem
                    // res.headersSent = false;
                    // res.socket = this.conn.transport;

                    // callback.call(puree.app, req, res);

                    var context = koaApp.createContext(req, res);
                    var fn = co.wrap(compose(downstream));
                    debug("attempting to call fn");
                    fn.call(context).then(function(){

                        var res = context.response;
                        debug(`completed ${method} ${route} with ${res.status}, ${res.header}, ${res.body}`);
                        if ( util.isFunction(cb) ) {
                            if ( res.body && res.body.on ) {
                                var buf = [];
                                res.body.on("data", function(chunk){
                                    buf.push(chunk.toString("utf8"));
                                });
                                res.body.on("end", function(chunk){
                                    if ( chunk) {
                                        buf.push(chunk.toString("utf8"));
                                    }
                                    debug("calling here^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
                                    cb(res.status, res.header, buf.join(""));
                                });
                            } else {
                                debug("calling here^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^2");
                                cb(res.status, res.header,res.body);
                            }
                        }
                    }).catch(context.onerror);
                };
            }

            debug("setting up SIO");
            yield (new Promise(function(resolve/*, reject*/){
                debug("Adding sio code into the puree");
                puree.on("listening", function(){
                    puree.on("namespace", function(){
                        var nsp = puree._ns || "/";
                        puree._sio.close();
                        puree._sio = puree._sioInstance.of(nsp);
                        puree._sio.on("connection", function(socket){
                            debug("socket connected");
                            puree.sio.emit("connection", socket);
                        });
                    });
                    if ( !puree._sioInstance ) {
                        puree._sioInstance = socketio(puree._server);
                    }
                    puree._sio = puree._sioInstance.of(nsp);
                    debug("arrives here??");
                    puree._sio.on("connection", function(socket){
                        debug("socket connected");
                        puree.sio.emit("connection", socket);
                    });
                });

                resolve();
            }));
            debug("Completing sio setup");
            puree.sio = new EventEmitter({});
            debug(puree.sio, "****************************");
            puree.sio.on("connection", function(socket){
                debug("we reached connection!!");
                debug("attaching the handler");
                socket.on("s", handler(socket.request.headers));
            });
            yield* next;
            debug("Completing 2nd part setup");
        },
        teardown: function*(next) {
            var app = this;
            yield new Promise(function(resolve/*, reject*/){
                if ( !app._mounted && app._sio.close ) {
                    app._sio.close();
                }
                debug("closing sio middleware");
                resolve();
            });
            yield* next;
        }
    };
};
