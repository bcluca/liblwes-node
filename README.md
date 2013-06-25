liblwes-node
============

Node.js port of the LWES (Light Weight Event System) library. Compiled from C to Javascript using Emscripten + asm.js and wrapped in a Javascript API which abstract the low-level internals.

Installation
------------

`$ npm install liblwes`

Usage
-----

```javascript
var Emitter = require('liblwes').Emitter;

var emitter = new Emitter({
  'address' : '127.0.0.1',
  'port'    : 1111,
  'esf'     : 'data/sample.esf'
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

emitter.close();
```

The type of each event attribute is inferred from the type db, e.g. `sample.esf`:

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

This allows us to emit events defined as simple object literals.

The `options` for the constructor of the `Emitter` class are:

Name | Description
--- | ---
`address`   | The destination IP address ('127.0.0.1' by default).
`port`      | The destination port (`1111` by default).
`esf`       | Path to the ESF (Event Specification Format) file (e.g. `data/sample.esf`).
`heartbeat` | Heartbeat frequency, e.g. `60`. Disabled (`false`) by default.
`iface`     | The network interface (all local interfaces by default).

Emitters can be closed individually with `emitter.close()` or globally with `Emitter.closeAll()`. This releases all resources allocated in the emscripten subsystem and fires a `System::Shutdown` event if the `heartbeat` is enabled.

For more details on the LWES protocol and the ESF specification, please see the LWES documentation at [lwes.org](http://www.lwes.org) or their github page at [github.com/lwes](http://github.com/lwes).

Notes
-----

* The definition of a type db via an ESF file is currently mandatory
* The listener has not been ported yet

Compilation
-----------

You can recompile the `liblwes.js` library with emscripten by running `make`. The `emcc` binary must be in your `PATH`.

Tests
-----

There is a sample emitter in the `demos` directory. Real tests are coming soon.

License
-------

Created by Luca Bernardo Ciddio for YP Intellectual Property, LLC (yellowpages.com) and licensed under the MIT License.
