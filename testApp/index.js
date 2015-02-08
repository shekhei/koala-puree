"use strict"
var KoalaPuree = require('koala-puree');

// var mod = module;


class TestApp extends KoalaPuree {
	constructor() {
		super(module);
	}
}

// var TestApp = new KoalaPuree(module);

exports = module.exports = TestApp;
