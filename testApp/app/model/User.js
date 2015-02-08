module.exports = {
	attributes: {
		name: {
			type: 'string'
		},
		aliases: {
			collection: 'UserAlias',
			via: 'user'
		}
	}
}