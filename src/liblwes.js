var dgram        = require('dgram'),
    fs           = require('fs'),
    util         = require('util'),
    EventEmitter = require('events').EventEmitter,
    emitters     = [],
    LWES         = {
      'createTypeDB'     : Module.cwrap('lwes_event_type_db_create', 'number', ['string']),
      'createEmitter'    : Module.cwrap('lwes_emitter_create', 'number', ['string', 'string', 'number', 'number',  'number', 'number']),
      'createEvent'      : Module.cwrap('lwes_event_create', 'number', ['number', 'string']),
      'createBlankEvent' : Module.cwrap('lwes_event_create_no_name', 'number', ['number']),
      'getAttrType'      : Module.cwrap('lwes_event_type_db_get_attr_type', 'number', ['number', 'string', 'string']),
      'emitEvent'        : Module.cwrap('lwes_emitter_emit', 'number', ['number', 'number']),
      'destroyEvent'     : Module.cwrap('lwes_event_destroy', 'number', ['number']),
      'destroyTypeDB'    : Module.cwrap('lwes_event_type_db_destroy', 'number', ['number']),
      'destroyEmitter'   : Module.cwrap('lwes_emitter_destroy', 'number', ['number']),
      'setUInt16Attr'    : Module.cwrap('lwes_event_set_U_INT_16', 'number', ['number', 'string', 'number']),
      'setInt16Attr'     : Module.cwrap('lwes_event_set_INT_16', 'number', ['number', 'string', 'number']),
      'setUInt32Attr'    : Module.cwrap('lwes_event_set_U_INT_32', 'number', ['number', 'string', 'number']),
      'setInt32Attr'     : Module.cwrap('lwes_event_set_INT_32', 'number', ['number', 'string', 'number']),
      'setStringAttr'    : Module.cwrap('lwes_event_set_STRING', 'number', ['number', 'string', 'string']),
      'setIPAddrAttr'    : Module.cwrap('lwes_event_set_IP_ADDR_w_string', 'number', ['number', 'string', 'string']),
      'setInt64Attr'     : Module.cwrap('lwes_event_set_INT_64_w_string', 'number', ['number', 'string', 'string']),
      'setUInt64Attr'    : Module.cwrap('lwes_event_set_U_INT_64_w_string', 'number', ['number', 'string', 'string']),
      'setBooleanAttr'   : Module.cwrap('lwes_event_set_BOOLEAN', 'number', ['number', 'string', 'number']),
      'eventFromBytes'   : Module.cwrap('lwes_event_from_bytes', 'number', ['number', 'number', 'number', 'number', 'number']),
      'eventToJSON'      : Module.cwrap('lwes_event_to_json', 'string', ['number', 'number'])
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

  if (opts.esf !== null && !fs.existsSync(opts.esf)) {
    throw new Error("Cannot locate ESF file '"+ opts.esf +"'");
  }

  this.address = opts.address;
  this.port    = opts.port;
  this.socket  = dgram.createSocket('udp4');

  this.socket.unref();

  var emitterIndex  = emitters.push(this) - 1,
      esfFileName   = emitterIndex +'.esf',
      hasHeartbeat  = !!opts.heartbeat,
      heartbeatFreq = hasHeartbeat ? opts.heartbeat : 0
  ;

  if (opts.esf !== null) {
    FS.createLazyFile('/', esfFileName, opts.esf, true, false);
    this.db = LWES.createTypeDB(esfFileName);
  }
  this.emitter = LWES.createEmitter(opts.address, opts.iface, opts.port, hasHeartbeat, heartbeatFreq, emitterIndex);
};

Emitter.prototype = (function () {

  var ATTR_TYPES = [
    'Unknown',
    'UInt16',      // 2 byte unsigned integer type
    'Int16',       // 2 byte signed integer type type
    'UInt32',      // 4 byte unsigned integer type
    'Int32',       // 4 byte signed integer type
    'String',      // variable bytes string type
    'IPAddr',      // 4 byte ipv4 address type
    'Int64',       // 8 byte signed integer type
    'UInt64',      // 8 byte unsigned integer type
    'Boolean'      // 1 byte boolean type
  ];

  var buildEvent = function (obj, db) {
    var evt   = LWES.createEvent(db, obj['type']),
        attrs = obj['attributes']
    ;
    // Build event attributes
    for (var attrName in attrs) {
      var attrValue = attrs[attrName],
          attrType  = null
      ;
      switch (typeof attrValue) {
        // Get the type from the attributes object if present
        case 'object':
          attrType  = ATTR_TYPES.indexOf(attrValue[1]);
          attrValue = attrValue[0];
          break;
        // Map to Boolean if native boolean
        case 'boolean':
          attrType = 9;  // Boolean
          break;
        default:
          if (typeof db === 'undefined' || db === null) {
            attrType  = 5; // String
            attrValue = attrValue.toString();
          } else {
            // Infer the attribute type by looking up the attribute in the type db
            attrType = LWES.getAttrType(db, attrName, obj['type']);
          }
      }
      if ([0, 255].indexOf(attrType) !== -1) {
        console.log("Warning: Event attribute '"+ obj['type'] +'::'+ attrName +"' has an undefined type");
      } else {
        LWES['set'+ ATTR_TYPES[attrType] +'Attr'](evt, attrName, attrValue);
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

var Listener = function (address, port) {
  var self     = this,
      BUF_SIZE = 131072
  ;

  this.address  = address;
  this.port     = port;
  this.socket   = dgram.createSocket('udp4');

  this.socket.on('message', function (message, info) {

    var evt    = LWES.createBlankEvent(null),
        bytes  = Module._malloc(message.length),
        buffer = Module._malloc(BUF_SIZE)
    ;

    Module.HEAPU8.set(message, bytes);
    LWES.eventFromBytes(evt, bytes, message.length, 0, buffer);
    Module._free(bytes);

    var serializedEvent = LWES.eventToJSON(evt, buffer);
    var lwesEvent = JSON.parse(serializedEvent);

    self.emit('*', lwesEvent);
    self.emit(lwesEvent.type, lwesEvent);

    Module._free(buffer);
    LWES.destroyEvent(evt);

  }).bind(port, address);

  if (address !== '0.0.0.0' && address !== '127.0.0.1') {
    this.socket.addMembership(address);
  }
};

util.inherits(Listener, EventEmitter);

Listener.prototype.close = function () {
  this.socket.close();
};

// Export interface
module.exports = {
  'Emitter' : Emitter,
  'Listener' : Listener
};
