"use strict"
var KoalaPuree = require('../index.js');

// var mod = module;


class TestApp extends KoalaPuree {
	constructor() {
		super(module);
	}
}

// var TestApp = new KoalaPuree(module);

exports = module.exports = TestApp;
