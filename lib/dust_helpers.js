module.exports = exports = function(dust){
	var _ = require('lodash');
	var moment = require('./moment_helpers.js');
	var self = this;
	dust.helpers["route"] = function(chunk, context, bodies, params){
		var path = params.route;
		if ( self._ns && self._ns !== "/" ) {
			chunk.write(self._ns);
		}
	    return _.isFunction(path) ? path(chunk, context) : chunk.write(path);
	}
	dust.helpers.env = function(chunk, context, bodies, params) {
		params.env = params.env || "dev";
		var env = process.env.NODE_ENV || "dev";
		if (params.env === env){
			bodies.block(chunk,context);
		}
		return chunk.write("");
	}
	dust.helpers["form"] = function(chunk, context, bodies, params){
		var path = params.route, method, hiddenmethod, enctype;
		if ( params.method ) {
			method = params.method;
		}
		if ( params.model ) {
			hiddenmethod = 'put';
		}
		enctype = params.enctype || "application/x-www-form-urlencoded";
		
		method = method || "post";

		method = dust.helpers.tap(method, chunk, context);
		method = method.toLowerCase();
		if ( method !== "get" && method !== "post") {
			hiddenmethod = method;
			method = "post";
		}
		chunk.write('<form method="');
		chunk.write(method);

		chunk.write('" action="');
		if ( self._ns && self._ns !== "/" ) {
			chunk.write(self._ns);
		}
	    _.isFunction(path) ? path(chunk, context) : chunk.write(path);

	    chunk.write('" enctype="')
	    _.isFunction(enctype) ? enctype(chunk, context) : chunk.write(enctype);
	    if ( params.class ) {
	    	chunk.write('" class="')
	    	_.isFunction(params.class) ? params.class(chunk, context) : chunk.write(params.class);
	    }
		chunk.write('">')
		if ( hiddenmethod ) {
			chunk.write('<input type="hidden" name="_method" value="'+hiddenmethod+'"/>')
		}
		if ( method !== 'get' && method !== 'head' ) {
			chunk.write('<input type="hidden" name="_csrf" value=""/>')
		}
		if ( bodies.block ) {
			bodies.block(chunk, context);
		}
	    return chunk.write('</form>');

	}
	dust.helpers["param"] = function(chunk, context, bodies, params) {
		var name = dust.helpers.tap(params.name, chunk, context);
		var attr = dust.helpers.tap(params.value, chunk, context);
		if ( !attr ) {
			context.current()[name]=function(chunk){
				bodies.block(chunk, context);
				return chunk;
			}
		} else {
			context.current()[name] = attr;
		}

		return chunk;
	}
	dust.helpers["date"] = function(chunk, context, bodies,params) {
		var key;
		if ( params.key ) {
			key = dust.helpers.tap(params.key, chunk, context);	
		}
		var format = dust.helpers.tap(params.format, chunk, context);

		return chunk.write(moment(key).format(format));
	}
	dust.helpers.loop = function(chunk, context, bodies, params) {
	  var from = parseInt(dust.helpers.tap(params.from, chunk, context), 10),
	        to = parseInt(dust.helpers.tap(params.to, chunk, context), 10);
	  from = ( NaN === from ) ? 1 : from;
	  to = ( NaN === to ) ? 1 : to;
	  var len = Math.abs(to - from) + 1,
	        increment = (to - from) / (len - 1) || 1;
	  while(from !== to) {
	      chunk = bodies.block(chunk, context.push(from, from, len));
	      from += increment;
	  }

	  return chunk.render(bodies.block, context.push(from, from, len));
	}
}