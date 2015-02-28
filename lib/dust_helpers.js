module.exports = exports = function(dust){
	dust.helpers["route"] = function(chunk, context, bodies, params){
		var path = params.route;
		if ( self._ns && self._ns !== "/" ) {
			chunk.write(self._ns);
		}
	    return require('util').isFunction(path) ? path(chunk, context) : chunk.write(path);
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
		if ( method !== "get" && method !== "post") {
			hiddenmethod = method;
			method = "post";
		}
		console.log("-------------------------------------------------------",hiddenmethod, method);
		chunk.write('<form method="'+method+'" action="');
		if ( self._ns && self._ns !== "/" ) {
			chunk.write(self._ns);
		}
	    require('util').isFunction(path) ? path(chunk, context) : chunk.write(path);
	    chunk.write('" enctype="')
	    require('util').isFunction(enctype) ? enctype(chunk, context) : chunk.write(enctype);
	    if ( params.class ) {
	    	chunk.write('" class="')
	    	require('util').isFunction(params.class) ? params.class(chunk, context) : chunk.write(params.class);
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
}