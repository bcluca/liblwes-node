var Emitter = require('../liblwes').Emitter;

var emitter = new Emitter('127.0.0.1', 1111, 'data/sample.esf');

emitter.emit({
  'type'       : 'FooBar',
  'attributes' : {
    'fooStr'   : 'bar',
    'foo16'    : 42,
    'fooU16'   : 42,
    'foo32'    : 42,
    'fooU32'   : 42,
    'foo64'    : 42,
    'fooU64'   : 42,
    'fooBool'  : true,
    'fooIP'    : '127.0.0.1'
  }
});
