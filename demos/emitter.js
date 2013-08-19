var Emitter = require('../liblwes').Emitter;

// Example of emitter with validation and type inference
var emitter = new Emitter({
  'address' : '127.0.0.1',
  'port'    : 1111,
  'esf'     : __dirname +'/data/sample.esf'
});

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

// Example of emitter with validation and no type inference
var emitter2 = new Emitter({ 'esf' : __dirname +'/data/sample.esf' });

emitter2.emit({
  'type'       : 'FooBar',
  'attributes' : {
    'fooStr'   : "Hello\nWorld",          // Type spec not needed for String attributes
    'fooBool'  : true,                    // Type spec not needed for Boolean attributes
    'foo32'    : [78427, 'Int32'],        // Other attribute types do need a type spec
    'fooIP'    : ['127.0.0.1', 'IPAddr'],
    'fooU64'   : ['fff87fde', 'UInt64']
  }
});

// Example of emitter with no validation and no type inference
var emitter3 = new Emitter();

emitter3.emit({
  'type'       : 'Whatever',
  'attributes' : {
    'foo'      : '{"a":1}',               // Type spec not needed for String attributes
    'bar'      : true,                    // Type spec not needed for Boolean attributes
    'baz'      : [78427, 'Int32'],        // Other attribute types do need a type spec
    'blegga'   : ['127.0.0.1', 'IPAddr'],
    'asdasd'   : ['fff87fde', 'UInt64']
  }
});
