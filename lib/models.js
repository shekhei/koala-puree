"use strict"
var puree = require('../index'),
    glob = require("glob"),
    debug = require('debug')('koala-puree:models'),
    Orientose = require('orientose'),
    checkIt = require('checkit'),
    Promise = require('bluebird'),
    Schema = Orientose.Schema;

var DEFAULTCONFIG = {
    "base": "app/model/"
}

class ModelBuilder {
    constructor(orientose, name, modelDef, app) {
        var self = this;
        self._name = name;
        self._props = {};
        self._pre = {};
        self._modelDef = modelDef;
        this._orientose = orientose;
        this._app = app;
    }
    initialize(func) {
        this._initializer = func;
    }
    attr(key, def) {
        if (this._schema) {
            var props = {};
            props[key] = def;
            this._schema.add(props);
        } else {
            this._props[key] = def;
        }
        return this;
    }
    pre(key, func) {
        this._pre[key] = this._pre[key] || [];
        this._pre[key].push(func);
        return this;
    }
    buildschema(parent) {
        var self = this;
        parent = parent || Schema.V
        var schema = new parent(self._props, {
            className: this._name
        });
        console.log(this._modelDef);
        for ( var name in this._modelDef ) {
            // statics
            schema.static(name, self._modelDef[name]);
        }

        schema.static('_omodel', function(name){
            return self._orientose.model(name);
        })

        schema.method('_omodel', function(name){
            return self._orientose.model(name);
        })

        schema.static('_orientose', function(name){
            return self._orientose;
        })

        schema.method('_orientose', function(name){
            return self._orientose;
        })

        schema.static('_app', function(name){
            return self._app;
        })

        schema.method('_app', function(name){
            return self._app;
        })

        for ( var name in this._modelDef.prototype ) {
            // virtuals and methods

            var desc = Object.getOwnPropertyDescriptor(self._modelDef.prototype, name);
            if ( desc.get || desc.set ) {
                var v = schema.virtual(name);
                if ( desc.get ) {
                    v.get(desc.get);
                }
                if ( desc.set ) {
                    v.set(desc.set);
                }
            } else {
                schema.method(name, self._modelDef.prototype[name]);
            }
        }
        if (this._pre) {
            console.log("adding pre")
            for (var name in this._pre) {

                console.log("adding pre for", name);
                schema.pre(name, (function(name){
                    return function(done){
                        console.log("running pre", name, here)
                        var here = this;
                        function next(i){
                            if ( i >= self._pre[name].length ) {
                                console.log(done);
                                return done.call(here);
                            }
                            return self._pre[name][i].call(here, function(){
                                return next(i+1);
                            });
                        
                        }
                        next(0);
                    }
                })(name));
            }
        }
        self._schema = schema;

        // console.log(schema);

        return schema;
    }
    build() {

        var self = this;
        return self._orientose.model(self._name, self._schema, {
            ensure: false
        }).then(function(model) {
            return Promise.resolve([self._name, model])
        }).catch(function(err) {
            debug("Failed to create", self._name, err.stack);
            return reject(err);
        });
    }
    beforebuild(schemas) {
        var self = this;
        return new Promise(function(resolve, reject) {
            try {
                if (self._later) {
                    for (var i = 0; i < self._later.length; i++) {
                        self._later[i].call(self, schemas);
                    }
                    return resolve();
                }
                resolve();
            } catch (e) {
                console.log(e.stack);
                reject(e);
            }
        })
    }
    timestamps() {
        this.date('updated_at', {
            default: Date.now()
        });
        this.pre('save', function(done) {
            if (this._isNew) {
                this.created_at = Date.now();
            }
            this.updated_at = Date.now();
            done();
        })
        this.date('created_at', {
            default: Date.now()
        });
    }
}

for (var type in Orientose.Type) {
    ModelBuilder.prototype[type.toLowerCase()] = (function(type) {
        return function(name, options) {
            options = options || {};
            options.type = Orientose.Type[type];
            this.attr(name, options);
        }
    })(type);
}

ModelBuilder.prototype.embeddedlist = function(name, fn) {
    this._later = this._later || [];
    this._later.push(function(schemas) {
        if (require('util').isFunction(fn)) {
            this.attr(name, fn(schemas))
        } else {
            this.attr(name, fn);
        }
    })
}

function genModel(file, remove, orientose, app, builders, parentSchema) {
    parentSchema = parentSchema || Schema.V;
    var name = require('path').basename(file, ".js");
    remove = remove === undefined ? false : remove;
    var path = file,
        schema;
    if (remove) {
        delete require.cache[path];
    }
    var modelDef = require(path);
    var builder = new ModelBuilder(orientose, name, modelDef, app);
    modelDef.call(builder, builder, orientose)
    if (builders) {
        builders.push(builder);
    }
    return Promise.resolve(builder.buildschema(parentSchema));
}

var pureeorm = exports = module.exports = function() {

    var orm;
    var obj = {
        setup: function * setupModel(next) {

            var app = this;
            debug(`beginning model middleware`);
            var dburl;
            var connectionName = "fdb" + Math.random() + Date.now();

            if (!app._config.db || !app._config.db.url) {
                let config = app._config.db || {}
                let username = config.username || "root";
                let password = config.password || "root";
                let host = config.host || "localhost";
                let port = config.port || "2424";
                let dbname = config.dbname || app._config.name;
                if (!dbname) {
                    throw ("dbname or package name has to be provided");
                }
                if (app._app.env !== "production") {
                    dbname = `${dbname}-${app._app.env}`;
                }
                dburl = `fdb://${username}:${password}@${host}:${port}/${dbname}`;
            } else {
                dburl = app._config.db.url
            }
            let _config = require('extend')({}, DEFAULTCONFIG, {
                connection: {}
            });
            debug("Creating waterline model", dburl);
            orm = app._orm = obj.getOriento(app);
            app.Orientose = Orientose;
            app._app.use(function * (next) {
                debug("adding models to this scope")
                this.models = app.models;
                yield * next;
            });
            debug('update')
            var fs = require('fs');
            app.models = {};
            var promises = [];
            var builders = [];
            var schemas = {};
            yield new Promise(function(resolve, reject) {
                glob(require('path').resolve(app._basePath, _config.base + "vertex/*.js"), function(er, files) {
                    if (er) {
                        return reject(er);
                    }
                    debug("creating adapter identity", connectionName);
                    var config = obj.getConfig(app);
                    // var schemas = [];

                    for (var f of files) {
                        promises.push(genModel(f, app._app.env !== "production", app._orm, app, builders));
                        // orm.loadCollection(require('waterline').Collection.extend(schema))
                        // schemas.push(schema);
                        // app.models[name] = context[name];
                        debug(`loading ${f}`);
                    }
                    for (var i = 0; i < builders.length; i++) {
                        schemas[builders[i]._name] = builders[i]._schema;
                    }
                    resolve();
                })

            }).then(function() {
                return new Promise(function(resolve, reject) {
                    glob(require('path').resolve(app._basePath, _config.base + "edge/*.js"), function(er, files) {
                        if (er) {
                            return reject(er);
                        }
                        debug("creating adapter identity", connectionName);
                        var config = obj.getConfig(app);
                        // var schemas = [];
                        // app.models = {};
                        // var promises = [];
                        // var builders = [];
                        for (var f of files) {
                            promises.push(genModel(f, app._app.env !== "production", app._orm, app, builders, Schema.E));
                            // orm.loadCollection(require('waterline').Collection.extend(schema))
                            // schemas.push(schema);
                            // app.models[name] = context[name];
                            debug(`loading ${f}`);
                        }
                        for (var i = 0; i < builders.length; i++) {
                            schemas[builders[i]._name] = builders[i]._schema;
                        }
                        resolve();
                    })
                })
            }).then(function() {
                return Promise.all(promises);
            }).then(function(names) {
                debug("getting all the names", names);
                return Promise.all(builders.map(function(b) {
                    return b.beforebuild(schemas);
                }));
            }).then(function() {
                return Promise.all(builders.map(function(b) {
                    return b.build();
                }));
            }).then(function(models) {
                for (var i = 0; i < models.length; i++) {
                    app.models[models[i][0]] = models[i][1];
                }
            });
            yield * next;
        },
        teardown: function(app) {
            return Promise.all([
                app._orm._server.close(),
                app._orm._db.close()
            ])
        },
        getConfig: function(app) {
            var dburl;
            var connectionName = "fdb" + Math.random() + Date.now();
            var config = require('extend')({}, DEFAULTCONFIG, {
                connection: {}
            });
            var _config = app._config.db || {}
            let username = _config.username || "root";
            let password = _config.password || "root";
            let host = _config.host || "localhost";
            let port = _config.port || "2424";
            let dbname = _config.dbname;

            if (!dbname) {
                return reject("dbname or package name has to be provided");
            }
            if (app._app.env !== "production") {
                dbname = `${dbname}-${app._app.env}`;
            }
            config.connection = {
                host: host,
                user: username,
                password: password,
                port: port,
                name: dbname
            };
            debug("config retrieved for applicatin", config);
            return config;
        },
        getManager: function(app){
            var config = obj.getConfig(app)
            var orientose = obj.getOriento(app);
            console.log(app._config);
            var name = app._config.name.replace(/[_-][a-zA-Z0-9]/g,function(match){
                return match[1].toUpperCase();
            })
            var manager = new Orientose.Oriento.Migration.Manager({
                db: orientose._db,
                dir: app._basePath + '/db/migrations',
                className: name+"Migration"
            });
            return manager;
        },
        createMigration: function(app, name) {
            var self = this;
            var manager = this.getManager(app);
            return manager.create(name)
        },
        migrate: function(app) {
            var self = this;
            var manager = this.getManager(app);
            return manager.up().catch(function(e){console.log(e.stack);});
        },
        rollback: function(app) {
            var self = this;
            var manager = this.getManager(app);
            return manager.down(1)
        },
        seed: function(app) {
            return new Promise(function(resolve, reject){
                glob(require('path').resolve(app._basePath, "db/seed/*.js"), function(er, files) {
                    if (er) {
                        return reject(er);
                    }
                    // var schemas = [];
                    var promises = [];
                    for (var f of files) {
                        var seeding = require(f);

                        promises.push(
                            seeding.seed(app)
                        );
                        // orm.loadCollection(require('waterline').Collection.extend(schema))
                        // schemas.push(schema);
                        // app.models[name] = context[name];
                        
                    }
                    function next(i){
                        if ( i >= promises.length ) {
                            return resolve();
                        }
                        debug('loading', promises[i]);
                        promises[i].then(function(){
                            next(i+1);
                        }).catch(function(e){
                            console.log("Failed to seed", e, e.stack);
                            reject();
                        })
                    }
                    next(0);
                })
            })
        },
        getOriento: function(app) {
            try {
                debug("Creating orientose");
                var dbConfig = obj.getConfig(app);
                debug("Using this dbConfig", dbConfig);
                var orm = new Orientose(dbConfig.connection, dbConfig.connection.name);
                debug("orientose created");
                return orm;
            } catch (e) {
                debug("failed to create orientose", e.stack);
                throw e;
            }

        }
    }
    return obj;
};