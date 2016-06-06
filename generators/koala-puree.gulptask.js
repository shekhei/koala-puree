
module.exports = function KoalaSequelize(gulp, options, argv, app) {

  gulp.task("create", function(done){
    var yeoman = require('yeoman-environment');
    var env = yeoman.createEnv();
    var generator = require('./generators/scaffolding');
    env.registerStub(generator, 'app:scaffolding');
    if ( !options._.length ) {
      env.run(`app:scaffolding --help`, done);
      return;
    }

    env.run(`app:scaffolding ${argv}`, done);
  })
}
