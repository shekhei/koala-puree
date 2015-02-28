#!/usr/bin/env node --harmony
if ( process.execArgv.indexOf('--harmony') < 0) {
	var spawn = require("child_process").spawn;
	var child = spawn(process.execPath, ['--harmony'].concat(process.execArgv), {
	  cwd: require("path").dirname(process.execPath)
	});
	child.stdout.pipe(process.stdout);
	child.stderr.pipe(process.stderr);
} else {
	var program = require('commander');

	program.version('0.0.1')
		.command('start')
		.description('starts a simple server based on your config/server.yml')
		.action(function(){
			// console.log("action is starting");
			// console.log(process.cwd());
	//		if ( require('fs').existsSync(path) ) {
	//			var child = require('child_process').spawn(path, ["start"]);
	//		} else {
				path = require('path').resolve(process.cwd()+'/index.js');
				// console.log(path);
				var TestApp = require(path);
				var App = new TestApp();
				App.start();
	//		}
		})
	program.command('migrate')
		.description('migrates data')
		.action(function(){
			console.log("migrating data now");
			process.env.MODELSYNC = 1;
			path = require('path').resolve(process.cwd()+'/index.js');
			// console.log(path);
			var TestApp = require(path);
			var App = new TestApp();
			App.start(null, true).then(function(){
				console.log("It is completed");
				process.exit(0);
			});
		})
	program.parse(process.argv);
}
