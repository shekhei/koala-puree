
var co = require("co");
var codust = require("co-dust");
var debug = require("debug")("koala-puree:middleware:dust");
var moment = require("moment");
var glob = require("glob");
var fs = require("fs");
var BASEOUTPUT = "./.tmp/view";
var mkdirp = require("mkdirp");
exports = module.exports = function(settings){
	    var precompile = settings.precompile;
	    if ( void 0 === precompile ) {
		    precompile = false;
	}
	    return {

		    setup: function*(next) {
			// precompile all files to .tmp
			    debug("Reaching koala puree dust middleware");
			    var app = this._app;
			    var dust;
			    if ( true === precompile ) {
				    dust = new codust({base: require("path").resolve("./.tmp/view"), precompiled: precompile});
				    dust._dust.config.cjs = true;
				// start precompiling
				    yield new Promise(function(resolve, reject){
					    mkdirp.sync(BASEOUTPUT);
					    glob("app/view/**/*.dust", function(err, files){
						    if ( err ) {
							    reject(err);
						}
						    files.map(function(file){
							    return [fs.readFileSync(file).toString(), file.substr("app/view/".length)];
						}).map(function(data){
							    mkdirp.sync(require("path").join(BASEOUTPUT,require("path").dirname(data[1])));
							    return fs.writeFileSync(require("path").join(BASEOUTPUT, data[1]), dust._dust.compile(data[0], data[1]));
						});
						    resolve();
					});
				});
			} else {
				    dust = new codust({base: require("path").resolve("./app/view")});
			}

			    this._dust = dust;
			    var helpers = require("./dust_helpers.js");

			    helpers(dust._dust);
			//modify koa-trie-router to allow namespace stripping
			    this._app.use(function*(next){

				//var self = this;
				    debug("co-dust middleware");
				    var self = this;
				    this.render = function*(path, context){
					    context = context || {};
					    context.loggedIn = self.req.isAuthenticated;
					    context.user = self.req.user;
					    context.today = moment();
					    if ( false === app.puree._config.cacheTemplate ) { delete app.puree._dust._dust.cache[path]; }
					    debug("rendering", path, context);
					    self.body = yield dust.render(path, context);
				};
				    debug("did we get to this?");
				    yield* next;
			});
			    debug("going to next");
			    yield* next;
			    debug("completing 2nd part");
		}
	};
};
