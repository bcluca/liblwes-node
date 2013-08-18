liblwes-node
============

Node.js port of the LWES (Light Weight Event System) library. Compiled from C to Javascript using Emscripten + asm.js and wrapped in a Javascript API which abstracts the low-level internals.

Installation
------------

`$ npm install liblwes`

Usage
-----

### Emitter

```javascript
var Emitter = require('liblwes').Emitter;

// Example of emitter with ESF validation and type inference
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

// Example of emitter with ESF validation and no type inference
var emitter2 = new Emitter({ 'esf' : __dirname +'/data/sample.esf' });

emitter2.emit({
  'type'       : 'FooBar',
  'attributes' : {
    'fooStr'   : 'Hello',                 // Type spec not needed for String attributes
    'fooBool'  : true,                    // Type spec not needed for Boolean attributes
    'foo32'    : [78427, 'Int32'],        // Other attribute types do need a type spec
    'fooIP'    : ['127.0.0.1', 'IPAddr'],
    'fooU64'   : ['fff87fde', 'UInt64']
  }
});


// Example of emitter with no ESF validation and no type inference
var emitter3 = new Emitter();

emitter3.emit({
  'type'       : 'Whatever',
  'attributes' : {
    'foo'      : 'Hello',                 // Type spec not needed for String attributes
    'bar'      : true,                    // Type spec not needed for Boolean attributes
    'baz'      : [78427, 'Int32'],        // Other attribute types do need a type spec
    'blegga'   : ['127.0.0.1', 'IPAddr'],
    'asdasd'   : ['fff87fde', 'UInt64']
  }
});
```

The type of each event attribute can be defined in an ESF file, e.g. `sample.esf`:

```
FooBar                  # Sample LWES event
{
  string   fooStr;      # Sample string attribute
  int16    foo16;       # Sample 16-bit integer attribute
  uint16   fooU16;      # Sample 16-bit unsigned integer attribute
  int32    foo32;       # Sample 32-bit integer attribute
  uint32   fooU32;      # Sample 32-bit unsigned integer attribute
  int64    foo64;       # Sample 64-bit integer attribute
  uint64   fooU64;      # Sample 64-bit unsigned integer attribute
  boolean  fooBool;     # Sample boolean attribute
  ip_addr  fooIP;       # Sample IP address attribute
}
```

For more details on the LWES protocol and the ESF specification, please see the LWES documentation at [lwes.org](http://www.lwes.org) or their github page at [github.com/lwes](http://github.com/lwes).

### Listener

```
var Listener = require('liblwes').Listener;

var listener = new Listener('127.0.0.1', 1111);

// Listen to all events
listener.on('*', function (lwesEvent) {
  console.log(lwesEvent);
});

// Listen to specific events
listener.on('FooBar', function (lwesEvent) {
  console.log('=> Specific event: ' + lwesEvent.type);
});
```

Note: 64-bit integers are returned as strings.

API documentation
-----------------

### Emitter

The constructor of the `Emitter` class accepts the following options:

Name | Description
--- | ---
`address`   | The destination IP address (`'127.0.0.1`' by default).
`port`      | The destination port (`1111` by default).
`esf`       | Path to the ESF (Event Specification Format) file (e.g. `'data/sample.esf'`).
`heartbeat` | Heartbeat frequency, e.g. `60`. Disabled (`false`) by default.
`iface`     | The network interface (all local interfaces by default).

The following attribute types can be used in the event object passed to the `emit` function:

Type | Description
--- | ---
`UInt16`  | 16-bit unsigned integer
`Int16`   | 16-bit integer
`UInt32`  | 32-bit unsigned integer
`Int32`   | 32-bit integer
`String`  | String
`IPAddr`  | IP address
`Int64`   | 64-bit integer
`UInt64`  | 64-bit unsigned integer
`Boolean` | Boolean

Emitters can be closed individually with `emitter.close()` or globally with `Emitter.closeAll()`. This releases all resources allocated in the emscripten subsystem and fires a `System::Shutdown` event if the `heartbeat` is enabled.

### Listener

Listeners conform to Node's `EventEmitter` API, with the addition of wildcard events to support notifications on any LWES event:

```
listener.on('*', function (lwesEvent) {
  console.log(lwesEvent);
});
```

Listeners can be closed with the `close` method:

```
listener.close();
```

Compilation
-----------

You can recompile the `liblwes.js` library with emscripten by running `make`. The `emcc` binary must be in your `PATH`.

License
-------

Created by Luca Bernardo Ciddio for YP Intellectual Property, LLC (YellowPages.com) and licensed under the MIT License.
