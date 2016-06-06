"use strict"
module.exports = function ServerTask(gulp, options, argv, app) {
  gulp.task("start", ["koala-puree:start"]);
  gulp.task("koala-puree:start", ()=>{
    app.start();
    return
  })
}
