module.exports = function(orm) {
	this.attr('alias', function(){
		return this.hasMany(orm.UserAlias);
	});
}