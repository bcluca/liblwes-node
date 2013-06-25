var dgram    = require('dgram'),
    emitters = [],
    LWES     = {
      'createTypeDB'   : Module.cwrap('lwes_event_type_db_create', 'number', ['string']),
      'createEmitter'  : Module.cwrap('lwes_emitter_create', 'number', ['string', 'string', 'number', 'number',  'number', 'number']),
      'createEvent'    : Module.cwrap('lwes_event_create', 'number', ['number', 'string']),
      'getAttrType'    : Module.cwrap('lwes_event_type_db_get_attr_type', 'number', ['number', 'string', 'string']),
      'emitEvent'      : Module.cwrap('lwes_emitter_emit', 'number', ['number', 'number']),
      'destroyEvent'   : Module.cwrap('lwes_event_destroy', 'number', ['number']),
      'destroyTypeDB'  : Module.cwrap('lwes_event_type_db_destroy', 'number', ['number']),
      'destroyEmitter' : Module.cwrap('lwes_emitter_destroy', 'number', ['number']),
      'setUInt16Attr'  : Module.cwrap('lwes_event_set_U_INT_16', 'number', ['number', 'string', 'number']),
      'setInt16Attr'   : Module.cwrap('lwes_event_set_INT_16', 'number', ['number', 'string', 'number']),
      'setUInt32Attr'  : Module.cwrap('lwes_event_set_U_INT_32', 'number', ['number', 'string', 'number']),
      'setInt32Attr'   : Module.cwrap('lwes_event_set_INT_32', 'number', ['number', 'string', 'number']),
      'setStringAttr'  : Module.cwrap('lwes_event_set_STRING', 'number', ['number', 'string', 'string']),
      'setIPAddrAttr'  : Module.cwrap('lwes_event_set_IP_ADDR_w_string', 'number', ['number', 'string', 'string']),
      'setInt64Attr'   : Module.cwrap('lwes_event_set_INT_64_w_string', 'number', ['number', 'string', 'string']),
      'setUInt64Attr'  : Module.cwrap('lwes_event_set_U_INT_64_w_string', 'number', ['number', 'string', 'string']),
      'setBooleanAttr' : Module.cwrap('lwes_event_set_BOOLEAN', 'number', ['number', 'string', 'number'])
    },
    Util = {
      'extend' : function (dest, src) {
        for (var prop in src) {
            if (src.hasOwnProperty(prop)) {
                dest[prop] = src[prop];
            }
        }
        return dest;
      }
    }
;

var Emitter = function (options) {

  var opts = Util.extend({}, Emitter.DEFAULTS);
  Util.extend(opts, options);

  if (opts.esf === null) {
    throw new Error("Missing 'esf' option");
  }

  this.address = opts.address;
  this.port    = opts.port;
  this.socket  = dgram.createSocket('udp4');

  this.socket.unref();

  var emitterIndex  = emitters.push(this) - 1,
      esfFile       = emitterIndex +'.esf',
      hasHeartbeat  = !!opts.heartbeat,
      heartbeatFreq = hasHeartbeat ? opts.heartbeat : 0
  ;

  FS.createLazyFile('/', esfFile, opts.esf, true, false);

  this.db      = LWES.createTypeDB(esfFile);
  this.emitter = LWES.createEmitter(opts.address, opts.iface, opts.port, hasHeartbeat, heartbeatFreq, emitterIndex);
};

Emitter.prototype = (function () {

  var ATTR_TYPES = {
    1   : 'UInt16',     // 2 byte unsigned integer type
    2   : 'Int16',      // 2 byte signed integer type type
    3   : 'UInt32',     // 4 byte unsigned integer type
    4   : 'Int32',      // 4 byte signed integer type
    5   : 'String',     // variable bytes string type
    6   : 'IPAddr',     // 4 byte ipv4 address type
    7   : 'Int64',      // 8 byte signed integer type
    8   : 'UInt64',     // 8 byte unsigned integer type
    9   : 'Boolean'     // 1 byte boolean type
  };

  var buildEvent = function (obj, db) {
    var evt   = LWES.createEvent(db, obj['type']),
        attrs = obj['attributes']
    ;

    // Build event attributes, inferring the types by looking up the attributes in the type db
    for (var attrName in attrs) {
      var attrType = LWES.getAttrType(db, attrName, obj['type']);
      if ([0, 255].indexOf(attrType) !== -1) {
        console.log("Warning: Event attribute '"+ obj['type'] +'::'+ attrName +"' has an undefined type");
      } else {
        LWES['set'+ ATTR_TYPES[attrType] +'Attr'](evt, attrName, attrs[attrName]);
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
      LWES.emitEvent(this.emitter, evt);
      LWES.destroyEvent(evt);

      return 0;
    },

    close : function () {
      if (this.isClosed()) return -1;

      LWES.destroyTypeDB(this.db);
      this.db = null;
      LWES.destroyEmitter(this.emitter);
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

Emitter.DEFAULTS = {
  'address'   : '127.0.0.1',
  'port'      : 1111,
  'esf'       : null,
  'heartbeat' : false,
  'iface'     : null
};

// Export interface
module.exports = {
  'Emitter' : Emitter
};
