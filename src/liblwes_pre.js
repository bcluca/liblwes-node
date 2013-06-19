var dgram = require('dgram');

var emitters = [];

var Emitter = function (address, port, esf, heartbeat, freq, iface) {

  this.address = address;
  this.port    = port;
  this.socket  = dgram.createSocket('udp4');

  this.socket.unref();

  // Defaults
  freq      = typeof freq      !== 'undefined' ? freq      : 60;
  iface     = typeof iface     !== 'undefined' ? iface     : null;
  heartbeat = typeof heartbeat !== 'undefined' ? heartbeat : false;

  var emitterIndex = emitters.push(this) - 1;

  this.db = Module.ccall('lwes_event_type_db_create', 'number', ['string'], [esf]);
  this.emitter = Module.ccall('lwes_emitter_create', 'number',
    ['string', 'string', 'number', 'number',  'number', 'number'],
    [address,  iface,    port,     heartbeat, freq,     emitterIndex])
  ;
};

Emitter.prototype = (function () {

  var buildEvent = function (obj, db) {
    var evt = Module.ccall('lwes_event_create', 'number', ['number', 'string'], [db, obj['type']]);

    // TODO: build event attributes, e.g.:
    // Module.ccall('lwes_event_set_STRING', 'number', ['number', 'string', 'string'], [evt, 'username', 'bob']);

    return evt;
  };

  return {

    constructor : Emitter,

    emit : function (obj) {

      var evt = buildEvent(obj, this.db);
      Module.ccall('lwes_emitter_emit', 'number', ['number', 'number'], [this.emitter, evt]);
      Module.ccall('lwes_event_destroy', 'number', ['number'], [evt]);

    }

  };

})();
