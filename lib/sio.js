exports = module.exports = PureeSocketIO;

var koa = require('koala'),
	compose = require('koa-compose'),
	socketio = require('socket.io'),
	co = require('co'),
	debug = require('debug')('koala-puree:sio'),
	ServerResponse = require('mock-res'), IncomingMessage = require('mock-req'),
	EventEmitter = require('events').EventEmitter;
debug("koala-puree:sio is included")
function PureeSocketIO(puree, server){
	debug("Adding sio code into the puree")
	var koaApp = puree.app;
	puree._sio = socketio(server);
	// socketio.start(koaApp);
	puree._sio.on('connection', function(socket){
		debug("socket connected")
		socket.on('s', function(method, route, headers,data, cb) {
			debug("entering into sio handler with "+method);

			var downstream = koaApp.middleware ? compose(koaApp.middleware) : koaApp;
			var req = new IncomingMessage({
				method: method.toUpperCase(),
				url: route,
				headers: headers
			});
			var res = new ServerResponse();
			var context = koaApp.createContext(req, res);
			var fn = co.wrap(downstream);

			fn.call(context).then(function(){
				var res = context.response;
				cb(res.status, res.header,res.body);
			}).catch(context.onerror);
		});
	});
}

function *noop() {}