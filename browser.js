var mdns = require('mdns');

mDnsBrowser = mdns.browseThemAll();

mDnsBrowser.on('serviceUp', function(){
	console.log(arguments);
})

mDnsBrowser.on('serviceChanged', function(){
	console.log("changed");
	console.log(arguments);
})

mDnsBrowser.start();
