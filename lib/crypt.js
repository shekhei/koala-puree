"use strict";
var forge = require('node-forge');

class Crypter {
	constructor() {
		this.hasher = forge.md.sha256.create();
	}
	hash(val) {
		var md = forge.md.sha256.create();
		md.update(val);
		return md.digest().toHex();
	}
	encrypt(val) {
		return val;
	}
	decrypt(val) {
		return val;
	}
}

exports = module.exports = new Crypter();