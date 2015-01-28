#!/usr/bin/env node --harmony
var program = require('commander');

program.version('0.0.1')
	.command('start')
	.description('starts a simple server based on your config/server.yml')
	.action(function(){
		// console.log("action is starting");
		// console.log(process.cwd());
		var path = require('path').resolve(process.cwd()+'/node_modules/.bin/koala-puree');
		if ( require('fs').existsSync(path) ) {
			var child = require('child_process').spawn(path, ["start"]);
		} else {
			path = require('path').resolve(process.cwd()+'/index.js');
			// console.log(path);
			var TestApp = require(path);
			var App = new TestApp();
			App.start();
		}
	})
program.parse(process.argv);

