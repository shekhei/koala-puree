var TestApp = require('../TestApp');
var app = new TestApp();
var bench = Benchmark({
    setup: function() {
        app.start()
    }
})
