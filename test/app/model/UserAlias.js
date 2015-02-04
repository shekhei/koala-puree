module.exports = {
	attributes: {
		type: {
			type: 'string'
		},
		value: {
			type: 'string'
		},
		provider: {
			type: 'string'
		},
		user: {
			model: "User"
		},
		lat: {
			type: 'decimal',
			defaultsTo: '0.0'
		},
		lng: {
			type: 'decimal',
			defaultsTo: '0.0'
		}
	},
	afterSchemaCreate: function(schema) {
		return Promise.all([
			schema.index(['spatial','lat','lng'])
		])
	}
}