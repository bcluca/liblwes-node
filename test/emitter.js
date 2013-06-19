var Emitter = require('../liblwes').Emitter;

var emitter = new Emitter('127.0.0.1', 1111, 'data/sample.esf');

emitter.emit({
  'type': 'UserLogin'
});
