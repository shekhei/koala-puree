
var debug = require("debug")("koala-puree:mdns"),
    mdns = require("mdns");

exports = module.exports = function(){
    function advertise(self) {
        if ( self._ad ) { self._ad.stop(); }
        debug("Starting mdns middleware");
        debug(self._config);
        var adSettings = {
            name: self._config.name,
            txtRecord: {
                name: self._config.name, // cant put into subtype, it is too long
                version: self._config.version,
                nsp: self.ns || "/"
            }//,
            //flags: mdns.kDNSServiceFlagsForceMulticast // linux avahi-compat-dns_sd cannot have flags...
        };

          // TODO: consider if ad interface should be an array, else not, loopback would not work
        if ( self._config.mdns && self._config.mdns.ad ) {
            if (undefined !== self._config.mdns.ad.interface) {
                if ( self._config.mdns.ad.interface === "lo") {
                    adSettings.networkInterface = mdns.loopbackInterface();
                    adSettings.host = "localhost";
                } else {
                    adSettings.networkInterface = self._config.mdns.ad.interface;
                }
            }
            if (self._config.mdns.ad.domain) {
                adSettings.domain = self._config.mdns.ad.domain;
            }
        }
        debug(adSettings);
        function handleError(e){
            debug(e,e.stack);
        }

        debug(`beginning advertisement ${adSettings}`);
        var port =   self._server.address().port;
        self._ad = new mdns.Advertisement(mdns.makeServiceType({name:"koala-puree", protocol:"tcp"}), port, adSettings, function(err, service){
            debug(`service registered: ${err} ${service.name}`);
        });
        self._ad.on("error", handleError);
        debug(`starting advertisement ${adSettings}`);
        self._ad.start();

    }
    return {
        setup: function*(next) {

            var self = this;
            if ( !self._forConsole ) {
                self.on("listening", function(){
                    self.on("namespace", function(){
                        advertise(self);
                    });
                    advertise(self);
                });
            }
            yield* next;
        },
        teardown: function*(next) {
            var self = this;
            yield new Promise(function(resolve/*, reject*/){
                if ( self._forConsole) {
                    return resolve();
                }
                self._ad.stop();
                debug("closing mdns middleware");
                resolve();
            });
            yield* next;
        }
    };
};
