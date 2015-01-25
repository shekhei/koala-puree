

var koa = require('koala'),
	compose = require('koa-compose'),
	socketio = require('socket.io'),
	co = require('co'),
	debug = require('debug')('koala-puree:sio'),
	ServerResponse = require('mock-res'), IncomingMessage = require('mock-req'),
	EventEmitter = require('events').EventEmitter;
debug("koala-puree:sio is included")

exports = module.exports = function(){
	return {
		setup: function(puree) {
			return new Promise(function(resolve, reject){
				function handler(method, route, data,headers, cb) {
					debug(`entering into sio handler with (${method}, ${route}, ${data}, ${headers})`);

					var downstream = koaApp.middleware ? compose(koaApp.middleware) : koaApp;
					var req = new IncomingMessage({
						method: method.toUpperCase(),
						url: route,
						headers: headers || {}
					});
					var res = new ServerResponse();
					var context = koaApp.createContext(req, res);
					var fn = co.wrap(downstream);
					debug("attempting to call fn");
					fn.call(context).then(function(){

						var res = context.response;
						debug(`completed request with ${res.status}, ${res.header}, ${res.body}`);
						cb(res.status, res.header,res.body);
					}).catch(context.onerror);
				}
				debug("Adding sio code into the puree")
				var koaApp = puree.app;
				var nsp = puree._ns || '/';
				puree.on('namespace', function(){
					var nsp = puree._ns || '/';
					puree._sioInstance().close();
					puree._sioInstance = socketio(puree._server);
					puree._sio = puree._sioInstance.of(nsp);
					puree._sio.on('connection', function(socket){
						debug("socket connected")
						socket.on('s', handler);
					});
				})
				puree._sioInstance = socketio(puree._server);
				puree._sio = puree._sioInstance.of(nsp);
				// socketio.start(koaApp);
				puree._sio.on('connection', function(socket){
					debug("socket connected")
					socket.on('s', handler);
				});
				resolve();
			})
		},
		teardown: function(app) {
			return new Promise(function(resolve, reject){
				app._sioInstance.close();
				debug("closing sio middleware");
				resolve();
			})
		}
	}
}