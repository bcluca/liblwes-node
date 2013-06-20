var Emitter = require('../liblwes').Emitter;

var emitter = new Emitter('127.0.0.1', 1111, 'data/sample.esf');

emitter.emit({
  'type'       : 'FooBar',
  'attributes' : {
    'fooStr'   : 'bar',
    'foo16'    : -32768,
    'fooU16'   : 65535,
    'foo32'    : 2147483647,
    'fooU32'   : 4294967295,
    'foo64'    : '7fffffffffffffff', // 9223372036854775807 decimal
    'fooU64'   : 'ffffffffffffffff', // 18446744073709551615 decimal
    'fooBool'  : true,
    'fooIP'    : '127.0.0.1'
  }
});
