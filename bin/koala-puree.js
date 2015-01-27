#!/usr/bin/env node --harmony
var program = require('commander');

program.version('0.0.1')
	.command('start')
	.description('starts a simple server based on your config/server.yml')
	.action(function(){
		require(require('path').resolve(process.cwd()+'/index.js')).start();
	})
program.parse(process.argv);

