module.exports = exports = function(dust){
	var _ = require('lodash');
	dust.helpers["route"] = function(chunk, context, bodies, params){
		var path = params.route;
		if ( self._ns && self._ns !== "/" ) {
			chunk.write(self._ns);
		}
	    return _.isFunction(path) ? path(chunk, context) : chunk.write(path);
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

		chunk.write('<input type="hidden" name="_csrf" value=""/>')
		if ( bodies.block ) {
			bodies.block(chunk, context);
		}
	    return chunk.write('</form>');

	}
	dust.helpers["param"] = function(chunk, context, bodies, params) {
		var name = params.name;
		context.current()[name]=function(chunk){
			bodies.block(chunk, context);
			return chunk;
		}
		return chunk;
	}
	var moment = require('moment');
	dust.helpers["date"] = function(chunk, context, bodies,params) {
		var key = params.key;
		var format = params.format;
		return chunk.write(moment(key).zone(8).format(format));
	}
}