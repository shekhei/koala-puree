#!/usr/bin/env node

var yaml = require('read-yaml');

var env = process.env.NODE_ENV || "development";


if ( process.execArgv.indexOf('--harmony') < 0) {

	var spawn = require("child_process").spawn;
	var args = process.argv.slice(1);

	var child = spawn(process.argv[0], ['--harmony'].concat(args), {
	  cwd: process.cwd(),
	  stdio: [
	  	0,
	  	1,
	  	2
	  ]
	});
} else {
	var program = require('commander');
	var path = require('path').resolve(process.cwd()+'/index.js');
	program.version('0.0.1')
		.command('start')
		.description('starts a simple server based on your config/server.yml')
		.action(function(){
			// console.log("action is starting");
			// console.log(process.cwd());
	//		if ( require('fs').existsSync(path) ) {
	//			var child = require('child_process').spawn(path, ["start"]);
	//		} else {
				var path = require('path').resolve(process.cwd()+'/index.js');
				// console.log(path);
				var TestApp = require(path);
				var App = new TestApp();
				App.start();
	//		}
		})
	program.command('generate:migration')
		.action(function(){
			console.log(arguments);
			var pureeorm = require('../lib/models.js')();
			var TestApp = require(path);
			var app = new TestApp();
			pureeorm.createMigration(app, arguments[0]).then(function(){
				console.log("done");
				process.exit(0);
			});
			// pureeorm.make()
		})
	program.command('migrate')
		.description('migrates data')
		.action(function(){
			console.log(arguments);
			var pureeorm = require('../lib/models.js')();
			var TestApp = require(path);
			var app = new TestApp();
			pureeorm.migrate(app).then(function(){
				console.log("done");
				process.exit(0);
			})
		})
	program.command('migrate:rollback')
		.description('rollback')
		.action(function(){
			console.log(arguments);
			var pureeorm = require('../lib/models.js')();
			var TestApp = require(path);
			var app = new TestApp();
			pureeorm.rollback(app).then(function(){
				console.log("done");
				process.exit(0);
			})
		})
	program.command('db:seed')
		.description('seeding')
		.action(function(){
			console.log(arguments);
			var pureeorm = require('../lib/models.js')();
			var TestApp = require(path);
			var app = new TestApp();
			app.start(undefined, true).then(function(){
				pureeorm.seed(app).then(function(){
					app.close().then(function(){
						console.log("done");
						process.exit(0);
					})
				})
			})
		})
	program.parse(process.argv);
}
