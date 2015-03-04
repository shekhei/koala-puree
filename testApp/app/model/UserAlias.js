module.exports = function(model,models) {
	this.attr('user', function(){
		return this.belongsTo(orm.User);
	});
}