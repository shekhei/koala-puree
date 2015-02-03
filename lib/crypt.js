"use strict";
var forge = require('node-forge');

class Crypter {
	constructor() {
		this.hasher = forge.md.md5.create();
	}
	hash(val) {
		return val;
	}
	encrypt(val) {
		return val;
	}
	decrypt(val) {
		return val;
	}
}

exports = module.exports = new Crypter();