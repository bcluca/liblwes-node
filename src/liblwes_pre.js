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

  var emitterIndex = emitters.push(this) - 1,
      esfFile      = emitterIndex +'.esf'
  ;
  FS.createLazyFile('/', esfFile, esf, true, false);

  this.db = Module.ccall('lwes_event_type_db_create', 'number', ['string'], [esfFile]);
  this.emitter = Module.ccall('lwes_emitter_create', 'number',
    ['string', 'string', 'number', 'number',  'number', 'number'],
    [address,  iface,    port,     heartbeat, freq,     emitterIndex]
  );
};

Emitter.prototype = (function () {

  var TYPE_SUFFIX = {
    1   : 'U_INT_16',           // 2 byte unsigned integer type
    2   : 'INT_16',             // 2 byte signed integer type type
    3   : 'U_INT_32',           // 4 byte unsigned integer type
    4   : 'INT_32',             // 4 byte signed integer type
    5   : 'STRING',             // variable bytes string type
    6   : 'IP_ADDR_w_string',   // 4 byte ipv4 address type
    7   : 'INT_64_w_string',    // 8 byte signed integer type
    8   : 'U_INT_64_w_string',  // 8 byte unsigned integer type
    9   : 'BOOLEAN',            // 1 byte boolean type
    255 : 'UNDEFINED'           // undefined type
  };

  var buildEvent = function (obj, db) {
    var evt   = Module.ccall('lwes_event_create', 'number', ['number', 'string'], [db, obj['type']]),
        attrs = obj['attributes']
    ;

    // Build event attributes, inferring the types by looking up the attributes in the type db
    for (var attrName in attrs) {
      var attrType = Module.ccall('lwes_event_type_db_get_attr_type', 'number',
        ['number', 'string', 'string'],
        [db,       attrName, obj['type']]
      );
      if ([0, 255].indexOf(attrType) !== -1) {
        console.log("Warning: Event attribute '"+ obj['type'] +'::'+ attrName +"' has an undefined type");
      } else {
        var valueType = 'number',
            suffix    = TYPE_SUFFIX[attrType]
        ;
        if (suffix.toLowerCase().indexOf('string') !== -1) {
          valueType = 'string';
        }
        Module.ccall('lwes_event_set_'+ suffix, 'number',
          ['number', 'string', valueType],
          [evt,      attrName, attrs[attrName]]
        );
      }
    }

    return evt;
  };

  return {

    constructor : Emitter,

    isClosed : function () {
      return this.emitter === null || this.db === null;
    },

    emit : function (obj) {
      if (this.isClosed()) return -1;

      var evt = buildEvent(obj, this.db);
      Module.ccall('lwes_emitter_emit', 'number', ['number', 'number'], [this.emitter, evt]);
      Module.ccall('lwes_event_destroy', 'number', ['number'], [evt]);

      return 0;
    },

    close : function () {
      if (this.isClosed()) return -1;

      Module.ccall('lwes_event_type_db_destroy', 'number', ['number'], [this.db]);
      this.db = null;
      Module.ccall('lwes_emitter_destroy', 'number', ['number'], [this.emitter]);
      this.emitter = null;

      return 0;
    }

  };

})();

Emitter.closeAll = function () {

  emitters.forEach(function (e) {
    if (!e.isClosed()) {
      e.close();
    }
  });

};
