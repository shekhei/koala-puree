/**
 * This module creates a wrapper around the orientose orm
 *
 * @module lib/models
 * @link OrientoseModelPlugin
 */

"use strict";

var glob = require("glob"),
    logger = require("debug"),
    debug = logger("koala-puree:models"),
    Orientose = require("@shekhei/orientose"),
    Promise = require("bluebird"),
    Schema = Orientose.Schema;
var DEFAULTCONFIG = {
    "base": "app/model/"
};

/**
 *
 */
class ModelBuilder {
    constructor(orientose, name, modelDef, app) {
        var self = this;
        self._name = name;
        self._props = {};
        self._pre = {};
        self._modelDef = modelDef;
        this._orientose = orientose;
        this._relations = {};
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
        parent = parent || Schema.V;
        var schema = new parent(self._props, {
            className: this._name
        });

        var names = Object.getOwnPropertyNames(this._modelDef);
        for ( let i = 0; i < names.length; i++ ) {
            var name = names[i];
            var property = Object.getOwnPropertyDescriptor(this._modelDef, name);
            if ( require("util").isFunction(property.value)) {
                // debug(property.value, name);
                // statics
                schema.static(name, property.value);
            }
        }
        schema.static("_omodel", function(name){
            return self._orientose.model(name);
        });

        schema.method("_omodel", function(name){
            return self._orientose.model(name);
        });

        schema.static("_orientose", function(){
            return self._orientose;
        });

        schema.method("_orientose", function(){
            return self._orientose;
        });

        schema.static("_app", function(){
            return self._app;
        });

        schema.method("_app", function(){
            return self._app;
        });
        names = Object.getOwnPropertyNames(this._modelDef.prototype);
        for ( let i = 0; i < names.length; i++ ) {
            // virtuals and methods
            let name = names[i];
            var desc = Object.getOwnPropertyDescriptor(self._modelDef.prototype, name);
            debug(name, desc);
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
                for (let name in self._relations ) {
                    (function(name) {
                        var methodName = name.replace(/^[A-Z]/, function(one){ return one.toLowerCase();});
                        var rel = self._relations[name];
                        if ( "link" in rel || "in" in rel || "out" in rel || "both" in rel ) {
                            var cond = rel.link || rel.in || rel.out || rel.both;
                            var reverseCond;
                            if ( "link" !== rel.linkType ) {
                                if ( rel.in ) {
                                    reverseCond = "out";
                                } else if ( rel.out ) {
                                    reverseCond = "in";
                                }
                                reverseCond = reverseCond+"('"+cond+"')";
                                cond = rel.linkType+"('"+cond+"')";
                            }
                            var one = rel.type === "hasOne" ? true : false;
                            schema.static("findBy"+name, function _reverseLocate(id){
                                if ( id._id ) {
                                    id = id._id;
                                }
                                var self = this;
                                var query = this._orientose()
                                        ._db
                                        .select()
                                        .from(`( select expand(${reverseCond}) from ${id} )`)
                                        .where({"@class": `${self._model.name}`});
                                if ( one ) {
                                    query.limit(1);
                                }
                                var newQuery = function(){};
                                newQuery.query = query;
                                "limit where order let".split(" ").forEach(function(name){
                                    newQuery[name] = function(){
                                        debug(this.query);
                                        this.query[name].apply(this.query, arguments);
                                        return this;
                                    };
                                });
                                newQuery.then = function(fn){
                                    var p = query.exec()
                                    .then(function(m){
                                        debug(m);
                                        var model = self._model;
                                        if ( one ) {
                                            return Promise.resolve(model._createDocument(m[0]));
                                        }
                                        return Promise.resolve(m.map(function(m){
                                            return model._createDocument(m);
                                        }));
                                    });
                                    if ( fn ) {
                                        p = p.then(fn);
                                    }
                                    return p;
                                };
                                return newQuery;
                            });
                            schema.method(methodName, function _getRelation(){
                                var self = this;
                                var query = this._orientose()
                                        ._db
                                        .select()
                                        .from(`( select expand(${cond}) from ${this._id} )`)
                                        .where({"@class": `${rel.clz}`});
                                if ( one ) {
                                    query.limit(1);
                                }
                                var newQuery = function(){};
                                newQuery.query = query;
                                "limit where order let".split(" ").forEach(function(name){
                                    newQuery[name] = function(){
                                        debug(this.query);
                                        this.query[name].apply(this.query, arguments);
                                        return this;
                                    };
                                });
                                newQuery.then = function(fn){
                                    var p = query.exec()
                                    .then(function(m){
                                        debug(m);
                                        var model = self._omodel(rel.clz)._model;
                                        debug("creating models?");
                                        if ( one ) {
                                            debug("creating just one?", m[0]);
                                            return model._createDocument(m[0]);
                                        }
                                        return Promise.resolve(m.map(function(m){
                                            return model._createDocument(m);
                                        }));
                                    });
                                    if ( fn ) {
                                        p = p.then(fn);
                                    }
                                    return p;
                                };
                                return newQuery;
                            });

                        } else {
                            throw "A link type must be defined for "+name;
                        }
                    })(name);
                }
            }
        }
        if (this._pre) {
            for (let name in this._pre) {
                schema.pre(name, (function(name){
                    return function(done){
                        debug("running pre", name, here);
                        var here = this;
                        function next(i){
                            if ( i >= self._pre[name].length ) {
                                debug(done);
                                return done.call(here);
                            }
                            return self._pre[name][i].call(here, function(){
                                return next(i+1);
                            });

                        }
                        next(0);
                    };
                })(name));
            }
        }
        self._schema = schema;

        // debug(schema);

        return schema;
    }
    build() {

        var self = this;
        return self._orientose.model(self._name, self._schema, {
            ensure: false
        }).then(function(model) {
            return Promise.resolve([self._name, model]);
        }).catch(function(err) {
            debug("Failed to create", self._name, err.stack);
            return Promise.reject(err);
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
                debug(e.stack);
                reject(e);
            }
        });
    }
    timestamps() {
        this.date("updated_at", {
            default: Date.now()
        });
        this.pre("save", function(done) {
            if (this._isNew) {
                this.created_at = Date.now();
            }
            this.updated_at = Date.now();
            done();
        });
        this.date("created_at", {
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
        };
    })(type);
}

ModelBuilder.prototype.embeddedlist = function(name, fn) {
    this._later = this._later || [];
    this._later.push(function(schemas) {
        if (require("util").isFunction(fn)) {
            this.attr(name, fn(schemas));
        } else {
            this.attr(name, fn);
        }
    });
};

ModelBuilder.prototype.embedded = function(name, fn) {
    this._later = this._later || [];
    this._later.push(function(schemas) {
        if (require("util").isFunction(fn)) {
            this.attr(name, fn(schemas));
        } else {
            this.attr(name, fn);
        }
    });
};

"hasOne hasMany".split(" ").forEach(function(hasType){
    ModelBuilder.prototype[hasType] = function(name) {
        this._relations[name] = {
            clz: name,
            type: hasType
        };
        var self = this;
        var ret = {};
        "in out both link".split(" ").forEach(function(type){
            ret[type] = function(cond) {
                self._relations[name][type] = cond;
                self._relations[name].linkType = type;
            };
        });
        return ret;
    };
});

function genModel(file, remove, orientose, app, builders, parentSchema) {
    parentSchema = parentSchema || Schema.V;
    var name = require("path").basename(file, ".js");
    remove = remove === undefined ? false : remove;
    var path = file;
    if (remove) {
        delete require.cache[path];
    }
    var modelDef = require(path);

    var builder = new ModelBuilder(orientose, name, modelDef, app);
    // calling constructor to build
    new modelDef(builder, orientose);
    if (builders) {
        builders.push(builder);
    }
    return Promise.resolve(builder.buildschema(parentSchema));
}

/**
 * This is the middleware generator exported
 */
module.exports = function OrientoseModelPlugin() {
    /**
     * @class OrientoseModelPlugin
     */
    var obj = {
        /**
         * In general this will setup the model and insert app.Orientose, app._orm and app.models into koala-puree
         * will also add models into the context of the controller
         * @memberof OrientoseModelPlugin
         * @function setup
         * @static
         */
        setup: function * setupModel(next) {

            var app = this;
            debug(`beginning model middleware`);
            var dburl;
            var connectionName = "fdb" + Math.random() + Date.now();

            if (!app._config.db || !app._config.db.url) {
                let config = app._config.db || {};
                let username = config.username || "root";
                let password = config.password || "root";
                let host = config.host || "localhost";
                let port = config.port || "2424";
                let dbname = config.dbname || app._config.name;
                debug(dbname, config.dbname, app._config.name);
                if (!dbname) {
                    throw ("dbname or package name has to be provided");
                }
                if (app._app.env !== "production") {
                    dbname = `${dbname}-${app._app.env}`;
                }
                dburl = `fdb://${username}:${password}@${host}:${port}/${dbname}`;
            } else {
                dburl = app._config.db.url;
            }
            let _config = require("extend")({}, DEFAULTCONFIG, {
                connection: {}
            });
            debug("Creating waterline model", dburl);
            app._orm = obj.getOriento(app);
            app.Orientose = Orientose;
            app._app.use(function * (next) {
                debug("adding models to this scope");
                this.models = app.models;
                yield * next;
            });
            debug("update");
            app.models = {};
            var promises = [];
            var builders = [];
            var schemas = {};
            yield new Promise(function(resolve, reject) {
                glob(require("path").resolve(app._basePath, _config.base + "vertex/*.js"), function(er, files) {
                    if (er) {
                        return reject(er);
                    }
                    debug("creating adapter identity", connectionName);
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
                });

            }).then(function() {
                return new Promise(function(resolve, reject) {
                    glob(require("path").resolve(app._basePath, _config.base + "edge/*.js"), function(er, files) {
                        if (er) {
                            return reject(er);
                        }
                        debug("creating adapter identity", connectionName);
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
                    });
                });
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
            debug("completed setup");
            yield * next;
            debug("entering after yield");
        },
        teardown: function*(next) {
            var app = this;
            debug("tearing down lib/models.js");
            yield Promise.all([
                app._orm._server.close(),
                app._orm._db.close()
            ]);
            debug("we reached here??");
            yield* next;
            debug("lib/models.js torn");
        },
        getConfig: function(app) {
            var config = require("extend")({}, DEFAULTCONFIG, {
                connection: {}
            });
            var _config = app._config.db || {};
            let username = _config.username || "root";
            let password = _config.password || "root";
            let host = _config.host || "localhost";
            let port = _config.port || "2424";
            let dbname = _config.dbname || app._config.name;

            if (!dbname) {
                throw "dbname or package name has to be provided";
            }
            if (app._app.env !== "production") {
                dbname = `${dbname}-${app._app.env}`;
            }
            config.connection = {
                host: host,
                user: username,
                password: password,
                port: port,
                name: dbname,
                logger: {debug: logger("orientose:debug")}
            };
            debug("config retrieved for applicatin", config);
            return config;
        },
        getManager: function(app){
            var orientose = obj.getOriento(app);
            debug(app._config);
            var name = app._config.name.replace(/[_-][a-zA-Z0-9]/g,function(match){
                return match[1].toUpperCase();
            });
            var manager = new Orientose.Oriento.Migration.Manager({
                db: orientose._db,
                dir: app._basePath + "/db/migrations",
                className: name+"Migration"
            });
            return manager;
        },
        createMigration: function(app, name) {
            var manager = this.getManager(app);
            return manager.create(name);
        },
        migrate: function(app) {
            var manager = this.getManager(app);
            return manager.up().catch(function(e){debug(e.stack);});
        },
        rollback: function(app) {
            var manager = this.getManager(app);
            return manager.down(1);
        },
        seed: function(app) {
            return new Promise(function(resolve, reject){
                glob(require("path").resolve(app._basePath, "db/seed/*.js"), function(er, files) {
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
                        debug("loading", promises[i]);
                        promises[i].then(function(){
                            next(i+1);
                        }).catch(function(e){
                            debug("Failed to seed", e, e.stack);
                            reject();
                        });
                    }
                    next(0);
                });
            });
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
                debug("failed to create orientose", e, e.stack);
                throw e;
            }

        }
    };
    return obj;
};
