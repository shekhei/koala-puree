var generators = require('yeoman-generator');
var _ = require('lodash')
module.exports = generators.Base.extend({
  // The name `constructor` is important here
  constructor: function () {
    // Calling the super constructor is important so our generator is correctly set up
    generators.Base.apply(this, arguments);
    this.argument('appname', { type: String, required: true });
  },
  generateMigration: function() {
    console.log(this.migrationName);
    var camel = _.camelCase(this.migrationName);
    var kebab = _.kebabCase(this.migrationName);
    this.fs.copyTpl(
      this.templatePath(`${__dirname}/../templates/migration.js`),
      this.destinationPath(`db/migrations/${kebab}-${Date.now()}.js`),
      {migrationName: camel}
    );
  }
});
