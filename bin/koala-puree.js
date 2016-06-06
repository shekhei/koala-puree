#!/usr/bin/env node

// var yaml = require("read-yaml");

// var env = process.env.NODE_ENV || "development";
//modify this to base on gulp
const gulp = require('gulp');
const glob = require('glob');
const yargs = require('yargs');
const Promise = require('bluebird');

const argv = yargs
								.usage('Usage: $0 <command> [options]')
								.boolean("list")
								.alias("l", "list")
								.describe('l', 'list commands')
								.help('h')
								.check((argv) => {
									if ( argv.h || argv.l ) {
										return true;
									}
									if (!argv._.length) {
										throw "You must provide at least a command"
									}
									return true;
								})
								.argv;


var path = require("path").resolve(process.cwd()+"/index.js");
// console.log(path);
var TestApp = require(path);
var App = new TestApp();

function loadTaskes(options, argv) {
	return new Promise((res, rej)=> {

		// var time = Date.now()
		glob("/**/*.gulptask.js", {
			cwd: process.cwd(),
			root: process.cwd(),
			cache: true,
			nodir:true,
			follow: true
		}, (err, files) =>{
			if ( err ) { return rej(err); }
			// console.log("tooke this long", Date.now()-time);
			// if ( err ) { return rej(err); }
		for ( var i = 0; i < files.length; i++ ) {
			var taskFile = require(files[i]);
			taskFile(gulp, options, argv.join(" "), App);
		}
		res(gulp);
		})

	})
		// res(gulp);
	// })
	// return new Promise((res, rej) => {
		// var time = Date.now();

	// });
}


if ( argv.list ) {
	loadTaskes(argv, process.argv.slice(process.argv.indexOf(command)+1)).then((gulp)=>{
		console.log("Available task:")
		for (var name in gulp.tasks) {
			console.log("\t"+name);
		}
	}).catch((err) =>{
		console.log("Error: ", err);
		process.exit(1);
	});
} else {
	var command = argv._[0];

	argv._ = argv._.slice(1);
	if ( /^(koala-puree:|start$)/.test(command)) {
		var taskFile = require(require('path').resolve(__dirname, "..", "tasks", "server.gulptask.js"));
		taskFile(gulp, argv, process.argv.slice(process.argv.indexOf(command)+1), App)
		if ( !gulp.tasks[command] ) {
			throw "task is not available"
		}
		// gulp.task('default', [command]);
		gulp.start(command)
	} else {
		loadTaskes(argv, process.argv.slice(process.argv.indexOf(command)+1)).then((gulp)=>{
			if ( !gulp.tasks[command] ) {
				throw "task is not available"
			}
			// gulp.task('default', [command]);
			gulp.start(command)
		}).catch((err) =>{
			console.log("Error: ", err);
			process.exit(1);
		});
	}
	var stopped = false;
	setInterval(function(){
		if ( stopped ) {
			process.exit(0);
		}
	}, 100)
	gulp.on('task_stop', function(e){
		console.log("task stopped", e, command)
		if ( e.task === command ) {
				stopped = true;
		}
	})

}
	//
	//
	//     var program = require("commander");
	//     var path = require("path").resolve(process.cwd()+"/index.js");
	//     program.version("0.0.1")
	// 	.command("start")
	// 	.description("starts a simple server based on your config/server.yml")
	// 	.action(function(){
	// 		// console.log("action is starting");
	// 		// console.log(process.cwd());
	// //		if ( require('fs').existsSync(path) ) {
	// //			var child = require('child_process').spawn(path, ["start"]);
	// //		} else {
  //   try {
	// 			                var path = require("path").resolve(process.cwd()+"/index.js");
	// 			// console.log(path);
	// 			                var TestApp = require(path);
	// 			                var App = new TestApp();
	// 			                App.start();
  //           } catch(e) {
  //               console.log("failed to start", e.stack);
  //           }
	// //		}
	// 	});
	//     program.command("profile")
	// 	.description("starts a simple server based on your config/server.yml with profiling on")
	// 	.action(function(){
	// 		// console.log("action is starting");
	// 		// console.log(process.cwd());
	// //		if ( require('fs').existsSync(path) ) {
	// //			var child = require('child_process').spawn(path, ["start"]);
	// //		} else {
  //   var profiler = require("v8-profiler");
  //   profiler.startProfiling("profiler");
	// 			    var path = require("path").resolve(process.cwd()+"/index.js");
	// 			// console.log(path);
	// 			    var TestApp = require(path);
	// 			    var App = new TestApp();
	// 			    App.start();
  //   function onSIGTERM() {
  //                   console.log("we are killing it now");
  //                   App.close();
  //                   var cpuprofile = profiler.stopProfiling("profiler");
  //                   require("fs").writeFileSync(
  //                           process.cwd() + "/koala.cpuprofile"
  //                         , JSON.stringify(cpuprofile, null, 2)
  //                         , "utf8"
  //                       );
  //               }
  //   process.on("SIGINT", onSIGTERM);
	// //		}
	// 	});
	//
	//     program.command("generate:migration")
	// 	.action(function(){
	// 		    console.log(arguments);
	//
	// 		    var TestApp = require(path);
	// 		    var app = new TestApp();
	// 				var pureeorm = app.ORM;
	// 		    pureeorm.createMigration(app, arguments[0]).then(function(){
	// 			    console.log("done");
	// 			    process.exit(0);
	// 		});
	// 		// pureeorm.make()
	// 	});
	//     program.command("migrate")
	// 	.description("migrates data")
	// 	.action(function(){
	// 		    console.log(arguments);
	//
	// 		    var TestApp = require(path);
	// 		    var app = new TestApp();
	// 				var pureeorm = app.ORM;
	// 		    pureeorm.migrate(app).then(function(){
	// 			    console.log("done");
	// 			    process.exit(0);
	// 		});
	// 	});
	//     program.command("migrate:rollback")
	// 	.description("rollback")
	// 	.action(function(){
	// 		    console.log(arguments);
	//
	// 		    var TestApp = require(path);
	// 		    var app = new TestApp();
	// 				var pureeorm = app.ORM;
	// 		    pureeorm.rollback(app).then(function(){
	// 			    console.log("done");
	// 			    process.exit(0);
	// 		});
	// 	});
	//     program.command("db:seed")
	// 	.description("seeding")
	// 	.action(function(){
	// 		    console.log(arguments);
	//
	// 		    var TestApp = require(path);
	// 		    var app = new TestApp();
	// 				var pureeorm = app.ORM;
	// 		    app.start(undefined, true).then(function(){
	// 			    pureeorm.seed(app).then(function(){
	// 				    app.close().then(function(){
	// 					    console.log("done");
	// 					    process.exit(0);
	// 				});
	// 			});
	// 		});
	// 	});
	//     program.parse(process.argv);
