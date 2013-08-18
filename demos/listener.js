var Listener = require('../liblwes').Listener;

var listener = new Listener('127.0.0.1', 1111);

// Listen to all events
listener.on('*', function (lwesEvent) {
  console.log(lwesEvent);
});

// Listen to specific events
listener.on('FooBar', function (lwesEvent) {
  console.log('=> Specific event: ' + lwesEvent.type);
});
