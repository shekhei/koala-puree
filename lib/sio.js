

var koa = require('koala'),
	compose = require('koa-compose'),
	socketio = require('socket.io'),
	co = require('co'),
	debug = require('debug')('koala-puree:sio'),
	ServerResponse = require('mock-res'), IncomingMessage = require('mock-req'),
	EventEmitter = require('events').EventEmitter,
	util = require('util'),
	Cookies = require('cookies'),
	extend = require('extend');
debug("koala-puree:sio is included")
var req = IncomingMessage.prototype;
/**
 * Intiate a login session for `user`.
 *
 * Options:
 *   - `session`  Save login state in session, defaults to _true_
 *
 * Examples:
 *
 *     req.logIn(user, { session: false });
 *
 *     req.logIn(user, function(err) {
 *       if (err) { throw err; }
 *       // session saved
 *     });
 *
 * @param {User} user
 * @param {Object} options
 * @param {Function} done
 * @api public
 */
req.login =
req.logIn = function(user, options, done) {
  if (typeof options == 'function') {
    done = options;
    options = {};
  }
  options = options || {};
  
  var property = 'user';
  if (this._passport && this._passport.instance) {
    property = this._passport.instance._userProperty || 'user';
  }
  var session = (options.session === undefined) ? true : options.session;
  
  this[property] = user;
  if (session) {
    if (!this._passport) { throw new Error('passport.initialize() middleware not in use'); }
    if (typeof done != 'function') { throw new Error('req#login requires a callback function'); }
    
    var self = this;
    this._passport.instance.serializeUser(user, this, function(err, obj) {
      if (err) { self[property] = null; return done(err); }
      self._passport.session.user = obj;
      done();
    });
  } else {
    done && done();
  }
};

/**
 * Terminate an existing login session.
 *
 * @api public
 */
req.logout =
req.logOut = function() {
  var property = 'user';
  if (this._passport && this._passport.instance) {
    property = this._passport.instance._userProperty || 'user';
  }
  
  this[property] = null;
  if (this._passport && this._passport.session) {
    delete this._passport.session.user;
  }
};

/**
 * Test if request is authenticated.
 *
 * @return {Boolean}
 * @api public
 */
req.isAuthenticated = function() {
  var property = 'user';
  if (this._passport && this._passport.instance) {
    property = this._passport.instance._userProperty || 'user';
  }
  
  return (this[property]) ? true : false;
};

/**
 * Test if request is unauthenticated.
 *
 * @return {Boolean}
 * @api public
 */
req.isUnauthenticated = function() {
  return !this.isAuthenticated();
};


exports = module.exports = function(){
	return {
		setup: function *setupSIO(next) {
			console.log("setting up SIO");
			puree = this;
			yield (new Promise(function(resolve, reject){
				var callback = puree._app.callback();
				function handler(origHeaders) {

					delete origHeaders['accept-encoding']
					return function _handler(method, route, data,headers, cb) {
						console.log("handler here");
						debug(`entering into sio handler with (${method}, ${route}, ${data}, ${headers})`);
						if ( undefined === cb ) { cb = headers; headers = data; }
						if ( undefined === headers ) { cb = data; }
						var downstream = koaApp.middleware ? koaApp.middleware : koaApp;
						headers = headers || {};

						headers['content-type'] = headers['content-type'] || "application/json";
						headers = extend(origHeaders, headers);

						if ('get head delete'.split(' ').indexOf(method.toLowerCase()) >= 0 && data) {
							route += "?"+require('querystring').stringify(data);
						}
						var req = new IncomingMessage({
							method: method.toUpperCase(),
							url: route,
							headers: headers || {}
						});
						req.connection = this.conn.request.connection;
						// require('extend')(req, this.conn.request);
						if (('get head delete'.split(' ').indexOf(method.toLowerCase()) < 0) && data) {
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
									res.body.on('data', function(chunk){
										buf.push(chunk.toString('utf8'));
									})
									res.body.on('end', function(chunk){
										if ( chunk) {
											buf.push(chunk.toString('utf8'));
										}
										cb(res.status, res.header, buf.join(""));
									})
								} else {
									cb(res.status, res.header,res.body);
								}
							}
						}).catch(context.onerror);
					}
				}
				debug("Adding sio code into the puree")
				var koaApp = puree.app;
				var nsp = puree.ns || '/';
				// if ( nsp[0] !== "/" ) {
				// 	nsp = "/"+nsp
				// }
				puree.on('listening', function(){
					puree.on('namespace', function(){
						var nsp = puree._ns || '/';
						// puree._sioInstance().close();
						// puree._sioInstance = socketio(puree._server, {transports: ['websocket','polling']});
						puree._sio.close();
						puree._sio = puree._sioInstance.of(nsp);
						puree._sio.on('connection', function(socket){
							debug("socket connected")
							socket.on('s', handler(socket.request.headers));
						});
					})
					if ( !puree._sioInstance ) {
						puree._sioInstance = socketio(puree._server);
					}
					puree._sio = puree._sioInstance.of(nsp);
					// socketio.start(koaApp);
					console.log("arrives here??");
					puree._sio.on('connection', function(socket){
						console.log("socket connected");
						debug("socket connected")
						socket.on('s', handler(socket.request.headers));
					});
				})

				resolve();
			}));
			yield* next;
		},
		teardown: function(app) {
			return new Promise(function(resolve, reject){
				if ( !self._mounted ) {
					app._sio.close();
				}
				debug("closing sio middleware");
				resolve();
			})
		}
	}
}
