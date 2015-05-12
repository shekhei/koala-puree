
var moment = require('moment');
moment.fn.yesterday = function(){
	return this.subtract(1, 'days');
}
moment.fn.tomorrow = function(){
	return this.add(1, 'days');
}

module.exports = exports = moment;