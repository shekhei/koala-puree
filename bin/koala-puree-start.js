#!/usr/bin/env node

var knex = require("knex"),
	yaml = require('read-yaml');

var env = process.env.NODE_ENV || "development";

var spawn = require("child_process").spawn;
var args = process.argv.slice(1);

var child = spawn("./koala-puree", ['--harmony', 'start'].concat(args), {
  cwd: process.cwd(),
  stdio: [
    0,
    1,
    2
  ]
});
