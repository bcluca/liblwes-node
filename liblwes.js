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
    emit : function (obj) {
      var evt = buildEvent(obj, this.db);
      Module.ccall('lwes_emitter_emit', 'number', ['number', 'number'], [this.emitter, evt]);
      Module.ccall('lwes_event_destroy', 'number', ['number'], [evt]);
    }
  };
})();
// Note: For maximum-speed code, see "Optimizing Code" on the Emscripten wiki, https://github.com/kripken/emscripten/wiki/Optimizing-Code
// Note: Some Emscripten settings may limit the speed of the generated code.
try {
  this['Module'] = Module;
  Module.test;
} catch(e) {
  this['Module'] = Module = {};
}
// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (typeof module === "object") {
  module.exports = Module;
}
if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  Module['print'] = function(x) {
    process['stdout'].write(x + '\n');
  };
  Module['printErr'] = function(x) {
    process['stderr'].write(x + '\n');
  };
  var nodeFS = require('fs');
  var nodePath = require('path');
  Module['read'] = function(filename, binary) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };
  Module['readBinary'] = function(filename) { return Module['read'](filename, true) };
  Module['load'] = function(f) {
    globalEval(read(f));
  };
  if (!Module['arguments']) {
    Module['arguments'] = process['argv'].slice(2);
  }
}
if (ENVIRONMENT_IS_SHELL) {
  Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm
  Module['read'] = read;
  Module['readBinary'] = function(f) {
    return read(f, 'binary');
  };
  if (!Module['arguments']) {
    if (typeof scriptArgs != 'undefined') {
      Module['arguments'] = scriptArgs;
    } else if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
  }
}
if (ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER) {
  if (!Module['print']) {
    Module['print'] = function(x) {
      console.log(x);
    };
  }
  if (!Module['printErr']) {
    Module['printErr'] = function(x) {
      console.log(x);
    };
  }
}
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };
  if (!Module['arguments']) {
    if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
  }
}
if (ENVIRONMENT_IS_WORKER) {
  // We can do very little here...
  var TRY_USE_DUMP = false;
  if (!Module['print']) {
    Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }
  Module['load'] = importScripts;
}
if (!ENVIRONMENT_IS_WORKER && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_SHELL) {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}
function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] == 'undefined' && Module['read']) {
  Module['load'] = function(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
// *** Environment setup code ***
// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];
// Callbacks
if (!Module['preRun']) Module['preRun'] = [];
if (!Module['postRun']) Module['postRun'] = [];
// === Auto-generated preamble library stuff ===
//========================================
// Runtime code shared with compiler
//========================================
var Runtime = {
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  forceAlign: function (target, quantum) {
    quantum = quantum || 4;
    if (quantum == 1) return target;
    if (isNumber(target) && isNumber(quantum)) {
      return Math.ceil(target/quantum)*quantum;
    } else if (isNumber(quantum) && isPowerOfTwo(quantum)) {
      var logg = log2(quantum);
      return '((((' +target + ')+' + (quantum-1) + ')>>' + logg + ')<<' + logg + ')';
    }
    return 'Math.ceil((' + target + ')/' + quantum + ')*' + quantum;
  },
  isNumberType: function (type) {
    return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES;
  },
  isPointerType: function isPointerType(type) {
  return type[type.length-1] == '*';
},
  isStructType: function isStructType(type) {
  if (isPointerType(type)) return false;
  if (isArrayType(type)) return true;
  if (/<?{ ?[^}]* ?}>?/.test(type)) return true; // { i32, i8 } etc. - anonymous struct types
  // See comment in isStructPointerType()
  return type[0] == '%';
},
  INT_TYPES: {"i1":0,"i8":0,"i16":0,"i32":0,"i64":0},
  FLOAT_TYPES: {"float":0,"double":0},
  or64: function (x, y) {
    var l = (x | 0) | (y | 0);
    var h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  and64: function (x, y) {
    var l = (x | 0) & (y | 0);
    var h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  xor64: function (x, y) {
    var l = (x | 0) ^ (y | 0);
    var h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  getNativeTypeSize: function (type, quantumSize) {
    if (Runtime.QUANTUM_SIZE == 1) return 1;
    var size = {
      '%i1': 1,
      '%i8': 1,
      '%i16': 2,
      '%i32': 4,
      '%i64': 8,
      "%float": 4,
      "%double": 8
    }['%'+type]; // add '%' since float and double confuse Closure compiler as keys, and also spidermonkey as a compiler will remove 's from '_i8' etc
    if (!size) {
      if (type.charAt(type.length-1) == '*') {
        size = Runtime.QUANTUM_SIZE; // A pointer
      } else if (type[0] == 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 == 0);
        size = bits/8;
      }
    }
    return size;
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  dedup: function dedup(items, ident) {
  var seen = {};
  if (ident) {
    return items.filter(function(item) {
      if (seen[item[ident]]) return false;
      seen[item[ident]] = true;
      return true;
    });
  } else {
    return items.filter(function(item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }
},
  set: function set() {
  var args = typeof arguments[0] === 'object' ? arguments[0] : arguments;
  var ret = {};
  for (var i = 0; i < args.length; i++) {
    ret[args[i]] = 0;
  }
  return ret;
},
  STACK_ALIGN: 8,
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (type == 'i64' || type == 'double' || vararg) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  calculateStructAlignment: function calculateStructAlignment(type) {
    type.flatSize = 0;
    type.alignSize = 0;
    var diffs = [];
    var prev = -1;
    type.flatIndexes = type.fields.map(function(field) {
      var size, alignSize;
      if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
        size = Runtime.getNativeTypeSize(field); // pack char; char; in structs, also char[X]s.
        alignSize = Runtime.getAlignSize(field, size);
      } else if (Runtime.isStructType(field)) {
        size = Types.types[field].flatSize;
        alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize);
      } else if (field[0] == 'b') {
        // bN, large number field, like a [N x i8]
        size = field.substr(1)|0;
        alignSize = 1;
      } else {
        throw 'Unclear type in struct: ' + field + ', in ' + type.name_ + ' :: ' + dump(Types.types[type.name_]);
      }
      if (type.packed) alignSize = 1;
      type.alignSize = Math.max(type.alignSize, alignSize);
      var curr = Runtime.alignMemory(type.flatSize, alignSize); // if necessary, place this on aligned memory
      type.flatSize = curr + size;
      if (prev >= 0) {
        diffs.push(curr-prev);
      }
      prev = curr;
      return curr;
    });
    type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize);
    if (diffs.length == 0) {
      type.flatFactor = type.flatSize;
    } else if (Runtime.dedup(diffs).length == 1) {
      type.flatFactor = diffs[0];
    }
    type.needsFlattening = (type.flatFactor != 1);
    return type.flatIndexes;
  },
  generateStructInfo: function (struct, typeName, offset) {
    var type, alignment;
    if (typeName) {
      offset = offset || 0;
      type = (typeof Types === 'undefined' ? Runtime.typeInfo : Types.types)[typeName];
      if (!type) return null;
      if (type.fields.length != struct.length) {
        printErr('Number of named fields must match the type for ' + typeName + ': possibly duplicate struct names. Cannot return structInfo');
        return null;
      }
      alignment = type.flatIndexes;
    } else {
      var type = { fields: struct.map(function(item) { return item[0] }) };
      alignment = Runtime.calculateStructAlignment(type);
    }
    var ret = {
      __size__: type.flatSize
    };
    if (typeName) {
      struct.forEach(function(item, i) {
        if (typeof item === 'string') {
          ret[item] = alignment[i] + offset;
        } else {
          // embedded struct
          var key;
          for (var k in item) key = k;
          ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i]);
        }
      });
    } else {
      struct.forEach(function(item, i) {
        ret[item[1]] = alignment[i];
      });
    }
    return ret;
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2 + 2*i;
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[func]) {
      Runtime.funcWrappers[func] = function() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return Runtime.funcWrappers[func];
  },
  UTF8Processor: function () {
    var buffer = [];
    var needed = 0;
    this.processCChar = function (code) {
      code = code & 0xff;
      if (needed) {
        buffer.push(code);
        needed--;
      }
      if (buffer.length == 0) {
        if (code < 128) return String.fromCharCode(code);
        buffer.push(code);
        if (code > 191 && code < 224) {
          needed = 1;
        } else {
          needed = 2;
        }
        return '';
      }
      if (needed > 0) return '';
      var c1 = buffer[0];
      var c2 = buffer[1];
      var c3 = buffer[2];
      var ret;
      if (c1 > 191 && c1 < 224) {
        ret = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
      } else {
        ret = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      }
      buffer.length = 0;
      return ret;
    }
    this.processJSString = function(string) {
      string = unescape(encodeURIComponent(string));
      var ret = [];
      for (var i = 0; i < string.length; i++) {
        ret.push(string.charCodeAt(i));
      }
      return ret;
    }
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = ((((STACKTOP)+7)>>3)<<3); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = ((((STATICTOP)+7)>>3)<<3); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = ((((DYNAMICTOP)+7)>>3)<<3); if (DYNAMICTOP >= TOTAL_MEMORY) enlargeMemory();; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 8))*(quantum ? quantum : 8); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+(((low)>>>(0))))+((+(((high)>>>(0))))*(+(4294967296)))) : ((+(((low)>>>(0))))+((+(((high)|(0))))*(+(4294967296))))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}
//========================================
// Runtime essentials
//========================================
var __THREW__ = 0; // Used in checking for thrown exceptions.
var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;
function abort(text) {
  Module.print(text + ':\n' + (new Error).stack);
  ABORT = true;
  throw "Assertion: " + text;
}
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}
var globalScope = this;
// C calling interface. A convenient way to call C functions (in C files, or
// defined with extern "C").
//
// Note: LLVM optimizations can inline and remove functions, after which you will not be
//       able to call them. Closure can also do so. To avoid that, add your function to
//       the exports using something like
//
//         -s EXPORTED_FUNCTIONS='["_main", "_myfunc"]'
//
// @param ident      The name of the C function (note that C++ functions will be name-mangled - use extern "C")
// @param returnType The return type of the function, one of the JS types 'number', 'string' or 'array' (use 'number' for any C pointer, and
//                   'array' for JavaScript arrays and typed arrays).
// @param argTypes   An array of the types of arguments for the function (if there are no arguments, this can be ommitted). Types are as in returnType,
//                   except that 'array' is not possible (there is no way for us to know the length of the array)
// @param args       An array of the arguments to the function, as native JS values (as in returnType)
//                   Note that string arguments will be stored on the stack (the JS string will become a C string on the stack).
// @return           The return value, as a native JS value (as in returnType)
function ccall(ident, returnType, argTypes, args) {
  return ccallFunc(getCFunc(ident), returnType, argTypes, args);
}
Module["ccall"] = ccall;
// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  try {
    var func = globalScope['Module']['_' + ident]; // closure exported function
    if (!func) func = eval('_' + ident); // explicit lookup
  } catch(e) {
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}
// Internal function that does a C call using a function, not an identifier
function ccallFunc(func, returnType, argTypes, args) {
  var stack = 0;
  function toC(value, type) {
    if (type == 'string') {
      if (value === null || value === undefined || value === 0) return 0; // null string
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length+1);
      writeStringToMemory(value, ret);
      return ret;
    } else if (type == 'array') {
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length);
      writeArrayToMemory(value, ret);
      return ret;
    }
    return value;
  }
  function fromC(value, type) {
    if (type == 'string') {
      return Pointer_stringify(value);
    }
    assert(type != 'array');
    return value;
  }
  var i = 0;
  var cArgs = args ? args.map(function(arg) {
    return toC(arg, argTypes[i++]);
  }) : [];
  var ret = fromC(func.apply(null, cArgs), returnType);
  if (stack) Runtime.stackRestore(stack);
  return ret;
}
// Returns a native JS wrapper for a C function. This is similar to ccall, but
// returns a function you can call repeatedly in a normal way. For example:
//
//   var my_function = cwrap('my_c_function', 'number', ['number', 'number']);
//   alert(my_function(5, 22));
//   alert(my_function(99, 12));
//
function cwrap(ident, returnType, argTypes) {
  var func = getCFunc(ident);
  return function() {
    return ccallFunc(func, returnType, argTypes, Array.prototype.slice.call(arguments));
  }
}
Module["cwrap"] = cwrap;
// Sets a value in memory in a dynamic way at run-time. Uses the
// type data. This is the same as makeSetValue, except that
// makeSetValue is done at compile-time and generates the needed
// code then, whereas this function picks the right code at
// run-time.
// Note that setValue and getValue only do *aligned* writes and reads!
// Note that ccall uses JS types as for defining types, while setValue and
// getValue need LLVM types ('i8', 'i32') - this is a lower-level operation
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[(ptr)]=value; break;
      case 'i8': HEAP8[(ptr)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,((Math.min((+(Math.floor((value)/(+(4294967296))))), (+(4294967295))))|0)>>>0],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module['setValue'] = setValue;
// Parallel to setValue.
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[(ptr)];
      case 'i8': return HEAP8[(ptr)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module['getValue'] = getValue;
var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module['ALLOC_NORMAL'] = ALLOC_NORMAL;
Module['ALLOC_STACK'] = ALLOC_STACK;
Module['ALLOC_STATIC'] = ALLOC_STATIC;
Module['ALLOC_DYNAMIC'] = ALLOC_DYNAMIC;
Module['ALLOC_NONE'] = ALLOC_NONE;
// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }
  var singleType = typeof types === 'string' ? types : null;
  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }
  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)|0)]=0;
    }
    return ret;
  }
  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }
  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];
    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later
    setValue(ret+i, curr, type);
    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }
  return ret;
}
Module['allocate'] = allocate;
function Pointer_stringify(ptr, /* optional */ length) {
  // Find the length, and check for UTF while doing so
  var hasUtf = false;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))|0)];
    if (t >= 128) hasUtf = true;
    else if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;
  var ret = '';
  if (!hasUtf) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  var utf8 = new Runtime.UTF8Processor();
  for (i = 0; i < length; i++) {
    t = HEAPU8[(((ptr)+(i))|0)];
    ret += utf8.processCChar(t);
  }
  return ret;
}
Module['Pointer_stringify'] = Pointer_stringify;
// Memory management
var PAGE_SIZE = 4096;
function alignMemoryPage(x) {
  return ((x+4095)>>12)<<12;
}
var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk
function enlargeMemory() {
  abort('Cannot enlarge memory arrays in asm.js. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value, or (2) set Module.TOTAL_MEMORY before the program runs.');
}
var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
var FAST_MEMORY = Module['FAST_MEMORY'] || 2097152;
// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(!!Int32Array && !!Float64Array && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'Cannot fallback to non-typed array case: Code is too specialized');
var buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);
// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');
Module['HEAP'] = HEAP;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;
function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}
var __ATINIT__ = []; // functions called during startup
var __ATMAIN__ = []; // functions called when main() is to be run
var __ATEXIT__ = []; // functions called during shutdown
var runtimeInitialized = false;
function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
}
// Tools
// This processes a JS string into a C-line array of numbers, 0-terminated.
// For LLVM-originating strings, see parser.js:parseLLVMString function
function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var ret = (new Runtime.UTF8Processor()).processJSString(stringy);
  if (length) {
    ret.length = length;
  }
  if (!dontAddNull) {
    ret.push(0);
  }
  return ret;
}
Module['intArrayFromString'] = intArrayFromString;
function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module['intArrayToString'] = intArrayToString;
// Write a Javascript array to somewhere in the heap
function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))|0)]=chr
    i = i + 1;
  }
}
Module['writeStringToMemory'] = writeStringToMemory;
function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[(((buffer)+(i))|0)]=array[i];
  }
}
Module['writeArrayToMemory'] = writeArrayToMemory;
function unSign(value, bits, ignore, sig) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore, sig) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}
if (!Math['imul']) Math['imul'] = function(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyTracking = {};
var calledInit = false, calledRun = false;
var runDependencyWatcher = null;
function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module['addRunDependency'] = addRunDependency;
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    } 
    // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
    if (!calledRun && shouldRunNow) run();
  }
}
Module['removeRunDependency'] = removeRunDependency;
Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data
function addPreRun(func) {
  if (!Module['preRun']) Module['preRun'] = [];
  else if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
  Module['preRun'].push(func);
}
var awaitingMemoryInitializer = false;
function loadMemoryInitializer(filename) {
  function applyData(data) {
    HEAPU8.set(data, STATIC_BASE);
    runPostSets();
  }
  // always do this asynchronously, to keep shell and web as similar as possible
  addPreRun(function() {
    if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
      applyData(Module['readBinary'](filename));
    } else {
      Browser.asyncLoad(filename, function(data) {
        applyData(data);
      }, function(data) {
        throw 'could not load memory initializer ' + filename;
      });
    }
  });
  awaitingMemoryInitializer = false;
}
// === Body ===
STATIC_BASE = 8;
STATICTOP = STATIC_BASE + 3808;
var _stdout;
var _stdin;
var _stderr;
var _stdout = _stdout=allocate([0,0,0,0,0,0,0,0], "i8", ALLOC_STATIC);
var _stdin = _stdin=allocate([0,0,0,0,0,0,0,0], "i8", ALLOC_STATIC);
var _stderr = _stderr=allocate([0,0,0,0,0,0,0,0], "i8", ALLOC_STATIC);
/* memory initializer */ allocate([0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,16,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,14,2,15,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,3,4,5,6,7,8,9,10,11,12,13,0,0,0,28,11,12,13,14,15,16,17,18,19,1,20,25,24,10,29,8,1,6,7,9,2,30,31,26,0,0,0,2,11,12,13,14,15,16,17,18,19,0,20,0,2,1,2,4,2,2,1,0,1,2,3,4,4,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,17,18,18,19,19,19,20,21,21,21,22,22,22,23,24,24,24,24,24,24,24,24,24,24,0,0,0,0,0,0,0,246,246,17,246,246,247,246,246,9,3,246,16,246,0,246,246,246,246,26,246,246,246,246,246,246,246,246,246,246,254,246,11,246,246,246,255,7,246,246,246,255,3,4,5,21,22,27,23,0,0,7,0,2,0,6,5,1,3,8,15,16,17,18,21,22,23,19,20,24,0,9,0,4,10,14,0,0,11,13,12,1,3,4,5,6,7,8,9,10,11,1,13,21,15,14,16,0,1,15,16,3,12,15,16,13,255,255,255,12,3,4,5,6,7,8,9,10,11,255,13,0,0,0,0,0,0,0,0,0,0,4,0,5,0,6,0,16,0,28,0,51,0,29,0,51,0,30,0,8,0,51,0,40,0,9,0,41,0,51,0,42,0,10,0,51,0,18,0,51,0,19,0,50,0,11,0,49,0,12,0,13,0,14,0,4,0,5,0,6,0,48,0,47,0,46,0,45,0,44,0,43,0,8,0,39,0,38,0,9,0,37,0,36,0,35,0,10,0,34,0,33,0,32,0,31,0,27,0,11,0,26,0,12,0,13,0,14,0,7,0,7,0,7,0,15,0,25,0,15,0,24,0,23,0,22,0,21,0,20,0,17,0,51,0,3,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,1,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,3,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,4,0,0,0,9,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,10,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,11,0,0,0,1,0,0,0,12,0,0,0,13,0,0,0,4,0,0,0,14,0,0,0,15,0,0,0,4,0,0,0,16,0,0,0,4,0,0,0,17,0,0,0,4,0,0,0,4,0,0,0,18,0,0,0,4,0,0,0,19,0,0,0,20,0,0,0,21,0,0,0,4,0,0,0,22,0,0,0,23,0,0,0,24,0,0,0,25,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,26,0,0,0,1,0,0,0,27,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,52,0,52,0,51,0,51,0,51,0,53,0,54,0,51,0,54,0,54,0,54,0,54,0,51,0,51,0,53,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,54,0,0,0,51,0,51,0,51,0,0,0,0,0,1,0,1,0,1,0,54,0,23,0,0,0,23,0,0,0,23,0,1,0,0,0,33,0,1,0,33,0,0,0,33,0,1,0,0,0,10,0,0,0,10,0,44,0,1,0,43,0,1,0,1,0,1,0,2,0,2,0,2,0,42,0,41,0,40,0,39,0,38,0,34,0,2,0,32,0,31,0,2,0,30,0,29,0,28,0,2,0,27,0,26,0,25,0,24,0,22,0,2,0,21,0,2,0,2,0,2,0,52,0,52,0,52,0,53,0,20,0,53,0,19,0,18,0,17,0,12,0,11,0,9,0,3,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,51,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,27,0,67,0,68,0,68,0,0,0,0,0,68,0,46,0,0,0,41,0,47,0,68,0,68,0,0,0,0,0,43,0,38,0,50,0,37,0,32,0,31,0,0,0,36,0,30,0,22,0,30,0,34,0,36,0,33,0,25,0,19,0,7,0,24,0,0,0,0,0,0,0,21,0,18,0,24,0,26,0,23,0,5,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,68,0,54,0,57,0,1,0,0,0,0,0,0,0,0,0,18,0,16,0,1,0,15,0,11,0,14,0,11,0,11,0,11,0,11,0,12,0,13,0,15,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,3,0,5,0,8,0,11,0,11,0,11,0,11,0,11,0,11,0,11,0,6,0,2,0,4,0,9,0,10,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,98,111,111,108,101,97,110,0,105,110,112,117,116,32,105,110,32,102,108,101,120,32,115,99,97,110,110,101,114,32,102,97,105,108,101,100,0,0,0,0,115,121,110,116,97,120,32,101,114,114,111,114,0,0,0,0,117,105,110,116,54,52,0,0,102,97,116,97,108,32,101,114,114,111,114,32,45,32,115,99,97,110,110,101,114,32,105,110,112,117,116,32,98,117,102,102,101,114,32,111,118,101,114,102,108,111,119,0,0,0,0,0,117,110,107,110,111,119,110,32,116,121,112,101,32,39,37,115,39,0,0,0,0,0,0,0,105,110,116,54,52,0,0,0,102,97,116,97,108,32,102,108,101,120,32,115,99,97,110,110,101,114,32,105,110,116,101,114,110,97,108,32,101,114,114,111,114,45,45,101,110,100,32,111,102,32,98,117,102,102,101,114,32,109,105,115,115,101,100,0,102,97,116,97,108,32,102,108,101,120,32,115,99,97,110,110,101,114,32,105,110,116,101,114,110,97,108,32,101,114,114,111,114,45,45,110,111,32,97,99,116,105,111,110,32,102,111,117,110,100,0,0,0,0,0,0,109,97,108,108,111,99,32,112,114,111,98,108,101,109,32,102,111,114,32,116,121,112,101,32,39,37,115,39,0,0,0,0,105,112,95,97,100,100,114,0,111,117,116,32,111,102,32,100,121,110,97,109,105,99,32,109,101,109,111,114,121,32,105,110,32,108,119,101,115,101,110,115,117,114,101,95,98,117,102,102,101,114,95,115,116,97,99,107,40,41,0,0,0,0,0,0,83,121,115,116,101,109,58,58,72,101,97,114,116,98,101,97,116,0,0,0,0,0,0,0,66,97,100,32,39,116,121,112,101,39,32,39,97,116,116,114,105,98,117,116,101,110,97,109,101,39,32,112,97,105,114,0,115,116,114,105,110,103,0,0,116,111,116,97,108,0,0,0,68,105,100,32,121,111,117,32,102,111,114,103,101,116,32,97,32,115,101,109,105,45,99,111,108,111,110,63,0,0,0,0,105,110,116,51,50,0,0,0,99,111,117,110,116,0,0,0,68,105,100,32,121,111,117,32,102,111,114,103,101,116,32,97,32,39,59,39,63,0,0,0,117,105,110,116,51,50,0,0,115,101,113,0,0,0,0,0,101,110,99,0,0,0,0,0,37,115,10,0,0,0,0,0,109,97,108,108,111,99,32,112,114,111,98,108,101,109,32,102,111,114,32,101,118,101,110,116,110,97,109,101,32,39,37,115,39,0,0,0,0,0,0,0,105,110,116,49,54,0,0,0,102,114,101,113,0,0,0,0,111,117,116,32,111,102,32,100,121,110,97,109,105,99,32,109,101,109,111,114,121,32,105,110,32,108,119,101,115,95,99,114,101,97,116,101,95,98,117,102,102,101,114,40,41,0,0,0,69,82,82,79,82,32,58,32,37,115,32,58,32,108,105,110,101,32,37,100,10,0,0,0,69,82,82,79,82,58,32,78,111,32,115,117,99,104,32,102,105,108,101,32,58,32,34,37,115,34,10,0,0,0,0,0,112,97,114,115,101,114,32,101,114,114,111,114,32,119,105,116,104,32,39,59,39,0,0,0,114,0,0,0,0,0,0,0,112,97,114,115,101,114,32,101,114,114,111,114,32,119,105,116,104,32,39,125,39,0,0,0,117,105,110,116,49,54,0,0,109,101,109,111,114,121,32,101,120,104,97,117,115,116,101,100,0,0,0,0,0,0,0,0,77,101,116,97,69,118,101,110,116,73,110,102,111,0,0,0,111,117,116,32,111,102,32,100,121,110,97,109,105,99,32,109,101,109,111,114,121,32,105,110,32,121,121,95,103,101,116,95,110,101,120,116,95,98,117,102,102,101,114,40,41,0,0,0,83,121,115,116,101,109,58,58,83,116,97,114,116,117,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE)
function runPostSets() {
}
if (!awaitingMemoryInitializer) runPostSets();
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
assert(tempDoublePtr % 8 == 0);
function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
}
function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];
  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];
  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];
  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];
}
  function _time(ptr) {
      var ret = Math.floor(Date.now()/1000);
      if (ptr) {
        HEAP32[((ptr)>>2)]=ret
      }
      return ret;
    }
  function _js_send_bytes(emitterIndex, buf, len) {
      var data    = HEAPU8.slice(buf, buf + len),
          payload = new Buffer(data),
          emitter = emitters[emitterIndex]
      ;
      emitter.socket.send(payload, 0, len, emitter.port, emitter.address, function () {});
      return 0;
    }
  Module["_js_send_bytes"] = _js_send_bytes;
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:35,EIDRM:36,ECHRNG:37,EL2NSYNC:38,EL3HLT:39,EL3RST:40,ELNRNG:41,EUNATCH:42,ENOCSI:43,EL2HLT:44,EDEADLK:45,ENOLCK:46,EBADE:50,EBADR:51,EXFULL:52,ENOANO:53,EBADRQC:54,EBADSLT:55,EDEADLOCK:56,EBFONT:57,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:74,ELBIN:75,EDOTDOT:76,EBADMSG:77,EFTYPE:79,ENOTUNIQ:80,EBADFD:81,EREMCHG:82,ELIBACC:83,ELIBBAD:84,ELIBSCN:85,ELIBMAX:86,ELIBEXEC:87,ENOSYS:88,ENMFILE:89,ENOTEMPTY:90,ENAMETOOLONG:91,ELOOP:92,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:106,EPROTOTYPE:107,ENOTSOCK:108,ENOPROTOOPT:109,ESHUTDOWN:110,ECONNREFUSED:111,EADDRINUSE:112,ECONNABORTED:113,ENETUNREACH:114,ENETDOWN:115,ETIMEDOUT:116,EHOSTDOWN:117,EHOSTUNREACH:118,EINPROGRESS:119,EALREADY:120,EDESTADDRREQ:121,EMSGSIZE:122,EPROTONOSUPPORT:123,ESOCKTNOSUPPORT:124,EADDRNOTAVAIL:125,ENETRESET:126,EISCONN:127,ENOTCONN:128,ETOOMANYREFS:129,EPROCLIM:130,EUSERS:131,EDQUOT:132,ESTALE:133,ENOTSUP:134,ENOMEDIUM:135,ENOSHARE:136,ECASECLASH:137,EILSEQ:138,EOVERFLOW:139,ECANCELED:140,ENOTRECOVERABLE:141,EOWNERDEAD:142,ESTRPIPE:143};
  var ___errno_state=0;function ___setErrNo(value) {
      // For convenient setting and returning of errno.
      HEAP32[((___errno_state)>>2)]=value
      return value;
    }
  var _stdin=allocate(1, "i32*", ALLOC_STATIC);
  var _stdout=allocate(1, "i32*", ALLOC_STATIC);
  var _stderr=allocate(1, "i32*", ALLOC_STATIC);
  var __impure_ptr=allocate(1, "i32*", ALLOC_STATIC);var FS={currentPath:"/",nextInode:2,streams:[null],ignorePermissions:true,createFileHandle:function (stream, fd) {
        if (typeof stream === 'undefined') {
          stream = null;
        }
        if (!fd) {
          if (stream && stream.socket) {
            for (var i = 1; i < 64; i++) {
              if (!FS.streams[i]) {
                fd = i;
                break;
              }
            }
            assert(fd, 'ran out of low fds for sockets');
          } else {
            fd = Math.max(FS.streams.length, 64);
            for (var i = FS.streams.length; i < fd; i++) {
              FS.streams[i] = null; // Keep dense
            }
          }
        }
        // Close WebSocket first if we are about to replace the fd (i.e. dup2)
        if (FS.streams[fd] && FS.streams[fd].socket && FS.streams[fd].socket.close) {
          FS.streams[fd].socket.close();
        }
        FS.streams[fd] = stream;
        return fd;
      },removeFileHandle:function (fd) {
        FS.streams[fd] = null;
      },joinPath:function (parts, forceRelative) {
        var ret = parts[0];
        for (var i = 1; i < parts.length; i++) {
          if (ret[ret.length-1] != '/') ret += '/';
          ret += parts[i];
        }
        if (forceRelative && ret[0] == '/') ret = ret.substr(1);
        return ret;
      },absolutePath:function (relative, base) {
        if (typeof relative !== 'string') return null;
        if (base === undefined) base = FS.currentPath;
        if (relative && relative[0] == '/') base = '';
        var full = base + '/' + relative;
        var parts = full.split('/').reverse();
        var absolute = [''];
        while (parts.length) {
          var part = parts.pop();
          if (part == '' || part == '.') {
            // Nothing.
          } else if (part == '..') {
            if (absolute.length > 1) absolute.pop();
          } else {
            absolute.push(part);
          }
        }
        return absolute.length == 1 ? '/' : absolute.join('/');
      },analyzePath:function (path, dontResolveLastLink, linksVisited) {
        var ret = {
          isRoot: false,
          exists: false,
          error: 0,
          name: null,
          path: null,
          object: null,
          parentExists: false,
          parentPath: null,
          parentObject: null
        };
        path = FS.absolutePath(path);
        if (path == '/') {
          ret.isRoot = true;
          ret.exists = ret.parentExists = true;
          ret.name = '/';
          ret.path = ret.parentPath = '/';
          ret.object = ret.parentObject = FS.root;
        } else if (path !== null) {
          linksVisited = linksVisited || 0;
          path = path.slice(1).split('/');
          var current = FS.root;
          var traversed = [''];
          while (path.length) {
            if (path.length == 1 && current.isFolder) {
              ret.parentExists = true;
              ret.parentPath = traversed.length == 1 ? '/' : traversed.join('/');
              ret.parentObject = current;
              ret.name = path[0];
            }
            var target = path.shift();
            if (!current.isFolder) {
              ret.error = ERRNO_CODES.ENOTDIR;
              break;
            } else if (!current.read) {
              ret.error = ERRNO_CODES.EACCES;
              break;
            } else if (!current.contents.hasOwnProperty(target)) {
              ret.error = ERRNO_CODES.ENOENT;
              break;
            }
            current = current.contents[target];
            if (current.link && !(dontResolveLastLink && path.length == 0)) {
              if (linksVisited > 40) { // Usual Linux SYMLOOP_MAX.
                ret.error = ERRNO_CODES.ELOOP;
                break;
              }
              var link = FS.absolutePath(current.link, traversed.join('/'));
              ret = FS.analyzePath([link].concat(path).join('/'),
                                   dontResolveLastLink, linksVisited + 1);
              return ret;
            }
            traversed.push(target);
            if (path.length == 0) {
              ret.exists = true;
              ret.path = traversed.join('/');
              ret.object = current;
            }
          }
        }
        return ret;
      },findObject:function (path, dontResolveLastLink) {
        FS.ensureRoot();
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      },createObject:function (parent, name, properties, canRead, canWrite) {
        if (!parent) parent = '/';
        if (typeof parent === 'string') parent = FS.findObject(parent);
        if (!parent) {
          ___setErrNo(ERRNO_CODES.EACCES);
          throw new Error('Parent path must exist.');
        }
        if (!parent.isFolder) {
          ___setErrNo(ERRNO_CODES.ENOTDIR);
          throw new Error('Parent must be a folder.');
        }
        if (!parent.write && !FS.ignorePermissions) {
          ___setErrNo(ERRNO_CODES.EACCES);
          throw new Error('Parent folder must be writeable.');
        }
        if (!name || name == '.' || name == '..') {
          ___setErrNo(ERRNO_CODES.ENOENT);
          throw new Error('Name must not be empty.');
        }
        if (parent.contents.hasOwnProperty(name)) {
          ___setErrNo(ERRNO_CODES.EEXIST);
          throw new Error("Can't overwrite object.");
        }
        parent.contents[name] = {
          read: canRead === undefined ? true : canRead,
          write: canWrite === undefined ? false : canWrite,
          timestamp: Date.now(),
          inodeNumber: FS.nextInode++
        };
        for (var key in properties) {
          if (properties.hasOwnProperty(key)) {
            parent.contents[name][key] = properties[key];
          }
        }
        return parent.contents[name];
      },createFolder:function (parent, name, canRead, canWrite) {
        var properties = {isFolder: true, isDevice: false, contents: {}};
        return FS.createObject(parent, name, properties, canRead, canWrite);
      },createPath:function (parent, path, canRead, canWrite) {
        var current = FS.findObject(parent);
        if (current === null) throw new Error('Invalid parent.');
        path = path.split('/').reverse();
        while (path.length) {
          var part = path.pop();
          if (!part) continue;
          if (!current.contents.hasOwnProperty(part)) {
            FS.createFolder(current, part, canRead, canWrite);
          }
          current = current.contents[part];
        }
        return current;
      },createFile:function (parent, name, properties, canRead, canWrite) {
        properties.isFolder = false;
        return FS.createObject(parent, name, properties, canRead, canWrite);
      },createDataFile:function (parent, name, data, canRead, canWrite) {
        if (typeof data === 'string') {
          var dataArray = new Array(data.length);
          for (var i = 0, len = data.length; i < len; ++i) dataArray[i] = data.charCodeAt(i);
          data = dataArray;
        }
        var properties = {
          isDevice: false,
          contents: data.subarray ? data.subarray(0) : data // as an optimization, create a new array wrapper (not buffer) here, to help JS engines understand this object
        };
        return FS.createFile(parent, name, properties, canRead, canWrite);
      },createLazyFile:function (parent, name, url, canRead, canWrite) {
        if (typeof XMLHttpRequest !== 'undefined') {
          if (!ENVIRONMENT_IS_WORKER) throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc';
          // Lazy chunked Uint8Array (implements get and length from Uint8Array). Actual getting is abstracted away for eventual reuse.
          var LazyUint8Array = function() {
            this.lengthKnown = false;
            this.chunks = []; // Loaded chunks. Index is the chunk number
          }
          LazyUint8Array.prototype.get = function(idx) {
            if (idx > this.length-1 || idx < 0) {
              return undefined;
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = Math.floor(idx / this.chunkSize);
            return this.getter(chunkNum)[chunkOffset];
          }
          LazyUint8Array.prototype.setDataGetter = function(getter) {
            this.getter = getter;
          }
          LazyUint8Array.prototype.cacheLength = function() {
              // Find length
              var xhr = new XMLHttpRequest();
              xhr.open('HEAD', url, false);
              xhr.send(null);
              if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
              var datalength = Number(xhr.getResponseHeader("Content-length"));
              var header;
              var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
              var chunkSize = 1024*1024; // Chunk size in bytes
              if (!hasByteServing) chunkSize = datalength;
              // Function to get a range from the remote URL.
              var doXHR = (function(from, to) {
                if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                if (to > datalength-1) throw new Error("only " + datalength + " bytes available! programmer error!");
                // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, false);
                if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
                // Some hints to the browser that we want binary data.
                if (typeof Uint8Array != 'undefined') xhr.responseType = 'arraybuffer';
                if (xhr.overrideMimeType) {
                  xhr.overrideMimeType('text/plain; charset=x-user-defined');
                }
                xhr.send(null);
                if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                if (xhr.response !== undefined) {
                  return new Uint8Array(xhr.response || []);
                } else {
                  return intArrayFromString(xhr.responseText || '', true);
                }
              });
              var lazyArray = this;
              lazyArray.setDataGetter(function(chunkNum) {
                var start = chunkNum * chunkSize;
                var end = (chunkNum+1) * chunkSize - 1; // including this byte
                end = Math.min(end, datalength-1); // if datalength-1 is selected, this is the last block
                if (typeof(lazyArray.chunks[chunkNum]) === "undefined") {
                  lazyArray.chunks[chunkNum] = doXHR(start, end);
                }
                if (typeof(lazyArray.chunks[chunkNum]) === "undefined") throw new Error("doXHR failed!");
                return lazyArray.chunks[chunkNum];
              });
              this._length = datalength;
              this._chunkSize = chunkSize;
              this.lengthKnown = true;
          }
          var lazyArray = new LazyUint8Array();
          Object.defineProperty(lazyArray, "length", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._length;
              }
          });
          Object.defineProperty(lazyArray, "chunkSize", {
              get: function() {
                  if(!this.lengthKnown) {
                      this.cacheLength();
                  }
                  return this._chunkSize;
              }
          });
          var properties = { isDevice: false, contents: lazyArray };
        } else {
          var properties = { isDevice: false, url: url };
        }
        return FS.createFile(parent, name, properties, canRead, canWrite);
      },createPreloadedFile:function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile) {
        Browser.init();
        var fullname = FS.joinPath([parent, name], true);
        function processData(byteArray) {
          function finish(byteArray) {
            if (!dontCreateFile) {
              FS.createDataFile(parent, name, byteArray, canRead, canWrite);
            }
            if (onload) onload();
            removeRunDependency('cp ' + fullname);
          }
          var handled = false;
          Module['preloadPlugins'].forEach(function(plugin) {
            if (handled) return;
            if (plugin['canHandle'](fullname)) {
              plugin['handle'](byteArray, fullname, finish, function() {
                if (onerror) onerror();
                removeRunDependency('cp ' + fullname);
              });
              handled = true;
            }
          });
          if (!handled) finish(byteArray);
        }
        addRunDependency('cp ' + fullname);
        if (typeof url == 'string') {
          Browser.asyncLoad(url, function(byteArray) {
            processData(byteArray);
          }, onerror);
        } else {
          processData(url);
        }
      },createLink:function (parent, name, target, canRead, canWrite) {
        var properties = {isDevice: false, link: target};
        return FS.createFile(parent, name, properties, canRead, canWrite);
      },createDevice:function (parent, name, input, output) {
        if (!(input || output)) {
          throw new Error('A device must have at least one callback defined.');
        }
        var ops = {isDevice: true, input: input, output: output};
        return FS.createFile(parent, name, ops, Boolean(input), Boolean(output));
      },forceLoadFile:function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
        } else if (Module['read']) {
          // Command-line.
          try {
            // WARNING: Can't read binary files in V8's d8 or tracemonkey's js, as
            //          read() will try to parse UTF8.
            obj.contents = intArrayFromString(Module['read'](obj.url), true);
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      },ensureRoot:function () {
        if (FS.root) return;
        // The main file system tree. All the contents are inside this.
        FS.root = {
          read: true,
          write: true,
          isFolder: true,
          isDevice: false,
          timestamp: Date.now(),
          inodeNumber: 1,
          contents: {}
        };
      },init:function (input, output, error) {
        // Make sure we initialize only once.
        assert(!FS.init.initialized, 'FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)');
        FS.init.initialized = true;
        FS.ensureRoot();
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        input = input || Module['stdin'];
        output = output || Module['stdout'];
        error = error || Module['stderr'];
        // Default handlers.
        var stdinOverridden = true, stdoutOverridden = true, stderrOverridden = true;
        if (!input) {
          stdinOverridden = false;
          input = function() {
            if (!input.cache || !input.cache.length) {
              var result;
              if (typeof window != 'undefined' &&
                  typeof window.prompt == 'function') {
                // Browser.
                result = window.prompt('Input: ');
                if (result === null) result = String.fromCharCode(0); // cancel ==> EOF
              } else if (typeof readline == 'function') {
                // Command line.
                result = readline();
              }
              if (!result) result = '';
              input.cache = intArrayFromString(result + '\n', true);
            }
            return input.cache.shift();
          };
        }
        var utf8 = new Runtime.UTF8Processor();
        function simpleOutput(val) {
          if (val === null || val === 10) {
            output.printer(output.buffer.join(''));
            output.buffer = [];
          } else {
            output.buffer.push(utf8.processCChar(val));
          }
        }
        if (!output) {
          stdoutOverridden = false;
          output = simpleOutput;
        }
        if (!output.printer) output.printer = Module['print'];
        if (!output.buffer) output.buffer = [];
        if (!error) {
          stderrOverridden = false;
          error = simpleOutput;
        }
        if (!error.printer) error.printer = Module['print'];
        if (!error.buffer) error.buffer = [];
        // Create the temporary folder, if not already created
        try {
          FS.createFolder('/', 'tmp', true, true);
        } catch(e) {}
        // Create the I/O devices.
        var devFolder = FS.createFolder('/', 'dev', true, true);
        var stdin = FS.createDevice(devFolder, 'stdin', input);
        var stdout = FS.createDevice(devFolder, 'stdout', null, output);
        var stderr = FS.createDevice(devFolder, 'stderr', null, error);
        FS.createDevice(devFolder, 'tty', input, output);
        FS.createDevice(devFolder, 'null', function(){}, function(){});
        // Create default streams.
        FS.streams[1] = {
          path: '/dev/stdin',
          object: stdin,
          position: 0,
          isRead: true,
          isWrite: false,
          isAppend: false,
          isTerminal: !stdinOverridden,
          error: false,
          eof: false,
          ungotten: []
        };
        FS.streams[2] = {
          path: '/dev/stdout',
          object: stdout,
          position: 0,
          isRead: false,
          isWrite: true,
          isAppend: false,
          isTerminal: !stdoutOverridden,
          error: false,
          eof: false,
          ungotten: []
        };
        FS.streams[3] = {
          path: '/dev/stderr',
          object: stderr,
          position: 0,
          isRead: false,
          isWrite: true,
          isAppend: false,
          isTerminal: !stderrOverridden,
          error: false,
          eof: false,
          ungotten: []
        };
        // TODO: put these low in memory like we used to assert on: assert(Math.max(_stdin, _stdout, _stderr) < 15000); // make sure these are low, we flatten arrays with these
        HEAP32[((_stdin)>>2)]=1;
        HEAP32[((_stdout)>>2)]=2;
        HEAP32[((_stderr)>>2)]=3;
        // Other system paths
        FS.createPath('/', 'dev/shm/tmp', true, true); // temp files
        // Newlib initialization
        for (var i = FS.streams.length; i < Math.max(_stdin, _stdout, _stderr) + 4; i++) {
          FS.streams[i] = null; // Make sure to keep FS.streams dense
        }
        FS.streams[_stdin] = FS.streams[1];
        FS.streams[_stdout] = FS.streams[2];
        FS.streams[_stderr] = FS.streams[3];
        allocate([ allocate(
          [0, 0, 0, 0, _stdin, 0, 0, 0, _stdout, 0, 0, 0, _stderr, 0, 0, 0],
          'void*', ALLOC_NORMAL) ], 'void*', ALLOC_NONE, __impure_ptr);
      },quit:function () {
        if (!FS.init.initialized) return;
        // Flush any partially-printed lines in stdout and stderr. Careful, they may have been closed
        if (FS.streams[2] && FS.streams[2].object.output.buffer.length > 0) FS.streams[2].object.output(10);
        if (FS.streams[3] && FS.streams[3].object.output.buffer.length > 0) FS.streams[3].object.output(10);
      },standardizePath:function (path) {
        if (path.substr(0, 2) == './') path = path.substr(2);
        return path;
      },deleteFile:function (path) {
        path = FS.analyzePath(path);
        if (!path.parentExists || !path.exists) {
          throw 'Invalid path ' + path;
        }
        delete path.parentObject.contents[path.name];
      }};
  function _send(fd, buf, len, flags) {
      var info = FS.streams[fd];
      if (!info) return -1;
      info.sender(HEAPU8.subarray(buf, buf+len));
      return len;
    }
  function _pwrite(fildes, buf, nbyte, offset) {
      // ssize_t pwrite(int fildes, const void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.streams[fildes];
      if (!stream || stream.object.isDevice) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isWrite) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (stream.object.isFolder) {
        ___setErrNo(ERRNO_CODES.EISDIR);
        return -1;
      } else if (nbyte < 0 || offset < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var contents = stream.object.contents;
        while (contents.length < offset) contents.push(0);
        for (var i = 0; i < nbyte; i++) {
          contents[offset + i] = HEAPU8[(((buf)+(i))|0)];
        }
        stream.object.timestamp = Date.now();
        return i;
      }
    }function _write(fildes, buf, nbyte) {
      // ssize_t write(int fildes, const void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.streams[fildes];
      if (stream && ('socket' in stream)) {
          return _send(fildes, buf, nbyte, 0);
      } else if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isWrite) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (nbyte < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        if (stream.object.isDevice) {
          if (stream.object.output) {
            for (var i = 0; i < nbyte; i++) {
              try {
                stream.object.output(HEAP8[(((buf)+(i))|0)]);
              } catch (e) {
                ___setErrNo(ERRNO_CODES.EIO);
                return -1;
              }
            }
            stream.object.timestamp = Date.now();
            return i;
          } else {
            ___setErrNo(ERRNO_CODES.ENXIO);
            return -1;
          }
        } else {
          var bytesWritten = _pwrite(fildes, buf, nbyte, stream.position);
          if (bytesWritten != -1) stream.position += bytesWritten;
          return bytesWritten;
        }
      }
    }function _fwrite(ptr, size, nitems, stream) {
      // size_t fwrite(const void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fwrite.html
      var bytesToWrite = nitems * size;
      if (bytesToWrite == 0) return 0;
      var bytesWritten = _write(stream, ptr, bytesToWrite);
      if (bytesWritten == -1) {
        if (FS.streams[stream]) FS.streams[stream].error = true;
        return 0;
      } else {
        return Math.floor(bytesWritten / size);
      }
    }
  Module["_strlen"] = _strlen;
  function __reallyNegative(x) {
      return x < 0 || (x === 0 && (1/x) === -Infinity);
    }function __formatString(format, varargs) {
      var textIndex = format;
      var argIndex = 0;
      function getNextArg(type) {
        // NOTE: Explicitly ignoring type safety. Otherwise this fails:
        //       int x = 4; printf("%c\n", (char)x);
        var ret;
        if (type === 'double') {
          ret = HEAPF64[(((varargs)+(argIndex))>>3)];
        } else if (type == 'i64') {
          ret = [HEAP32[(((varargs)+(argIndex))>>2)],
                 HEAP32[(((varargs)+(argIndex+8))>>2)]];
          argIndex += 8; // each 32-bit chunk is in a 64-bit block
        } else {
          type = 'i32'; // varargs are always i32, i64, or double
          ret = HEAP32[(((varargs)+(argIndex))>>2)];
        }
        argIndex += Math.max(Runtime.getNativeFieldSize(type), Runtime.getAlignSize(type, null, true));
        return ret;
      }
      var ret = [];
      var curr, next, currArg;
      while(1) {
        var startTextIndex = textIndex;
        curr = HEAP8[(textIndex)];
        if (curr === 0) break;
        next = HEAP8[((textIndex+1)|0)];
        if (curr == 37) {
          // Handle flags.
          var flagAlwaysSigned = false;
          var flagLeftAlign = false;
          var flagAlternative = false;
          var flagZeroPad = false;
          flagsLoop: while (1) {
            switch (next) {
              case 43:
                flagAlwaysSigned = true;
                break;
              case 45:
                flagLeftAlign = true;
                break;
              case 35:
                flagAlternative = true;
                break;
              case 48:
                if (flagZeroPad) {
                  break flagsLoop;
                } else {
                  flagZeroPad = true;
                  break;
                }
              default:
                break flagsLoop;
            }
            textIndex++;
            next = HEAP8[((textIndex+1)|0)];
          }
          // Handle width.
          var width = 0;
          if (next == 42) {
            width = getNextArg('i32');
            textIndex++;
            next = HEAP8[((textIndex+1)|0)];
          } else {
            while (next >= 48 && next <= 57) {
              width = width * 10 + (next - 48);
              textIndex++;
              next = HEAP8[((textIndex+1)|0)];
            }
          }
          // Handle precision.
          var precisionSet = false;
          if (next == 46) {
            var precision = 0;
            precisionSet = true;
            textIndex++;
            next = HEAP8[((textIndex+1)|0)];
            if (next == 42) {
              precision = getNextArg('i32');
              textIndex++;
            } else {
              while(1) {
                var precisionChr = HEAP8[((textIndex+1)|0)];
                if (precisionChr < 48 ||
                    precisionChr > 57) break;
                precision = precision * 10 + (precisionChr - 48);
                textIndex++;
              }
            }
            next = HEAP8[((textIndex+1)|0)];
          } else {
            var precision = 6; // Standard default.
          }
          // Handle integer sizes. WARNING: These assume a 32-bit architecture!
          var argSize;
          switch (String.fromCharCode(next)) {
            case 'h':
              var nextNext = HEAP8[((textIndex+2)|0)];
              if (nextNext == 104) {
                textIndex++;
                argSize = 1; // char (actually i32 in varargs)
              } else {
                argSize = 2; // short (actually i32 in varargs)
              }
              break;
            case 'l':
              var nextNext = HEAP8[((textIndex+2)|0)];
              if (nextNext == 108) {
                textIndex++;
                argSize = 8; // long long
              } else {
                argSize = 4; // long
              }
              break;
            case 'L': // long long
            case 'q': // int64_t
            case 'j': // intmax_t
              argSize = 8;
              break;
            case 'z': // size_t
            case 't': // ptrdiff_t
            case 'I': // signed ptrdiff_t or unsigned size_t
              argSize = 4;
              break;
            default:
              argSize = null;
          }
          if (argSize) textIndex++;
          next = HEAP8[((textIndex+1)|0)];
          // Handle type specifier.
          switch (String.fromCharCode(next)) {
            case 'd': case 'i': case 'u': case 'o': case 'x': case 'X': case 'p': {
              // Integer.
              var signed = next == 100 || next == 105;
              argSize = argSize || 4;
              var currArg = getNextArg('i' + (argSize * 8));
              var origArg = currArg;
              var argText;
              // Flatten i64-1 [low, high] into a (slightly rounded) double
              if (argSize == 8) {
                currArg = Runtime.makeBigInt(currArg[0], currArg[1], next == 117);
              }
              // Truncate to requested size.
              if (argSize <= 4) {
                var limit = Math.pow(256, argSize) - 1;
                currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8);
              }
              // Format the number.
              var currAbsArg = Math.abs(currArg);
              var prefix = '';
              if (next == 100 || next == 105) {
                if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], null); else
                argText = reSign(currArg, 8 * argSize, 1).toString(10);
              } else if (next == 117) {
                if (argSize == 8 && i64Math) argText = i64Math.stringify(origArg[0], origArg[1], true); else
                argText = unSign(currArg, 8 * argSize, 1).toString(10);
                currArg = Math.abs(currArg);
              } else if (next == 111) {
                argText = (flagAlternative ? '0' : '') + currAbsArg.toString(8);
              } else if (next == 120 || next == 88) {
                prefix = (flagAlternative && currArg != 0) ? '0x' : '';
                if (argSize == 8 && i64Math) {
                  if (origArg[1]) {
                    argText = (origArg[1]>>>0).toString(16);
                    var lower = (origArg[0]>>>0).toString(16);
                    while (lower.length < 8) lower = '0' + lower;
                    argText += lower;
                  } else {
                    argText = (origArg[0]>>>0).toString(16);
                  }
                } else
                if (currArg < 0) {
                  // Represent negative numbers in hex as 2's complement.
                  currArg = -currArg;
                  argText = (currAbsArg - 1).toString(16);
                  var buffer = [];
                  for (var i = 0; i < argText.length; i++) {
                    buffer.push((0xF - parseInt(argText[i], 16)).toString(16));
                  }
                  argText = buffer.join('');
                  while (argText.length < argSize * 2) argText = 'f' + argText;
                } else {
                  argText = currAbsArg.toString(16);
                }
                if (next == 88) {
                  prefix = prefix.toUpperCase();
                  argText = argText.toUpperCase();
                }
              } else if (next == 112) {
                if (currAbsArg === 0) {
                  argText = '(nil)';
                } else {
                  prefix = '0x';
                  argText = currAbsArg.toString(16);
                }
              }
              if (precisionSet) {
                while (argText.length < precision) {
                  argText = '0' + argText;
                }
              }
              // Add sign if needed
              if (flagAlwaysSigned) {
                if (currArg < 0) {
                  prefix = '-' + prefix;
                } else {
                  prefix = '+' + prefix;
                }
              }
              // Add padding.
              while (prefix.length + argText.length < width) {
                if (flagLeftAlign) {
                  argText += ' ';
                } else {
                  if (flagZeroPad) {
                    argText = '0' + argText;
                  } else {
                    prefix = ' ' + prefix;
                  }
                }
              }
              // Insert the result into the buffer.
              argText = prefix + argText;
              argText.split('').forEach(function(chr) {
                ret.push(chr.charCodeAt(0));
              });
              break;
            }
            case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': {
              // Float.
              var currArg = getNextArg('double');
              var argText;
              if (isNaN(currArg)) {
                argText = 'nan';
                flagZeroPad = false;
              } else if (!isFinite(currArg)) {
                argText = (currArg < 0 ? '-' : '') + 'inf';
                flagZeroPad = false;
              } else {
                var isGeneral = false;
                var effectivePrecision = Math.min(precision, 20);
                // Convert g/G to f/F or e/E, as per:
                // http://pubs.opengroup.org/onlinepubs/9699919799/functions/printf.html
                if (next == 103 || next == 71) {
                  isGeneral = true;
                  precision = precision || 1;
                  var exponent = parseInt(currArg.toExponential(effectivePrecision).split('e')[1], 10);
                  if (precision > exponent && exponent >= -4) {
                    next = ((next == 103) ? 'f' : 'F').charCodeAt(0);
                    precision -= exponent + 1;
                  } else {
                    next = ((next == 103) ? 'e' : 'E').charCodeAt(0);
                    precision--;
                  }
                  effectivePrecision = Math.min(precision, 20);
                }
                if (next == 101 || next == 69) {
                  argText = currArg.toExponential(effectivePrecision);
                  // Make sure the exponent has at least 2 digits.
                  if (/[eE][-+]\d$/.test(argText)) {
                    argText = argText.slice(0, -1) + '0' + argText.slice(-1);
                  }
                } else if (next == 102 || next == 70) {
                  argText = currArg.toFixed(effectivePrecision);
                  if (currArg === 0 && __reallyNegative(currArg)) {
                    argText = '-' + argText;
                  }
                }
                var parts = argText.split('e');
                if (isGeneral && !flagAlternative) {
                  // Discard trailing zeros and periods.
                  while (parts[0].length > 1 && parts[0].indexOf('.') != -1 &&
                         (parts[0].slice(-1) == '0' || parts[0].slice(-1) == '.')) {
                    parts[0] = parts[0].slice(0, -1);
                  }
                } else {
                  // Make sure we have a period in alternative mode.
                  if (flagAlternative && argText.indexOf('.') == -1) parts[0] += '.';
                  // Zero pad until required precision.
                  while (precision > effectivePrecision++) parts[0] += '0';
                }
                argText = parts[0] + (parts.length > 1 ? 'e' + parts[1] : '');
                // Capitalize 'E' if needed.
                if (next == 69) argText = argText.toUpperCase();
                // Add sign.
                if (flagAlwaysSigned && currArg >= 0) {
                  argText = '+' + argText;
                }
              }
              // Add padding.
              while (argText.length < width) {
                if (flagLeftAlign) {
                  argText += ' ';
                } else {
                  if (flagZeroPad && (argText[0] == '-' || argText[0] == '+')) {
                    argText = argText[0] + '0' + argText.slice(1);
                  } else {
                    argText = (flagZeroPad ? '0' : ' ') + argText;
                  }
                }
              }
              // Adjust case.
              if (next < 97) argText = argText.toUpperCase();
              // Insert the result into the buffer.
              argText.split('').forEach(function(chr) {
                ret.push(chr.charCodeAt(0));
              });
              break;
            }
            case 's': {
              // String.
              var arg = getNextArg('i8*');
              var argLength = arg ? _strlen(arg) : '(null)'.length;
              if (precisionSet) argLength = Math.min(argLength, precision);
              if (!flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              if (arg) {
                for (var i = 0; i < argLength; i++) {
                  ret.push(HEAPU8[((arg++)|0)]);
                }
              } else {
                ret = ret.concat(intArrayFromString('(null)'.substr(0, argLength), true));
              }
              if (flagLeftAlign) {
                while (argLength < width--) {
                  ret.push(32);
                }
              }
              break;
            }
            case 'c': {
              // Character.
              if (flagLeftAlign) ret.push(getNextArg('i8'));
              while (--width > 0) {
                ret.push(32);
              }
              if (!flagLeftAlign) ret.push(getNextArg('i8'));
              break;
            }
            case 'n': {
              // Write the length written so far to the next parameter.
              var ptr = getNextArg('i32*');
              HEAP32[((ptr)>>2)]=ret.length
              break;
            }
            case '%': {
              // Literal percent sign.
              ret.push(curr);
              break;
            }
            default: {
              // Unknown specifiers remain untouched.
              for (var i = startTextIndex; i < textIndex + 2; i++) {
                ret.push(HEAP8[(i)]);
              }
            }
          }
          textIndex += 2;
          // TODO: Support a/A (hex float) and m (last error) specifiers.
          // TODO: Support %1${specifier} for arg selection.
        } else {
          ret.push(curr);
          textIndex += 1;
        }
      }
      return ret;
    }function _fprintf(stream, format, varargs) {
      // int fprintf(FILE *restrict stream, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var result = __formatString(format, varargs);
      var stack = Runtime.stackSave();
      var ret = _fwrite(allocate(result, 'i8', ALLOC_STACK), 1, result.length, stream);
      Runtime.stackRestore(stack);
      return ret;
    }
  function __exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      function ExitStatus() {
        this.name = "ExitStatus";
        this.message = "Program terminated with exit(" + status + ")";
        this.status = status;
        Module.print('Exit Status: ' + status);
      };
      ExitStatus.prototype = new Error();
      ExitStatus.prototype.constructor = ExitStatus;
      exitRuntime();
      ABORT = true;
      throw new ExitStatus();
    }function _exit(status) {
      __exit(status);
    }
  Module["_memset"] = _memset;var _llvm_memset_p0i8_i32=_memset;
  function ___errno_location() {
      return ___errno_state;
    }var ___errno=___errno_location;
  function _isatty(fildes) {
      // int isatty(int fildes);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/isatty.html
      if (!FS.streams[fildes]) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return 0;
      }
      if (FS.streams[fildes].isTerminal) return 1;
      ___setErrNo(ERRNO_CODES.ENOTTY);
      return 0;
    }
  function _fileno(stream) {
      // int fileno(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fileno.html
      // We use file descriptor numbers and FILE* streams interchangeably.
      return stream;
    }
  function _recv(fd, buf, len, flags) {
      var info = FS.streams[fd];
      if (!info) return -1;
      if (!info.hasData()) {
        ___setErrNo(ERRNO_CODES.EAGAIN); // no data, and all sockets are nonblocking, so this is the right behavior
        return -1;
      }
      var buffer = info.inQueue.shift();
      if (len < buffer.length) {
        if (info.stream) {
          // This is tcp (reliable), so if not all was read, keep it
          info.inQueue.unshift(buffer.subarray(len));
        }
        buffer = buffer.subarray(0, len);
      }
      HEAPU8.set(buffer, buf);
      return buffer.length;
    }
  function _pread(fildes, buf, nbyte, offset) {
      // ssize_t pread(int fildes, void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/read.html
      var stream = FS.streams[fildes];
      if (!stream || stream.object.isDevice) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isRead) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (stream.object.isFolder) {
        ___setErrNo(ERRNO_CODES.EISDIR);
        return -1;
      } else if (nbyte < 0 || offset < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var bytesRead = 0;
        while (stream.ungotten.length && nbyte > 0) {
          HEAP8[((buf++)|0)]=stream.ungotten.pop()
          nbyte--;
          bytesRead++;
        }
        var contents = stream.object.contents;
        var size = Math.min(contents.length - offset, nbyte);
        if (contents.subarray) { // typed array
          HEAPU8.set(contents.subarray(offset, offset+size), buf);
        } else
        if (contents.slice) { // normal array
          for (var i = 0; i < size; i++) {
            HEAP8[(((buf)+(i))|0)]=contents[offset + i]
          }
        } else {
          for (var i = 0; i < size; i++) { // LazyUint8Array from sync binary XHR
            HEAP8[(((buf)+(i))|0)]=contents.get(offset + i)
          }
        }
        bytesRead += size;
        return bytesRead;
      }
    }function _read(fildes, buf, nbyte) {
      // ssize_t read(int fildes, void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/read.html
      var stream = FS.streams[fildes];
      if (stream && ('socket' in stream)) {
        return _recv(fildes, buf, nbyte, 0);
      } else if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isRead) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (nbyte < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var bytesRead;
        if (stream.object.isDevice) {
          if (stream.object.input) {
            bytesRead = 0;
            while (stream.ungotten.length && nbyte > 0) {
              HEAP8[((buf++)|0)]=stream.ungotten.pop()
              nbyte--;
              bytesRead++;
            }
            for (var i = 0; i < nbyte; i++) {
              try {
                var result = stream.object.input();
              } catch (e) {
                ___setErrNo(ERRNO_CODES.EIO);
                return -1;
              }
              if (result === undefined && bytesRead === 0) {
                ___setErrNo(ERRNO_CODES.EAGAIN);
                return -1;
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              HEAP8[(((buf)+(i))|0)]=result
            }
            return bytesRead;
          } else {
            ___setErrNo(ERRNO_CODES.ENXIO);
            return -1;
          }
        } else {
          var ungotSize = stream.ungotten.length;
          bytesRead = _pread(fildes, buf, nbyte, stream.position);
          if (bytesRead != -1) {
            stream.position += (stream.ungotten.length - ungotSize) + bytesRead;
          }
          return bytesRead;
        }
      }
    }function _fgetc(stream) {
      // int fgetc(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fgetc.html
      if (!FS.streams[stream]) return -1;
      var streamObj = FS.streams[stream];
      if (streamObj.eof || streamObj.error) return -1;
      var ret = _read(stream, _fgetc.ret, 1);
      if (ret == 0) {
        streamObj.eof = true;
        return -1;
      } else if (ret == -1) {
        streamObj.error = true;
        return -1;
      } else {
        return HEAPU8[((_fgetc.ret)|0)];
      }
    }var _getc=_fgetc;
  function _ferror(stream) {
      // int ferror(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/ferror.html
      return Number(FS.streams[stream] && FS.streams[stream].error);
    }
  function _fread(ptr, size, nitems, stream) {
      // size_t fread(void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fread.html
      var bytesToRead = nitems * size;
      if (bytesToRead == 0) return 0;
      var bytesRead = _read(stream, ptr, bytesToRead);
      var streamObj = FS.streams[stream];
      if (bytesRead == -1) {
        if (streamObj) streamObj.error = true;
        return 0;
      } else {
        if (bytesRead < bytesToRead) streamObj.eof = true;
        return Math.floor(bytesRead / size);
      }
    }
  function _clearerr(stream) {
      // void clearerr(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/clearerr.html
      if (FS.streams[stream]) FS.streams[stream].error = false;
    }
  Module["_memcpy"] = _memcpy;var _llvm_memcpy_p0i8_p0i8_i32=_memcpy;
  function _strdup(ptr) {
      var len = _strlen(ptr);
      var newStr = _malloc(len + 1);
      (_memcpy(newStr, ptr, len)|0);
      HEAP8[(((newStr)+(len))|0)]=0;
      return newStr;
    }
  function _snprintf(s, n, format, varargs) {
      // int snprintf(char *restrict s, size_t n, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var result = __formatString(format, varargs);
      var limit = (n === undefined) ? result.length
                                    : Math.min(result.length, Math.max(n - 1, 0));
      if (s < 0) {
        s = -s;
        var buf = _malloc(limit+1);
        HEAP32[((s)>>2)]=buf;
        s = buf;
      }
      for (var i = 0; i < limit; i++) {
        HEAP8[(((s)+(i))|0)]=result[i];
      }
      if (limit < n || (n === undefined)) HEAP8[(((s)+(i))|0)]=0;
      return result.length;
    }function _sprintf(s, format, varargs) {
      // int sprintf(char *restrict s, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      return _snprintf(s, undefined, format, varargs);
    }
  var ___dirent_struct_layout={__size__:1040,d_ino:0,d_name:4,d_off:1028,d_reclen:1032,d_type:1036};function _open(path, oflag, varargs) {
      // int open(const char *path, int oflag, ...);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/open.html
      // NOTE: This implementation tries to mimic glibc rather than strictly
      // following the POSIX standard.
      var mode = HEAP32[((varargs)>>2)];
      // Simplify flags.
      var accessMode = oflag & 3;
      var isWrite = accessMode != 0;
      var isRead = accessMode != 1;
      var isCreate = Boolean(oflag & 512);
      var isExistCheck = Boolean(oflag & 2048);
      var isTruncate = Boolean(oflag & 1024);
      var isAppend = Boolean(oflag & 8);
      // Verify path.
      var origPath = path;
      path = FS.analyzePath(Pointer_stringify(path));
      if (!path.parentExists) {
        ___setErrNo(path.error);
        return -1;
      }
      var target = path.object || null;
      var finalPath;
      // Verify the file exists, create if needed and allowed.
      if (target) {
        if (isCreate && isExistCheck) {
          ___setErrNo(ERRNO_CODES.EEXIST);
          return -1;
        }
        if ((isWrite || isCreate || isTruncate) && target.isFolder) {
          ___setErrNo(ERRNO_CODES.EISDIR);
          return -1;
        }
        if (isRead && !target.read || isWrite && !target.write) {
          ___setErrNo(ERRNO_CODES.EACCES);
          return -1;
        }
        if (isTruncate && !target.isDevice) {
          target.contents = [];
        } else {
          if (!FS.forceLoadFile(target)) {
            ___setErrNo(ERRNO_CODES.EIO);
            return -1;
          }
        }
        finalPath = path.path;
      } else {
        if (!isCreate) {
          ___setErrNo(ERRNO_CODES.ENOENT);
          return -1;
        }
        if (!path.parentObject.write) {
          ___setErrNo(ERRNO_CODES.EACCES);
          return -1;
        }
        target = FS.createDataFile(path.parentObject, path.name, [],
                                   mode & 0x100, mode & 0x80);  // S_IRUSR, S_IWUSR.
        finalPath = path.parentPath + '/' + path.name;
      }
      // Actually create an open stream.
      var id;
      if (target.isFolder) {
        var entryBuffer = 0;
        if (___dirent_struct_layout) {
          entryBuffer = _malloc(___dirent_struct_layout.__size__);
        }
        var contents = [];
        for (var key in target.contents) contents.push(key);
        id = FS.createFileHandle({
          path: finalPath,
          object: target,
          // An index into contents. Special values: -2 is ".", -1 is "..".
          position: -2,
          isRead: true,
          isWrite: false,
          isAppend: false,
          error: false,
          eof: false,
          ungotten: [],
          // Folder-specific properties:
          // Remember the contents at the time of opening in an array, so we can
          // seek between them relying on a single order.
          contents: contents,
          // Each stream has its own area for readdir() returns.
          currentEntry: entryBuffer
        });
      } else {
        id = FS.createFileHandle({
          path: finalPath,
          object: target,
          position: 0,
          isRead: isRead,
          isWrite: isWrite,
          isAppend: isAppend,
          error: false,
          eof: false,
          ungotten: []
        });
      }
      return id;
    }function _fopen(filename, mode) {
      // FILE *fopen(const char *restrict filename, const char *restrict mode);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fopen.html
      var flags;
      mode = Pointer_stringify(mode);
      if (mode[0] == 'r') {
        if (mode.indexOf('+') != -1) {
          flags = 2;
        } else {
          flags = 0;
        }
      } else if (mode[0] == 'w') {
        if (mode.indexOf('+') != -1) {
          flags = 2;
        } else {
          flags = 1;
        }
        flags |= 512;
        flags |= 1024;
      } else if (mode[0] == 'a') {
        if (mode.indexOf('+') != -1) {
          flags = 2;
        } else {
          flags = 1;
        }
        flags |= 512;
        flags |= 8;
      } else {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return 0;
      }
      var ret = _open(filename, flags, allocate([0x1FF, 0, 0, 0], 'i32', ALLOC_STACK));  // All creation permissions.
      return (ret == -1) ? 0 : ret;
    }
  function _close(fildes) {
      // int close(int fildes);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/close.html
      if (FS.streams[fildes]) {
        if (FS.streams[fildes].currentEntry) {
          _free(FS.streams[fildes].currentEntry);
        }
        FS.streams[fildes] = null;
        return 0;
      } else {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
    }
  function _fsync(fildes) {
      // int fsync(int fildes);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fsync.html
      if (FS.streams[fildes]) {
        // We write directly to the file system, so there's nothing to do here.
        return 0;
      } else {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
    }function _fclose(stream) {
      // int fclose(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fclose.html
      _fsync(stream);
      return _close(stream);
    }
  Module["_strcpy"] = _strcpy;
  function _strncmp(px, py, n) {
      var i = 0;
      while (i < n) {
        var x = HEAPU8[(((px)+(i))|0)];
        var y = HEAPU8[(((py)+(i))|0)];
        if (x == y && x == 0) return 0;
        if (x == 0) return -1;
        if (y == 0) return 1;
        if (x == y) {
          i ++;
          continue;
        } else {
          return x > y ? 1 : -1;
        }
      }
      return 0;
    }function _strcmp(px, py) {
      return _strncmp(px, py, TOTAL_MEMORY);
    }
  function _inet_addr(ptr) {
      var b = Pointer_stringify(ptr).split(".");
      if (b.length !== 4) return -1; // we return -1 for error, and otherwise a uint32. this helps inet_pton differentiate
      return (Number(b[0]) | (Number(b[1]) << 8) | (Number(b[2]) << 16) | (Number(b[3]) << 24)) >>> 0;
    }
  function _isspace(chr) {
      return chr in { 32: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0 };
    }
  function __parseInt64(str, endptr, base, min, max, unsign) {
      var isNegative = false;
      // Skip space.
      while (_isspace(HEAP8[(str)])) str++;
      // Check for a plus/minus sign.
      if (HEAP8[(str)] == 45) {
        str++;
        isNegative = true;
      } else if (HEAP8[(str)] == 43) {
        str++;
      }
      // Find base.
      var ok = false;
      var finalBase = base;
      if (!finalBase) {
        if (HEAP8[(str)] == 48) {
          if (HEAP8[((str+1)|0)] == 120 ||
              HEAP8[((str+1)|0)] == 88) {
            finalBase = 16;
            str += 2;
          } else {
            finalBase = 8;
            ok = true; // we saw an initial zero, perhaps the entire thing is just "0"
          }
        }
      } else if (finalBase==16) {
        if (HEAP8[(str)] == 48) {
          if (HEAP8[((str+1)|0)] == 120 ||
              HEAP8[((str+1)|0)] == 88) {
            str += 2;
          }
        }
      }
      if (!finalBase) finalBase = 10;
      start = str;
      // Get digits.
      var chr;
      while ((chr = HEAP8[(str)]) != 0) {
        var digit = parseInt(String.fromCharCode(chr), finalBase);
        if (isNaN(digit)) {
          break;
        } else {
          str++;
          ok = true;
        }
      }
      if (!ok) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return ((asm["setTempRet0"](0),0)|0);
      }
      // Set end pointer.
      if (endptr) {
        HEAP32[((endptr)>>2)]=str
      }
      try {
        var numberString = isNegative ? '-'+Pointer_stringify(start, str - start) : Pointer_stringify(start, str - start);
        i64Math.fromString(numberString, finalBase, min, max, unsign);
      } catch(e) {
        ___setErrNo(ERRNO_CODES.ERANGE); // not quite correct
      }
      return ((asm["setTempRet0"](((HEAP32[(((tempDoublePtr)+(4))>>2)])|0)),((HEAP32[((tempDoublePtr)>>2)])|0))|0);
    }function _strtoull(str, endptr, base) {
      return __parseInt64(str, endptr, base, 0, '18446744073709551615', true);  // ULONG_MAX.
    }
  Module["_strcat"] = _strcat;
  function _htonl(value) {
      return ((value & 0xff) << 24) + ((value & 0xff00) << 8) +
             ((value & 0xff0000) >>> 8) + ((value & 0xff000000) >>> 24);
    }
  var _ntohl=_htonl;
  function _htons(value) {
      return ((value & 0xff) << 8) + ((value & 0xff00) >> 8);
    }
  var Sockets={BUFFER_SIZE:10240,MAX_BUFFER_SIZE:10485760,nextFd:1,fds:{},nextport:1,maxport:65535,peer:null,connections:{},portmap:{},localAddr:4261412874,addrPool:[33554442,50331658,67108874,83886090,100663306,117440522,134217738,150994954,167772170,184549386,201326602,218103818,234881034],sockaddr_in_layout:{__size__:20,sin_family:0,sin_port:4,sin_addr:8,sin_zero:12,sin_zero_b:16},msghdr_layout:{__size__:28,msg_name:0,msg_namelen:4,msg_iov:8,msg_iovlen:12,msg_control:16,msg_controllen:20,msg_flags:24}};function _socket(family, type, protocol) {
      var stream = type == 200;
      if (protocol) {
        assert(stream == (protocol == 1)); // if SOCK_STREAM, must be tcp
      }
      var fd = FS.createFileHandle({
        connected: false,
        stream: stream,
        socket: true
      });
      assert(fd < 64); // select() assumes socket fd values are in 0..63
      return fd;
    }
  function _setsockopt() {}
  function _abort() {
      ABORT = true;
      throw 'abort() at ' + (new Error().stack);
    }
  function _sysconf(name) {
      // long sysconf(int name);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/sysconf.html
      switch(name) {
        case 8: return PAGE_SIZE;
        case 54:
        case 56:
        case 21:
        case 61:
        case 63:
        case 22:
        case 67:
        case 23:
        case 24:
        case 25:
        case 26:
        case 27:
        case 69:
        case 28:
        case 101:
        case 70:
        case 71:
        case 29:
        case 30:
        case 199:
        case 75:
        case 76:
        case 32:
        case 43:
        case 44:
        case 80:
        case 46:
        case 47:
        case 45:
        case 48:
        case 49:
        case 42:
        case 82:
        case 33:
        case 7:
        case 108:
        case 109:
        case 107:
        case 112:
        case 119:
        case 121:
          return 200809;
        case 13:
        case 104:
        case 94:
        case 95:
        case 34:
        case 35:
        case 77:
        case 81:
        case 83:
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 91:
        case 94:
        case 95:
        case 110:
        case 111:
        case 113:
        case 114:
        case 115:
        case 116:
        case 117:
        case 118:
        case 120:
        case 40:
        case 16:
        case 79:
        case 19:
          return -1;
        case 92:
        case 93:
        case 5:
        case 72:
        case 6:
        case 74:
        case 92:
        case 93:
        case 96:
        case 97:
        case 98:
        case 99:
        case 102:
        case 103:
        case 105:
          return 1;
        case 38:
        case 66:
        case 50:
        case 51:
        case 4:
          return 1024;
        case 15:
        case 64:
        case 41:
          return 32;
        case 55:
        case 37:
        case 17:
          return 2147483647;
        case 18:
        case 1:
          return 47839;
        case 59:
        case 57:
          return 99;
        case 68:
        case 58:
          return 2048;
        case 0: return 2097152;
        case 3: return 65536;
        case 14: return 32768;
        case 73: return 32767;
        case 39: return 16384;
        case 60: return 1000;
        case 106: return 700;
        case 52: return 256;
        case 62: return 255;
        case 2: return 100;
        case 65: return 64;
        case 36: return 20;
        case 100: return 16;
        case 20: return 6;
        case 53: return 4;
        case 10: return 1;
      }
      ___setErrNo(ERRNO_CODES.EINVAL);
      return -1;
    }
  function _sbrk(bytes) {
      // Implement a Linux-like 'memory area' for our 'process'.
      // Changes the size of the memory area by |bytes|; returns the
      // address of the previous top ('break') of the memory area
      // We control the "dynamic" memory - DYNAMIC_BASE to DYNAMICTOP
      var self = _sbrk;
      if (!self.called) {
        DYNAMICTOP = alignMemoryPage(DYNAMICTOP); // make sure we start out aligned
        self.called = true;
        assert(Runtime.dynamicAlloc);
        self.alloc = Runtime.dynamicAlloc;
        Runtime.dynamicAlloc = function() { abort('cannot dynamically allocate, sbrk now has control') };
      }
      var ret = DYNAMICTOP;
      if (bytes != 0) self.alloc(bytes);
      return ret;  // Previous break location.
    }
  function _llvm_lifetime_start() {}
  function _llvm_lifetime_end() {}
  var _llvm_memset_p0i8_i64=_memset;
  var Browser={mainLoop:{scheduler:null,shouldPause:false,paused:false,queue:[],pause:function () {
          Browser.mainLoop.shouldPause = true;
        },resume:function () {
          if (Browser.mainLoop.paused) {
            Browser.mainLoop.paused = false;
            Browser.mainLoop.scheduler();
          }
          Browser.mainLoop.shouldPause = false;
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        }},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = []; // needs to exist even in workers
        if (Browser.initted || ENVIRONMENT_IS_WORKER) return;
        Browser.initted = true;
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : console.log("warning: cannot create object URLs");
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
        function getMimetype(name) {
          return {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'bmp': 'image/bmp',
            'ogg': 'audio/ogg',
            'wav': 'audio/wav',
            'mp3': 'audio/mpeg'
          }[name.substr(name.lastIndexOf('.')+1)];
        }
        var imagePlugin = {};
        imagePlugin['canHandle'] = function(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/.exec(name);
        };
        imagePlugin['handle'] = function(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: getMimetype(name) });
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          var img = new Image();
          img.onload = function() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
        var audioPlugin = {};
        audioPlugin['canHandle'] = function(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
        // Canvas event setup
        var canvas = Module['canvas'];
        canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                    canvas['mozRequestPointerLock'] ||
                                    canvas['webkitRequestPointerLock'];
        canvas.exitPointerLock = document['exitPointerLock'] ||
                                 document['mozExitPointerLock'] ||
                                 document['webkitExitPointerLock'] ||
                                 function(){}; // no-op if function does not exist
        canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas;
        }
        document.addEventListener('pointerlockchange', pointerLockChange, false);
        document.addEventListener('mozpointerlockchange', pointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
        if (Module['elementPointerLock']) {
          canvas.addEventListener("click", function(ev) {
            if (!Browser.pointerLock && canvas.requestPointerLock) {
              canvas.requestPointerLock();
              ev.preventDefault();
            }
          }, false);
        }
      },createContext:function (canvas, useWebGL, setInModule) {
        var ctx;
        try {
          if (useWebGL) {
            ctx = canvas.getContext('experimental-webgl', {
              alpha: false
            });
          } else {
            ctx = canvas.getContext('2d');
          }
          if (!ctx) throw ':(';
        } catch (e) {
          Module.print('Could not create canvas - ' + e);
          return null;
        }
        if (useWebGL) {
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
          // Warn on context loss
          canvas.addEventListener('webglcontextlost', function(event) {
            alert('WebGL context lost. You will need to reload the page.');
          }, false);
        }
        if (setInModule) {
          Module.ctx = ctx;
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        var canvas = Module['canvas'];
        function fullScreenChange() {
          Browser.isFullScreen = false;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement']) === canvas) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                                      document['mozCancelFullScreen'] ||
                                      document['webkitCancelFullScreen'];
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
          } else if (Browser.resizeCanvas){
            Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
        }
        if (!Browser.fullScreenHandlersInstalled) {
          Browser.fullScreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullScreenChange, false);
          document.addEventListener('mozfullscreenchange', fullScreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
        }
        canvas.requestFullScreen = canvas['requestFullScreen'] ||
                                   canvas['mozRequestFullScreen'] ||
                                   (canvas['webkitRequestFullScreen'] ? function() { canvas['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
        canvas.requestFullScreen();
      },requestAnimationFrame:function (func) {
        if (!window.requestAnimationFrame) {
          window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                         window['mozRequestAnimationFrame'] ||
                                         window['webkitRequestAnimationFrame'] ||
                                         window['msRequestAnimationFrame'] ||
                                         window['oRequestAnimationFrame'] ||
                                         window['setTimeout'];
        }
        window.requestAnimationFrame(func);
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (!ABORT) func();
        });
      },safeSetTimeout:function (func, timeout) {
        return setTimeout(function() {
          if (!ABORT) func();
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        return setInterval(function() {
          if (!ABORT) func();
        }, timeout);
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var x = event.pageX - (window.scrollX + rect.left);
          var y = event.pageY - (window.scrollY + rect.top);
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        canvas.width = width;
        canvas.height = height;
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
        var canvas = Module['canvas'];
        this.windowedWidth = canvas.width;
        this.windowedHeight = canvas.height;
        canvas.width = screen.width;
        canvas.height = screen.height;
        var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        var canvas = Module['canvas'];
        canvas.width = this.windowedWidth;
        canvas.height = this.windowedHeight;
        var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        Browser.updateResizeListeners();
      }};
__ATINIT__.unshift({ func: function() { if (!Module["noFSInit"] && !FS.init.initialized) FS.init() } });__ATMAIN__.push({ func: function() { FS.ignorePermissions = false } });__ATEXIT__.push({ func: function() { FS.quit() } });Module["FS_createFolder"] = FS.createFolder;Module["FS_createPath"] = FS.createPath;Module["FS_createDataFile"] = FS.createDataFile;Module["FS_createPreloadedFile"] = FS.createPreloadedFile;Module["FS_createLazyFile"] = FS.createLazyFile;Module["FS_createLink"] = FS.createLink;Module["FS_createDevice"] = FS.createDevice;
___errno_state = Runtime.staticAlloc(4); HEAP32[((___errno_state)>>2)]=0;
_fgetc.ret = allocate([0], "i8", ALLOC_STATIC);
Module["requestFullScreen"] = function(lockPointer, resizeCanvas) { Browser.requestFullScreen(lockPointer, resizeCanvas) };
  Module["requestAnimationFrame"] = function(func) { Browser.requestAnimationFrame(func) };
  Module["pauseMainLoop"] = function() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function() { Browser.getUserMedia() }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
staticSealed = true; // seal the static portion of memory
STACK_MAX = STACK_BASE + 5242880;
DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
assert(DYNAMIC_BASE < TOTAL_MEMORY); // Stack must fit in TOTAL_MEMORY; allocations from here on may enlarge TOTAL_MEMORY
 var ctlz_i8 = allocate([8,7,6,6,5,5,5,5,4,4,4,4,4,4,4,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "i8", ALLOC_DYNAMIC);
 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);
var Math_min = Math.min;
function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function asmPrintInt(x, y) {
  Module.print('int ' + x + ',' + y);// + ' ' + new Error().stack);
}
function asmPrintFloat(x, y) {
  Module.print('float ' + x + ',' + y);// + ' ' + new Error().stack);
}
// EMSCRIPTEN_START_ASM
var asm=(function(global,env,buffer){"use asm";var a=new global.Int8Array(buffer);var b=new global.Int16Array(buffer);var c=new global.Int32Array(buffer);var d=new global.Uint8Array(buffer);var e=new global.Uint16Array(buffer);var f=new global.Uint32Array(buffer);var g=new global.Float32Array(buffer);var h=new global.Float64Array(buffer);var i=env.STACKTOP|0;var j=env.STACK_MAX|0;var k=env.tempDoublePtr|0;var l=env.ABORT|0;var m=env.cttz_i8|0;var n=env.ctlz_i8|0;var o=env._stdout|0;var p=env._stderr|0;var q=env._stdin|0;var r=+env.NaN;var s=+env.Infinity;var t=0;var u=0;var v=0;var w=0;var x=0,y=0,z=0,A=0,B=0.0,C=0,D=0,E=0,F=0.0;var G=0;var H=0;var I=0;var J=0;var K=0;var L=0;var M=0;var N=0;var O=0;var P=0;var Q=global.Math.floor;var R=global.Math.abs;var S=global.Math.sqrt;var T=global.Math.pow;var U=global.Math.cos;var V=global.Math.sin;var W=global.Math.tan;var X=global.Math.acos;var Y=global.Math.asin;var Z=global.Math.atan;var _=global.Math.atan2;var $=global.Math.exp;var aa=global.Math.log;var ab=global.Math.ceil;var ac=global.Math.imul;var ad=env.abort;var ae=env.assert;var af=env.asmPrintInt;var ag=env.asmPrintFloat;var ah=env.min;var ai=env.invoke_ii;var aj=env.invoke_v;var ak=env.invoke_iii;var al=env.invoke_vi;var am=env._strncmp;var an=env._llvm_lifetime_end;var ao=env._htonl;var ap=env._snprintf;var aq=env._fgetc;var ar=env._fclose;var as=env._abort;var at=env._fprintf;var au=env._close;var av=env._strtoull;var aw=env._pread;var ax=env._fopen;var ay=env.__reallyNegative;var az=env._htons;var aA=env._clearerr;var aB=env._sysconf;var aC=env._open;var aD=env.___setErrNo;var aE=env._fwrite;var aF=env._inet_addr;var aG=env._send;var aH=env._write;var aI=env._exit;var aJ=env._sprintf;var aK=env._strdup;var aL=env._isspace;var aM=env._fread;var aN=env._isatty;var aO=env._setsockopt;var aP=env._read;var aQ=env._ferror;var aR=env.__formatString;var aS=env._js_send_bytes;var aT=env._recv;var aU=env.__parseInt64;var aV=env._fileno;var aW=env._pwrite;var aX=env._socket;var aY=env._fsync;var aZ=env.___errno_location;var a_=env._llvm_lifetime_start;var a$=env._sbrk;var a0=env._time;var a1=env.__exit;var a2=env._strcmp;
// EMSCRIPTEN_START_FUNCS
function a7(a){a=a|0;var b=0;b=i;i=i+a|0;i=i+7>>3<<3;return b|0}function a8(){return i|0}function a9(a){a=a|0;i=a}function ba(a,b){a=a|0;b=b|0;if((t|0)==0){t=a;u=b}}function bb(b){b=b|0;a[k]=a[b];a[k+1|0]=a[b+1|0];a[k+2|0]=a[b+2|0];a[k+3|0]=a[b+3|0]}function bc(b){b=b|0;a[k]=a[b];a[k+1|0]=a[b+1|0];a[k+2|0]=a[b+2|0];a[k+3|0]=a[b+3|0];a[k+4|0]=a[b+4|0];a[k+5|0]=a[b+5|0];a[k+6|0]=a[b+6|0];a[k+7|0]=a[b+7|0]}function bd(a){a=a|0;G=a}function be(a){a=a|0;H=a}function bf(a){a=a|0;I=a}function bg(a){a=a|0;J=a}function bh(a){a=a|0;K=a}function bi(a){a=a|0;L=a}function bj(a){a=a|0;M=a}function bk(a){a=a|0;N=a}function bl(a){a=a|0;O=a}function bm(a){a=a|0;P=a}function bn(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;return bo(a,b,c,d,e,3,f)|0}function bo(d,e,f,g,h,j,k){d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;k=k|0;var l=0,m=0,n=0,o=0,p=0;l=i;i=i+8|0;m=bS(104)|0;n=m;if((m|0)==0){o=0;i=l;return o|0}if((bR(m,d,e,f)|0)<0){bT(m);o=0;i=l;return o|0}a[l|0]=j&255;if(((ao(c[m+12>>2]|0)|0)&-268435456|0)==-536870912){p}p=m+100|0;c[p>>2]=k;k=bS(65507)|0;j=m+60|0;c[j>>2]=k;if((k|0)==0){bT(m);o=0;i=l;return o|0}bZ(m+64|0,0,24);b[m+88>>1]=h;c[m+92>>2]=g;if((g|0)==0){o=n;i=l;return o|0}g=bx(0,3328)|0;if((g|0)==0){o=n;i=l;return o|0}c[m+96>>2]=a0(0)|0;m=bA(g,c[j>>2]|0,65507,0)|0;if((m|0)>=0){h=c[j>>2]|0;j=c[p>>2]|0;aS(j|0,h|0,m|0)|0}bz(g)|0;o=n;i=l;return o|0}function bp(a,d){a=a|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((a|0)==0){e=-1;return e|0}f=a+60|0;g=bA(d,c[f>>2]|0,65507,0)|0;if((g|0)<0){h=-1}else{h=(aS(c[a+100>>2]|0,c[f>>2]|0,g|0)|0)==-1?-2:0}g=a0(0)|0;f=a+64|0;d=b1(c[f>>2]|0,c[f+4>>2]|0,1,0)|0;c[f>>2]=d;c[f+4>>2]=G;f=a+72|0;d=b1(c[f>>2]|0,c[f+4>>2]|0,1,0)|0;c[f>>2]=d;c[f+4>>2]=G;if((c[a+92>>2]|0)==0){e=h;return e|0}d=a+96|0;if((g-(c[d>>2]|0)|0)<(b[a+88>>1]|0)){e=h;return e|0}i=bx(0,2840)|0;if((i|0)==0){e=h;return e|0}j=a+80|0;k=b1(c[j>>2]|0,c[j+4>>2]|0,1,0)|0;c[j>>2]=k;c[j+4>>2]=G;bq(a,i,g);c[d>>2]=g;c[f>>2]=0;c[f+4>>2]=0;e=h;return e|0}function bq(a,d,e){a=a|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((d|0)==0){return}f=e-(c[a+96>>2]|0)|0;if((f|0)>32767){g=32767}else{g=(f|0)<0?0:f&65535}f=bS(2)|0;do{if((f|0)!=0){b[f>>1]=g;if((bI(d,3064,2,f)|0)>=0){break}bT(f)}}while(0);f=a+80|0;g=c[f>>2]|0;e=c[f+4>>2]|0;f=bS(8)|0;do{if((f|0)!=0){h=f;c[h>>2]=g;c[h+4>>2]=e;if((bI(d,2992,7,f)|0)>=0){break}bT(f)}}while(0);f=a+72|0;e=c[f>>2]|0;g=c[f+4>>2]|0;f=bS(8)|0;do{if((f|0)!=0){h=f;c[h>>2]=e;c[h+4>>2]=g;if((bI(d,2952,7,f)|0)>=0){break}bT(f)}}while(0);f=a+64|0;g=c[f>>2]|0;e=c[f+4>>2]|0;f=bS(8)|0;do{if((f|0)!=0){h=f;c[h>>2]=g;c[h+4>>2]=e;if((bI(d,2904,7,f)|0)>=0){break}bT(f)}}while(0);f=a+60|0;e=bA(d,c[f>>2]|0,65507,0)|0;if((e|0)>=0){g=c[f>>2]|0;f=c[a+100>>2]|0;aS(f|0,g|0,e|0)|0}bz(d)|0;return}function br(e,f){e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,p=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aB=0,aC=0,aD=0;if(!(a[840]|0)){a[840]=1;if(!(a[504]|0)){a[504]=1}if((c[620]|0)==0){c[620]=c[q>>2]}if((c[616]|0)==0){c[616]=c[o>>2]}g=c[552]|0;if((g|0)==0){h=64}else{i=c[548]|0;j=c[g+(i<<2)>>2]|0;if((j|0)==0){h=64}else{k=i;l=g;m=j}}if((h|0)==64){bu();j=bv(c[620]|0,16384)|0;c[(c[552]|0)+(c[548]<<2)>>2]=j;j=c[548]|0;g=c[552]|0;k=j;l=g;m=c[g+(j<<2)>>2]|0}j=l+(k<<2)|0;c[176]=c[m+16>>2];m=c[(c[j>>2]|0)+8>>2]|0;c[546]=m;c[614]=m;c[620]=c[c[j>>2]>>2];a[848]=a[m]|0}m=f+12|0;L88:while(1){j=c[546]|0;a[j]=a[848]|0;k=a[504]&1;l=j;g=j;L90:while(1){j=k;i=g;while(1){n=c[856+(d[i]<<2)>>2]&255;if((j-3|0)>>>0<48){c[206]=j;c[208]=i;p=j;r=n}else{p=j;r=n}L96:while(1){n=r&255;s=p;do{t=(b[2216+(s<<1)>>1]|0)+n|0;if((b[1992+(t<<1)>>1]|0)==(s|0)){break L96}u=b[1880+(s<<1)>>1]|0;s=u<<16>>16;}while(u<<16>>16<=51);p=s;r=c[712+(n<<2)>>2]&255}u=b[512+(t<<1)>>1]|0;v=i+1|0;if((b[2216+(u<<1)>>1]|0)==68){w=u;x=l;y=v;break}else{j=u;i=v}}L103:while(1){i=x;j=w;v=y;L105:while(1){if((j-3|0)>>>0>47){z=c[206]|0;A=c[208]|0}else{z=j;A=v}u=b[2328+(z<<1)>>1]|0;c[614]=x;B=A;c[618]=B-i;a[848]=a[A]|0;a[A]=0;c[546]=A;C=u;while(1){if((C|0)==15|(C|0)==16){continue L88}else if((C|0)==0){break}else if((C|0)==1){h=82;break L90}else if((C|0)==2){h=83;break L88}else if((C|0)==3){h=84;break L88}else if((C|0)==4){h=85;break L88}else if((C|0)==5){h=86;break L88}else if((C|0)==6){h=87;break L88}else if((C|0)==7){h=88;break L88}else if((C|0)==8){h=89;break L88}else if((C|0)==9){h=90;break L88}else if((C|0)==10){h=91;break L88}else if((C|0)==11){h=92;break L88}else if((C|0)==12){h=93;break L88}else if((C|0)==13){h=94;break L88}else if((C|0)==17){h=95;break L90}else if((C|0)==14){h=180;break L88}else if((C|0)==19){D=0;h=184;break L88}else if((C|0)!=18){h=179;break L88}E=B-(c[614]|0)|0;F=E-1|0;a[A]=a[848]|0;u=c[548]|0;G=c[552]|0;H=G+(u<<2)|0;I=c[H>>2]|0;if((c[I+44>>2]|0)==0){c[176]=c[I+16>>2];c[c[H>>2]>>2]=c[620];c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+44>>2]=1;H=c[548]|0;J=c[552]|0;K=H;L=J;M=c[J+(H<<2)>>2]|0}else{K=u;L=G;M=I}I=c[546]|0;G=c[176]|0;u=c[M+4>>2]|0;N=c[614]|0;if(I>>>0<=(u+G|0)>>>0){break L105}if(I>>>0>(u+(G+1)|0)>>>0){h=116;break L88}G=I-N|0;if((c[M+40>>2]|0)==0){O=(G|0)==1?1:2;P=N;Q=K;R=L}else{I=G-1|0;if((I|0)>0){G=0;H=N;J=u;while(1){a[J]=a[H]|0;u=G+1|0;if((u|0)<(I|0)){G=u;H=H+1|0;J=J+1|0}else{break}}J=c[548]|0;H=c[552]|0;S=J;T=H;U=c[H+(J<<2)>>2]|0}else{S=K;T=L;U=M}if((c[U+44>>2]|0)==2){c[176]=0;c[(c[T+(S<<2)>>2]|0)+16>>2]=0}else{J=(c[U+12>>2]|0)-I-1|0;if((J|0)<1){H=T;G=U;u=c[546]|0;while(1){V=(H|0)==0?0:G;W=V+4|0;X=c[W>>2]|0;if((c[V+20>>2]|0)==0){h=127;break L88}Y=V+12|0;V=c[Y>>2]|0;Z=V<<1;if((Z|0)<1){_=(V>>>3)+V|0}else{_=Z}c[Y>>2]=_;Y=bU(X,_+2|0)|0;c[W>>2]=Y;if((Y|0)==0){h=183;break L88}Z=Y+(u-X)|0;c[546]=Z;X=c[552]|0;Y=c[X+(c[548]<<2)>>2]|0;V=(c[Y+12>>2]|0)-I-1|0;if((V|0)<1){H=X;G=Y;u=Z}else{$=V;aa=Y;break}}}else{$=J;aa=U}u=($|0)>8192?8192:$;L138:do{if((c[aa+24>>2]|0)==0){c[(aZ()|0)>>2]=0;G=aM((c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+4>>2]|0)+I|0,1,u|0,c[620]|0)|0;c[176]=G;if((G|0)!=0){ab=G;break}while(1){if((aQ(c[620]|0)|0)==0){ab=0;break L138}if((c[(aZ()|0)>>2]|0)!=4){h=145;break L88}c[(aZ()|0)>>2]=0;aA(c[620]|0);G=aM((c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+4>>2]|0)+I|0,1,u|0,c[620]|0)|0;c[176]=G;if((G|0)!=0){ab=G;break}}}else{do{if((u|0)==0){ac=0}else{G=0;while(1){ad=aq(c[620]|0)|0;if((ad|0)==(-1|0)|(ad|0)==10){ae=G;break}a[(c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+4>>2]|0)+(G+I)|0]=ad&255;H=G+1|0;if(H>>>0<u>>>0){G=H}else{ae=H;break}}if((ad|0)==10){a[(c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+4>>2]|0)+(ae+I)|0]=10;ac=ae+1|0;break}else if((ad|0)==(-1|0)){if((aQ(c[620]|0)|0)==0){ac=ae;break}else{h=140;break L88}}else{ac=ae;break}}}while(0);c[176]=ac;ab=ac}}while(0);c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+16>>2]=ab}do{if((c[176]|0)==0){if((I|0)==0){bs(c[620]|0);af=1;break}else{c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+44>>2]=2;af=2;break}}else{af=0}}while(0);u=c[176]|0;J=u+I|0;G=c[548]|0;H=c[552]|0;Y=c[H+(G<<2)>>2]|0;if(J>>>0>(c[Y+12>>2]|0)>>>0){V=bU(c[Y+4>>2]|0,J+(u>>1)|0)|0;c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+4>>2]=V;V=c[548]|0;J=c[552]|0;if((c[(c[J+(V<<2)>>2]|0)+4>>2]|0)==0){h=155;break L88}ag=V;ah=J;ai=c[176]|0}else{ag=G;ah=H;ai=u}u=ai+I|0;c[176]=u;a[(c[(c[ah+(ag<<2)>>2]|0)+4>>2]|0)+u|0]=0;a[(c[(c[(c[552]|0)+(c[548]<<2)>>2]|0)+4>>2]|0)+((c[176]|0)+1)|0]=0;u=c[548]|0;H=c[552]|0;G=c[(c[H+(u<<2)>>2]|0)+4>>2]|0;c[614]=G;O=af;P=G;Q=u;R=H}if((O|0)==0){break L103}else if((O|0)==2){h=169;break L105}else if((O|0)!=1){continue L88}c[546]=P;C=(((a[504]^1)<<31>>31|0)/2&-1)+19|0}a[A]=a[848]|0;j=c[206]|0;v=c[208]|0}if((h|0)==169){h=0;v=(c[(c[R+(Q<<2)>>2]|0)+4>>2]|0)+(c[176]|0)|0;c[546]=v;j=a[504]&1;if(P>>>0<v>>>0){aj=j;ak=P}else{w=j;x=P;y=v;continue}while(1){j=a[ak]|0;if(j<<24>>24==0){al=1}else{al=c[856+((j&255)<<2)>>2]&255}if((aj-3|0)>>>0<48){c[206]=aj;c[208]=ak;am=al;an=aj}else{am=al;an=aj}L179:while(1){j=am&255;i=an;do{ao=(b[2216+(i<<1)>>1]|0)+j|0;if((b[1992+(ao<<1)>>1]|0)==(i|0)){break L179}C=b[1880+(i<<1)>>1]|0;i=C<<16>>16;}while(C<<16>>16<=51);am=c[712+(j<<2)>>2]&255;an=i}I=b[512+(ao<<1)>>1]|0;C=ak+1|0;if(C>>>0<v>>>0){aj=I;ak=C}else{w=I;x=P;y=v;continue L103}}}v=N+F|0;c[546]=v;I=a[504]&1;if((F|0)>0){C=I;B=N;while(1){n=a[B]|0;if(n<<24>>24==0){ap=1}else{ap=c[856+((n&255)<<2)>>2]&255}if((C-3|0)>>>0<48){c[206]=C;c[208]=B;ar=ap;as=C}else{ar=ap;as=C}L195:while(1){n=ar&255;s=as;do{at=(b[2216+(s<<1)>>1]|0)+n|0;if((b[1992+(at<<1)>>1]|0)==(s|0)){break L195}H=b[1880+(s<<1)>>1]|0;s=H<<16>>16;}while(H<<16>>16<=51);ar=c[712+(n<<2)>>2]&255;as=s}i=b[512+(at<<1)>>1]|0;j=B+1|0;if(j>>>0<v>>>0){C=i;B=j}else{au=i;break}}}else{au=I}if((au-3|0)>>>0<48){c[206]=au;c[208]=v}B=b[2216+(au<<1)>>1]|0;if((b[1992+(B+1<<1)>>1]|0)==(au|0)){av=B}else{B=au;while(1){C=b[1880+(B<<1)>>1]|0;i=C<<16>>16;j=b[2216+(i<<1)>>1]|0;if((b[1992+(j+1<<1)>>1]|0)==C<<16>>16){av=j;break}else{B=i}}}B=b[512+(av+1<<1)>>1]|0;aw=B<<16>>16==51?0:B<<16>>16;if((aw|0)==0){w=au;x=N;y=v}else{h=114;break}}if((h|0)==114){h=0;B=N+E|0;c[546]=B;k=aw;l=N;g=B;continue}B=P+F|0;c[546]=B;I=a[504]&1;if((F|0)>0){ax=I;ay=P}else{k=I;l=P;g=B;continue}while(1){I=a[ay]|0;if(I<<24>>24==0){az=1}else{az=c[856+((I&255)<<2)>>2]&255}if((ax-3|0)>>>0<48){c[206]=ax;c[208]=ay;aB=az;aC=ax}else{aB=az;aC=ax}L220:while(1){I=aB&255;i=aC;do{aD=(b[2216+(i<<1)>>1]|0)+I|0;if((b[1992+(aD<<1)>>1]|0)==(i|0)){break L220}j=b[1880+(i<<1)>>1]|0;i=j<<16>>16;}while(j<<16>>16<=51);aB=c[712+(I<<2)>>2]&255;aC=i}v=b[512+(aD<<1)>>1]|0;j=ay+1|0;if(j>>>0<B>>>0){ax=v;ay=j}else{k=v;l=P;g=B;continue L90}}}if((h|0)==82){h=0;c[m>>2]=(c[m>>2]|0)+1;continue}else if((h|0)==95){h=0;aE(c[614]|0,c[618]|0,1,c[616]|0)|0;continue}}if((h|0)==83){c[e>>2]=c[614];D=258;return D|0}else if((h|0)==84){c[e>>2]=c[614];D=259;return D|0}else if((h|0)==85){c[e>>2]=c[614];D=260;return D|0}else if((h|0)==86){c[e>>2]=c[614];D=261;return D|0}else if((h|0)==87){c[e>>2]=c[614];D=265;return D|0}else if((h|0)==88){c[e>>2]=c[614];D=266;return D|0}else if((h|0)==89){c[e>>2]=c[614];D=262;return D|0}else if((h|0)==90){c[e>>2]=c[614];D=263;return D|0}else if((h|0)==91){c[e>>2]=c[614];D=264;return D|0}else if((h|0)==92){c[e>>2]=c[614];D=(c[f+16>>2]|0)==0?267:268;return D|0}else if((h|0)==93){c[f+16>>2]=1;D=123;return D|0}else if((h|0)==94){c[f+16>>2]=0;D=125;return D|0}else if((h|0)==116){bw(2632);return 0}else if((h|0)==127){c[W>>2]=0;bw(2552);return 0}else if((h|0)==140){bw(2496);return 0}else if((h|0)==145){bw(2496);return 0}else if((h|0)==155){bw(3280);return 0}else if((h|0)==179){bw(2688);return 0}else if((h|0)==180){D=59;return D|0}else if((h|0)==183){bw(2552);return 0}else if((h|0)==184){return D|0}return 0}function bs(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=c[552]|0;if((d|0)==0){e=200}else{if((c[d+(c[548]<<2)>>2]|0)==0){e=200}else{f=d;e=202}}do{if((e|0)==200){bu();d=bv(c[620]|0,16384)|0;c[(c[552]|0)+(c[548]<<2)>>2]=d;d=c[552]|0;if((d|0)!=0){f=d;e=202;break}g=0;h=c[(aZ()|0)>>2]|0}}while(0);do{if((e|0)==202){d=c[f+(c[548]<<2)>>2]|0;i=c[(aZ()|0)>>2]|0;if((d|0)==0){g=0;h=i;break}c[d+16>>2]=0;j=d+4|0;a[c[j>>2]|0]=0;a[(c[j>>2]|0)+1|0]=0;c[d+8>>2]=c[j>>2];c[d+28>>2]=1;c[d+44>>2]=0;j=c[552]|0;if((j|0)==0){k=0}else{k=c[j+(c[548]<<2)>>2]|0}if((k|0)!=(d|0)){g=d;h=i;break}l=j+(c[548]<<2)|0;c[176]=c[(c[l>>2]|0)+16>>2];j=c[(c[l>>2]|0)+8>>2]|0;c[546]=j;c[614]=j;c[620]=c[c[l>>2]>>2];a[848]=a[j]|0;g=d;h=i}}while(0);c[g>>2]=b;c[g+40>>2]=1;k=c[552]|0;if((k|0)==0){m=0}else{m=c[k+(c[548]<<2)>>2]|0}if((m|0)!=(g|0)){c[g+32>>2]=1;c[g+36>>2]=0}if((b|0)==0){n=0}else{n=(aN(aV(b|0)|0)|0)>0&1}c[g+24>>2]=n;c[(aZ()|0)>>2]=h;h=(c[552]|0)+(c[548]<<2)|0;c[176]=c[(c[h>>2]|0)+16>>2];n=c[(c[h>>2]|0)+8>>2]|0;c[546]=n;c[614]=n;c[620]=c[c[h>>2]>>2];a[848]=a[n]|0;return}function bt(e){e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0;f=i;i=i+4024|0;g=f|0;h=f+8|0;j=f+408|0;k=e+12|0;l=e+20|0;m=e+4|0;n=e+8|0;o=e;q=f+1208|0;r=f+1464|0;s=f+1720|0;t=f+1976|0;u=f+2232|0;v=f+2488|0;w=f+2744|0;y=f+3e3|0;z=f+3256|0;A=f+3512|0;B=f+3768|0;C=-2;D=0;E=0;F=h;G=200;H=j;I=j;j=h;L290:while(1){b[j>>1]=D&65535;if((F+(G-1<<1)|0)>>>0>j>>>0){J=F;K=G;L=H;M=I;N=j}else{O=j-F>>1;P=O+1|0;if(G>>>0>9999){Q=285;break}R=G<<1;S=R>>>0>1e4?1e4:R;R=bS(S*6&-1|3)|0;if((R|0)==0){Q=285;break}T=R;U=R;V=F;W=P<<1;b_(R|0,V|0,W)|0;W=T+((S>>>1&1073741823)<<2)|0;T=W;R=I;X=P<<2;b_(T|0,R|0,X)|0;if((F|0)!=(h|0)){bT(V)}if((S-1|0)>(O|0)){J=U;K=S;L=W+(O<<2)|0;M=W;N=U+(O<<1)|0}else{Y=1;Z=U;break}}if((D|0)==8){Y=0;Z=J;break}U=a[D+392|0]|0;do{if((-413140012>>>(D>>>0)&1|0)==0){if((C|0)==-2){_=br(g,e)|0}else{_=C}do{if((_|0)<1){$=0;aa=0}else{if(_>>>0>=269){$=_;aa=2;break}$=_;aa=d[_+8|0]|0}}while(0);O=aa+U|0;if(O>>>0>39){ab=$;Q=234;break}if((a[O+464|0]|0)!=(aa|0)){ab=$;Q=234;break}W=a[O+280|0]|0;O=W&255;if(W<<24>>24==0){ac=$;ad=-O|0;Q=235;break}else{W=L+4|0;c[W>>2]=c[g>>2];ae=-2;af=O;ag=(E|0)==0?0:E-1|0;ah=W;ai=N;break}}else{ab=C;Q=234}}while(0);do{if((Q|0)==234){Q=0;if((413138987>>>(D>>>0)&1|0)==0){ac=ab;ad=d[D+432|0]|0;Q=235;break}do{if((E|0)==0){U=c[p>>2]|0;W=c[k>>2]|0;at(U|0,3120,(x=i,i=i+16|0,c[x>>2]=2528,c[x+8>>2]=W,x)|0)|0;c[l>>2]=1;aj=ab}else if((E|0)==3){if((ab|0)>=1){aj=-2;break}if((ab|0)==0){Y=1;Z=J;break L290}else{aj=ab}}else{aj=ab}}while(0);W=D;U=L;O=N;L323:while(1){do{if((-413140012>>>(W>>>0)&1|0)==0){S=(a[W+392|0]|0)+1|0;if(S>>>0>=40){break}if((a[S+464|0]|0)!=1){break}ak=a[S+280|0]|0;if(ak<<24>>24!=0){break L323}}}while(0);if((O|0)==(J|0)){Y=1;Z=J;break L290}S=O-2|0;W=b[S>>1]|0;U=U-4|0;O=S}W=U+4|0;c[W>>2]=c[g>>2];ae=aj;af=ak&255;ag=3;ah=W;ai=O}}while(0);L332:do{if((Q|0)==235){Q=0;W=d[ad+320|0]|0;S=L+(1-W<<2)|0;V=c[S>>2]|0;do{if((ad|0)==4){X=c[m>>2]|0;if((X|0)!=0){bT(X)}X=c[n>>2]|0;if((X|0)!=0){bT(X)}c[m>>2]=0;c[n>>2]=0}else if((ad|0)==5){X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=3176,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==6){X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=3208,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==7){bN(c[o>>2]|0,c[g>>2]|0)|0;X=aK(c[g>>2]|0)|0;c[n>>2]=X;if((X|0)!=0){break}aJ(q|0,3016,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=q,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==12){X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=2960,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==13){X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=2912,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==14){X=c[m>>2]|0;if((X|0)==0){R=c[p>>2]|0;T=c[k>>2]|0;at(R|0,3120,(x=i,i=i+16|0,c[x>>2]=2864,c[x+8>>2]=T,x)|0)|0;c[l>>2]=1;break}else{T=c[o>>2]|0;R=c[n>>2]|0;P=c[g>>2]|0;bO(T,R,P,X)|0;bT(c[m>>2]|0);c[m>>2]=0;break}}else if((ad|0)==15){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(r|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=r,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==16){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(s|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=s,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==17){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(t|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=t,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==18){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(u|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=u,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==19){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(v|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=v,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==20){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(w|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=w,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==21){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(y|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=y,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==22){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(z|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=z,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==23){X=aK(c[g>>2]|0)|0;c[m>>2]=X;if((X|0)!=0){break}aJ(A|0,2744,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=A,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1}else if((ad|0)==24){aJ(B|0,2600,(x=i,i=i+8|0,c[x>>2]=c[g>>2],x)|0)|0;X=c[k>>2]|0;at(c[p>>2]|0,3120,(x=i,i=i+16|0,c[x>>2]=B,c[x+8>>2]=X,x)|0)|0;c[l>>2]=1;c[m>>2]=0}}while(0);O=N+(-W<<1)|0;c[S>>2]=V;U=(d[ad+352|0]|0)-17|0;X=b[O>>1]|0;P=X+(a[U+384|0]|0)|0;do{if(P>>>0<40){if((a[P+464|0]|0)!=(X|0)){break}ae=ac;af=d[P+280|0]|0;ag=E;ah=S;ai=O;break L332}}while(0);ae=ac;af=a[U+424|0]|0;ag=E;ah=S;ai=O}}while(0);C=ae;D=af;E=ag;F=J;G=K;H=ah;I=M;j=ai+2|0}if((Q|0)==285){Q=c[p>>2]|0;ai=c[k>>2]|0;at(Q|0,3120,(x=i,i=i+16|0,c[x>>2]=3240,c[x+8>>2]=ai,x)|0)|0;c[l>>2]=1;Y=2;Z=F}if((Z|0)==(h|0)){i=f;return Y|0}bT(Z);i=f;return Y|0}function bu(){var a=0,b=0,d=0;a=c[552]|0;if((a|0)==0){b=bS(4)|0;d=b;c[552]=d;if((b|0)==0){bw(2784)}c[d>>2]=0;c[550]=1;c[548]=0;return}d=c[550]|0;if((c[548]|0)>>>0<(d-1|0)>>>0){return}b=d+8|0;d=bU(a,b<<2)|0;a=d;c[552]=a;if((d|0)==0){bw(2784)}bZ(a+(c[550]<<2)|0,0,32);c[550]=b;return}function bv(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;e=bS(48)|0;f=e;if((e|0)==0){bw(3072);return 0}c[e+12>>2]=d;g=bS(d+2|0)|0;d=e+4|0;c[d>>2]=g;if((g|0)==0){bw(3072);return 0}c[e+20>>2]=1;g=c[(aZ()|0)>>2]|0;c[e+16>>2]=0;a[c[d>>2]|0]=0;a[(c[d>>2]|0)+1|0]=0;c[e+8>>2]=c[d>>2];c[e+28>>2]=1;c[e+44>>2]=0;d=c[552]|0;if((d|0)==0){h=0}else{h=c[d+(c[548]<<2)>>2]|0}if((h|0)==(f|0)){h=d+(c[548]<<2)|0;c[176]=c[(c[h>>2]|0)+16>>2];d=c[(c[h>>2]|0)+8>>2]|0;c[546]=d;c[614]=d;c[620]=c[c[h>>2]>>2];a[848]=a[d]|0}c[e>>2]=b;c[e+40>>2]=1;d=c[552]|0;if((d|0)==0){i=0}else{i=c[d+(c[548]<<2)>>2]|0}if((i|0)!=(f|0)){c[e+32>>2]=1;c[e+36>>2]=0}if((b|0)==0){j=0;k=e+24|0;l=k;c[l>>2]=j;m=aZ()|0;c[m>>2]=g;return f|0}j=(aN(aV(b|0)|0)|0)>0&1;k=e+24|0;l=k;c[l>>2]=j;m=aZ()|0;c[m>>2]=g;return f|0}function bw(a){a=a|0;at(c[p>>2]|0,3008,(x=i,i=i+8|0,c[x>>2]=a,x)|0)|0;aI(2)}function bx(a,d){a=a|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;if((d|0)==0){e=0;return e|0}f=bS(16)|0;g=f;if((f|0)==0){e=0;return e|0}h=f;c[h>>2]=0;b[f+4>>1]=0;c[f+8>>2]=a;a=bS(12)|0;i=a;j=(a|0)==0;do{if(j){c[f+12>>2]=i}else{k=a+4|0;c[k>>2]=10;c[a+8>>2]=0;l=bS(40)|0;m=l;n=a;c[n>>2]=m;if((l|0)==0){bT(a);c[f+12>>2]=0;break}if((c[k>>2]|0)>0){c[m>>2]=0;if((c[k>>2]|0)>1){m=1;do{c[(c[n>>2]|0)+(m<<2)>>2]=0;m=m+1|0;}while((m|0)<(c[k>>2]|0))}k=f+12|0;c[k>>2]=i;o=k}else{k=f+12|0;c[k>>2]=i;if(j){break}else{o=k}}do{if((c[h>>2]|0)==0){k=bS((bY(d|0)|0)+1|0)|0;c[h>>2]=k;if((k|0)==0){p=c[o>>2]|0;break}b$(k|0,d|0)|0;e=g;return e|0}else{p=i}}while(0);if((c[p+8>>2]|0)==0){bT(c[p>>2]|0);bT(p)}bT(f);e=0;return e|0}}while(0);bT(f);e=0;return e|0}function by(a,c,d){a=a|0;c=c|0;d=d|0;var e=0,f=0,g=0;do{if((a|0)==0|(c|0)==0){e=-1}else{f=bS(2)|0;if((f|0)==0){e=-3;break}b[f>>1]=d;g=bI(a,c,2,f)|0;if((g|0)>=0){e=g;break}bT(f);e=g}}while(0);return e|0}function bz(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0;if((b|0)==0){return 0}d=c[b>>2]|0;if((d|0)!=0){bT(d)}d=b+12|0;e=c[d>>2]|0;f=c[e+8>>2]|0;if((f|0)==0){g=e}else{h=e|0;e=c[c[h>>2]>>2]|0;i=0;j=0;while(1){if((e|0)==0){k=c[h>>2]|0;l=j;do{l=l+1|0;m=c[k+(l<<2)>>2]|0;}while((m|0)==0);n=m;o=l}else{n=e;o=j}k=c[n+8>>2]|0;p=i+1|0;q=c[n>>2]|0;r=c[d>>2]|0;s=(q|0)==0;t=a[q]|0;if(t<<24>>24==0){u=0}else{v=0;w=0;x=t;while(1){t=x<<24>>24;y=(ac(t,t)|0)+v|0;t=w+1|0;z=a[q+t|0]|0;if(z<<24>>24==0){u=y;break}else{v=y;w=t;x=z}}}x=(c[r>>2]|0)+(((u|0)%(c[r+4>>2]|0)&-1)<<2)|0;w=c[x>>2]|0;v=w;L484:do{if((w|0)==0){A=0;B=370}else{l=v;z=v;while(1){if((a2(c[l>>2]|0,q|0)|0)==0){break}t=c[l+8>>2]|0;if((t|0)==0){A=0;B=370;break L484}else{z=l;l=t}}if((l|0)==0){A=0;B=370;break}t=l+8|0;y=c[t>>2]|0;if((l|0)==(v|0)){c[x>>2]=y}else{c[z+8>>2]=y}c[t>>2]=0;t=c[l+4>>2]|0;bT(l);y=r+8|0;c[y>>2]=(c[y>>2]|0)-1;if(s){C=t}else{A=t;B=370}}}while(0);if((B|0)==370){B=0;bT(q);C=A}s=c[C+4>>2]|0;if((s|0)!=0){bT(s)}if((C|0)!=0){bT(C)}if((p|0)==(f|0)){break}else{e=k;i=p;j=o}}g=c[d>>2]|0}if((c[g+8>>2]|0)==0){bT(c[g>>2]|0);bT(g)}bT(b);return 0}function bA(e,f,g,h){e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;i=(f|0)==0;if(!(h>>>0<g>>>0&(((e|0)==0|i|(g|0)==0)^1))){j=-1;return j|0}k=c[e>>2]|0;if((k|0)==0){j=-17;return j|0}l=bY(k|0)|0;if(i){j=-17;return j|0}if(!(l>>>0<255&(l|0)!=0)){j=-17;return j|0}i=l+1|0;if((g-h|0)>>>0<i>>>0){j=-17;return j|0}a[f+h|0]=l&255;m=h+1|0;n=f+m|0;b_(n|0,k|0,l)|0;k=l+m|0;if((i|0)==0){j=-17;return j|0}i=b[e+4>>1]|0;if((g-k|0)>>>0<=1){j=-16;return j|0}a[f+k|0]=(i&65535)>>>8&255;a[f+(k+1)|0]=i&255;i=e+12|0;e=c[i>>2]|0;m=k+2|0;l=c[(c[e>>2]|0)+((32102%(c[e+4>>2]|0)&-1)<<2)>>2]|0;L531:do{if((l|0)==0){o=m;p=e}else{n=l;while(1){if((a2(c[n>>2]|0,3e3)|0)==0){break}q=c[n+8>>2]|0;if((q|0)==0){o=m;p=e;break L531}else{n=q}}if((n|0)==0){o=m;p=e;break}q=c[n+4>>2]|0;if((q|0)==0){o=m;p=e;break}r=c[q+4>>2]|0;if((r|0)==0){j=-4;return j|0}s=(a[q]|0)!=2;if(s){j=s?-3:-2;return j|0}if((g-m|0)>>>0<4){j=-2;return j|0}a[f+m|0]=3;s=f+(k+3)|0;a[s]=a[3e3]|0;a[s+1|0]=a[3001|0]|0;a[s+2|0]=a[3002|0]|0;s=k+6|0;if((s|0)==(g|0)){j=-2;return j|0}a[f+s|0]=2;s=k+7|0;q=b[r>>1]|0;if((g-s|0)>>>0>1){a[f+s|0]=(q&65535)>>>8&255;a[f+(k+8)|0]=q&255;o=k+9|0;p=c[i>>2]|0;break}else{j=-2;return j|0}}}while(0);do{if((p|0)==0){t=o}else{k=c[p+8>>2]|0;if((k|0)==0){t=o;break}m=p|0;e=p+4|0;l=o;q=c[c[m>>2]>>2]|0;s=0;r=0;L558:while(1){L560:do{if((q|0)==0){u=c[e>>2]|0;v=r;w=0;while(1){x=v+1|0;if((x|0)>=(u|0)){y=0;z=x;A=s;B=w;break L560}C=c[(c[m>>2]|0)+(x<<2)>>2]|0;D=C;if((C|0)==0){v=x;w=D}else{E=D;F=x;G=409;break}}}else{E=q;F=r;G=409}}while(0);if((G|0)==409){G=0;y=c[E>>2]|0;z=F;A=s+1|0;B=c[E+8>>2]|0}do{if((a2(y|0,3e3)|0)==0){H=0;I=l}else{w=c[i>>2]|0;v=a[y]|0;if(v<<24>>24==0){J=0}else{u=0;x=0;D=v;while(1){v=D<<24>>24;C=(ac(v,v)|0)+u|0;v=x+1|0;K=a[y+v|0]|0;if(K<<24>>24==0){J=C;break}else{u=C;x=v;D=K}}}D=c[(c[w>>2]|0)+(((J|0)%(c[w+4>>2]|0)&-1)<<2)>>2]|0;L574:do{if((D|0)==0){L=0}else{x=D;while(1){if((a2(c[x>>2]|0,y|0)|0)==0){break}u=c[x+8>>2]|0;if((u|0)==0){L=0;break L574}else{x=u}}if((x|0)==0){L=0;break}L=c[x+4>>2]|0}}while(0);if((y|0)==0){j=-5;G=460;break L558}D=bY(y|0)|0;if(!(D>>>0<255&(D|0)!=0)){j=-5;G=461;break L558}w=D+1|0;if((g-l|0)>>>0<w>>>0){j=-5;G=462;break L558}a[f+l|0]=D&255;u=l+1|0;K=f+u|0;b_(K|0,y|0,D)|0;K=D+u|0;if((w|0)==0){j=-5;G=463;break L558}if((K|0)==(g|0)){j=-6;G=464;break L558}a[f+K|0]=a[L]|0;w=K+1|0;u=a[L]|0;if((u<<24>>24|0)==7){D=c[L+4>>2]|0;v=c[D>>2]|0;C=c[D+4>>2]|0;if((g-w|0)>>>0<=7){j=-12;G=449;break L558}a[f+w|0]=(C>>>24|0<<8)&255;a[f+(K+2)|0]=(C>>>16|0<<16)&255;a[f+(K+3)|0]=(C>>>8|0<<24)&255;a[f+(K+4)|0]=C&255;a[f+(K+5)|0]=(v>>>24|C<<8)&255;a[f+(K+6)|0]=(v>>>16|C<<16)&255;a[f+(K+7)|0]=(v>>>8|C<<24)&255;a[f+(K+8)|0]=v&255;H=0;I=K+9|0;break}else if((u<<24>>24|0)==9){if((w|0)==(g|0)){j=-13;G=450;break L558}a[f+w|0]=c[c[L+4>>2]>>2]&255;H=0;I=K+2|0;break}else if((u<<24>>24|0)==6){if((g-w|0)>>>0<=3){j=-14;G=451;break L558}v=c[L+4>>2]|0;C=ao(d[v]|d[v+1|0]<<8|d[v+2|0]<<16|d[v+3|0]<<24|0)|0;a[f+(K+4)|0]=C>>>24&255;a[f+(K+3)|0]=C>>>16&255;a[f+(K+2)|0]=C>>>8&255;a[f+w|0]=C&255;H=0;I=K+5|0;break}else if((u<<24>>24|0)==5){C=c[L+4>>2]|0;if((C|0)==0){j=-15;G=452;break L558}v=bY(C|0)|0;if(v>>>0>=65535){j=-15;G=453;break L558}D=v+2|0;if((g-w|0)>>>0<D>>>0){j=-15;G=454;break L558}a[f+w|0]=v>>>8&255;a[f+(K+2)|0]=v&255;M=K+3|0;N=f+M|0;b_(N|0,C|0,v)|0;H=(D|0)==0?-15:0;I=v+M|0;break}else if((u<<24>>24|0)==3){M=c[c[L+4>>2]>>2]|0;if((g-w|0)>>>0<=3){j=-9;G=457;break L558}a[f+w|0]=M>>>24&255;a[f+(K+2)|0]=M>>>16&255;a[f+(K+3)|0]=M>>>8&255;a[f+(K+4)|0]=M&255;H=0;I=K+5|0;break}else if((u<<24>>24|0)==4){M=c[c[L+4>>2]>>2]|0;if((g-w|0)>>>0<=3){j=-10;G=458;break L558}a[f+w|0]=M>>>24&255;a[f+(K+2)|0]=M>>>16&255;a[f+(K+3)|0]=M>>>8&255;a[f+(K+4)|0]=M&255;H=0;I=K+5|0;break}else if((u<<24>>24|0)==8){M=c[L+4>>2]|0;v=c[M>>2]|0;D=c[M+4>>2]|0;if((g-w|0)>>>0<=7){j=-11;G=459;break L558}a[f+w|0]=(D>>>24|0<<8)&255;a[f+(K+2)|0]=(D>>>16|0<<16)&255;a[f+(K+3)|0]=(D>>>8|0<<24)&255;a[f+(K+4)|0]=D&255;a[f+(K+5)|0]=(v>>>24|D<<8)&255;a[f+(K+6)|0]=(v>>>16|D<<16)&255;a[f+(K+7)|0]=(v>>>8|D<<24)&255;a[f+(K+8)|0]=v&255;H=0;I=K+9|0;break}else if((u<<24>>24|0)==1){v=b[c[L+4>>2]>>1]|0;if((g-w|0)>>>0<=1){j=-7;G=465;break L558}a[f+w|0]=(v&65535)>>>8&255;a[f+(K+2)|0]=v&255;H=0;I=K+3|0;break}else if((u<<24>>24|0)==2){u=b[c[L+4>>2]>>1]|0;if((g-w|0)>>>0<=1){j=-8;G=466;break L558}a[f+w|0]=(u&65535)>>>8&255;a[f+(K+2)|0]=u&255;H=0;I=K+3|0;break}else{H=0;I=w;break}}}while(0);if((A|0)!=(k|0)&(H|0)==0){l=I;q=B;s=A;r=z}else{G=446;break}}if((G|0)==446){if((H|0)<0){j=H}else{t=I;break}return j|0}else if((G|0)==449){return j|0}else if((G|0)==450){return j|0}else if((G|0)==451){return j|0}else if((G|0)==452){return j|0}else if((G|0)==453){return j|0}else if((G|0)==454){return j|0}else if((G|0)==457){return j|0}else if((G|0)==458){return j|0}else if((G|0)==459){return j|0}else if((G|0)==460){return j|0}else if((G|0)==461){return j|0}else if((G|0)==462){return j|0}else if((G|0)==463){return j|0}else if((G|0)==464){return j|0}else if((G|0)==465){return j|0}else if((G|0)==466){return j|0}}}while(0);j=t-h|0;return j|0}function bB(a,c,d){a=a|0;c=c|0;d=d|0;var e=0,f=0,g=0;do{if((a|0)==0|(c|0)==0){e=-1}else{f=bS(2)|0;if((f|0)==0){e=-3;break}b[f>>1]=d;g=bI(a,c,1,f)|0;if((g|0)>=0){e=g;break}bT(f);e=g}}while(0);return e|0}function bC(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;do{if((a|0)==0|(b|0)==0){e=-1}else{f=bS(4)|0;if((f|0)==0){e=-3;break}c[f>>2]=d;g=bI(a,b,3,f)|0;if((g|0)>=0){e=g;break}bT(f);e=g}}while(0);return e|0}function bD(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;do{if((a|0)==0|(b|0)==0){e=-1}else{f=bS(4)|0;if((f|0)==0){e=-3;break}c[f>>2]=d;g=bI(a,b,4,f)|0;if((g|0)>=0){e=g;break}bT(f);e=g}}while(0);return e|0}function bE(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((a|0)==0|(b|0)==0){f=-1;return f|0}g=bS(8)|0;if((g|0)==0){f=-3;return f|0}h=g;c[h>>2]=d;c[h+4>>2]=e;e=bI(a,b,8,g)|0;if((e|0)>=0){f=e;return f|0}bT(g);f=e;return f|0}function bF(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((a|0)==0|(b|0)==0){f=-1;return f|0}g=bS(8)|0;if((g|0)==0){f=-3;return f|0}h=g;c[h>>2]=d;c[h+4>>2]=e;e=bI(a,b,7,g)|0;if((e|0)>=0){f=e;return f|0}bT(g);f=e;return f|0}function bG(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;do{if((a|0)==0|(b|0)==0){e=-1}else{f=bS(4)|0;if((f|0)==0){e=-3;break}c[f>>2]=d;g=bI(a,b,9,f)|0;if((g|0)>=0){e=g;break}bT(f);e=g}}while(0);return e|0}function bH(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0;if((a|0)==0|(b|0)==0|(c|0)==0){d=-1;return d|0}e=bS((bY(c|0)|0)+1|0)|0;if((e|0)==0){d=-3;return d|0}b$(e|0,c|0)|0;c=bI(a,b,5,e)|0;if((c|0)>=0){d=c;return d|0}bT(e);d=c;return d|0}function bI(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0;h=c[d+8>>2]|0;do{if((h|0)!=0){i=c[d>>2]|0;if((bP(h,e,i)|0)==0){j=-1;return j|0}k=bQ(h,e,i)|0;if(k<<24>>24!=0&k<<24>>24==f<<24>>24){break}else{j=-2}return j|0}}while(0);h=bS((bY(e|0)|0)+1|0)|0;if((h|0)==0){j=-3;return j|0}a[h]=0;b0(h|0,e|0)|0;e=bS(8)|0;if((e|0)==0){bT(h);j=-3;return j|0}a[e]=f;c[e+4>>2]=g;g=c[d+12>>2]|0;do{if((g|0)==0){l=-1}else{f=bS(12)|0;k=f;if((f|0)==0){l=-3;break}c[f>>2]=h;c[f+4>>2]=e;c[f+8>>2]=0;i=a[h]|0;if(i<<24>>24==0){m=0}else{n=0;o=0;p=i;while(1){i=p<<24>>24;q=(ac(i,i)|0)+n|0;i=o+1|0;r=a[h+i|0]|0;if(r<<24>>24==0){m=q;break}else{n=q;o=i;p=r}}}p=(c[g>>2]|0)+(((m|0)%(c[g+4>>2]|0)&-1)<<2)|0;o=c[p>>2]|0;if((o|0)==0){c[p>>2]=f}else{p=o;do{s=p+8|0;p=c[s>>2]|0;}while((p|0)!=0);c[s>>2]=k}p=g+8|0;c[p>>2]=(c[p>>2]|0)+1;p=d+4|0;f=(b[p>>1]|0)+1&65535;b[p>>1]=f;j=f&65535;return j|0}}while(0);bT(e);bT(h);j=l;return j|0}function bJ(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0;e=i;i=i+8|0;f=e|0;do{if((a|0)==0|(b|0)==0|(d|0)==0){g=-1}else{c[(aZ()|0)>>2]=0;h=av(d|0,f|0,16)|0;j=G;if((c[(aZ()|0)>>2]|0)==34){g=-2;break}k=bY(d|0)|0;l=(k|0)>((c[f>>2]|0)-d|0);if(l){g=l?-2:-1;break}l=bS(8)|0;if((l|0)==0){g=-3;break}k=l;c[k>>2]=h;c[k+4>>2]=j;j=bI(a,b,8,l)|0;if((j|0)>=0){g=j;break}bT(l);g=j}}while(0);i=e;return g|0}function bK(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0;e=i;i=i+8|0;f=e|0;do{if((a|0)==0|(b|0)==0|(d|0)==0){g=-1}else{c[(aZ()|0)>>2]=0;h=av(d|0,f|0,16)|0;j=G;if((c[(aZ()|0)>>2]|0)==34){g=-2;break}k=bY(d|0)|0;l=(k|0)>((c[f>>2]|0)-d|0);if(l){g=l?-2:-1;break}l=bS(8)|0;if((l|0)==0){g=-3;break}k=l;c[k>>2]=h;c[k+4>>2]=j;j=bI(a,b,7,l)|0;if((j|0)>=0){g=j;break}bT(l);g=j}}while(0);i=e;return g|0}function bL(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;if((a|0)==0|(b|0)==0|(d|0)==0){e=-1;return e|0}f=bS(4)|0;if((f|0)==0){e=-3;return e|0}c[f>>2]=aF(d|0)|0;d=bI(a,b,6,f)|0;if((d|0)>=0){e=d;return e|0}bT(f);e=d;return e|0}function bM(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,q=0;d=i;i=i+24|0;e=d|0;f=bS(1028)|0;g=f;if((f|0)==0){h=g;i=d;return h|0}a[f]=0;b0(f|0,b|0)|0;b=bS(12)|0;j=b;k=(b|0)==0;do{if(k){c[f+1024>>2]=j}else{l=b+4|0;c[l>>2]=10;c[b+8>>2]=0;m=bS(40)|0;n=m;o=b;c[o>>2]=n;if((m|0)==0){bT(b);c[f+1024>>2]=0;break}if((c[l>>2]|0)>0){c[n>>2]=0;if((c[l>>2]|0)>1){n=1;do{c[(c[o>>2]|0)+(n<<2)>>2]=0;n=n+1|0;}while((n|0)<(c[l>>2]|0))}c[f+1024>>2]=j}else{c[f+1024>>2]=j;if(k){break}}c[e>>2]=g;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=1;c[e+16>>2]=0;l=e+20|0;c[l>>2]=0;n=ax(f|0,3200)|0;if((n|0)==0){o=c[p>>2]|0;at(o|0,3144,(x=i,i=i+8|0,c[x>>2]=f,x)|0)|0;o=(c[l>>2]|0)+1|0;c[l>>2]=o;q=o}else{c[620]=n;bs(n);bt(e)|0;ar(n|0)|0;q=c[l>>2]|0}if((q|0)==0){h=g;i=d;return h|0}bT(f);h=0;i=d;return h|0}}while(0);bT(f);h=0;i=d;return h|0}function bN(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;e=bS((bY(d|0)|0)+1|0)|0;if((e|0)==0){f=-3;return f|0}b$(e|0,d|0)|0;d=bS(12)|0;do{if((d|0)!=0){g=d+4|0;c[g>>2]=10;h=d+8|0;c[h>>2]=0;i=bS(40)|0;j=i;k=d;c[k>>2]=j;if((i|0)==0){bT(d);break}do{if((c[g>>2]|0)>0){c[j>>2]=0;if((c[g>>2]|0)>1){l=1}else{break}do{c[(c[k>>2]|0)+(l<<2)>>2]=0;l=l+1|0;}while((l|0)<(c[g>>2]|0))}}while(0);g=c[b+1024>>2]|0;do{if((g|0)==0){m=-1}else{j=bS(12)|0;i=j;if((j|0)==0){m=-3;break}c[j>>2]=e;c[j+4>>2]=d;c[j+8>>2]=0;n=a[e]|0;if(n<<24>>24==0){o=0}else{p=0;q=0;r=n;while(1){n=r<<24>>24;s=(ac(n,n)|0)+p|0;n=q+1|0;t=a[e+n|0]|0;if(t<<24>>24==0){o=s;break}else{p=s;q=n;r=t}}}r=(c[g>>2]|0)+(((o|0)%(c[g+4>>2]|0)&-1)<<2)|0;q=c[r>>2]|0;if((q|0)==0){c[r>>2]=j}else{r=q;do{u=r+8|0;r=c[u>>2]|0;}while((r|0)!=0);c[u>>2]=i}r=g+8|0;c[r>>2]=(c[r>>2]|0)+1;f=0;return f|0}}while(0);bT(e);if((c[h>>2]|0)!=0){f=m;return f|0}bT(c[k>>2]|0);bT(d);f=m;return f|0}}while(0);bT(e);f=-3;return f|0}function bO(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;g=c[b+1024>>2]|0;b=a[d]|0;if(b<<24>>24==0){h=0}else{i=0;j=0;k=b;while(1){b=k<<24>>24;l=(ac(b,b)|0)+i|0;b=j+1|0;m=a[d+b|0]|0;if(m<<24>>24==0){h=l;break}else{i=l;j=b;k=m}}}k=c[(c[g>>2]|0)+(((h|0)%(c[g+4>>2]|0)&-1)<<2)>>2]|0;L815:do{if((k|0)==0){n=0}else{g=k;while(1){if((a2(c[g>>2]|0,d|0)|0)==0){break}h=c[g+8>>2]|0;if((h|0)==0){n=0;break L815}else{g=h}}if((g|0)==0){n=0;break}n=c[g+4>>2]|0}}while(0);d=bS((bY(e|0)|0)+1|0)|0;if((d|0)==0){o=-3;return o|0}b$(d|0,e|0)|0;e=bS(1)|0;if((e|0)==0){bT(d);o=-3;return o|0}do{if((a2(f|0,3232)|0)==0){a[e]=1}else{if((a2(f|0,3056)|0)==0){a[e]=2;break}if((a2(f|0,2984)|0)==0){a[e]=3;break}if((a2(f|0,2944)|0)==0){a[e]=4;break}if((a2(f|0,2544)|0)==0){a[e]=8;break}if((a2(f|0,2624)|0)==0){a[e]=7;break}if((a2(f|0,2488)|0)==0){a[e]=9;break}if((a2(f|0,2776)|0)==0){a[e]=6;break}if((a2(f|0,2896)|0)!=0){break}a[e]=5}}while(0);do{if((n|0)==0){p=-1}else{f=bS(12)|0;k=f;if((f|0)==0){p=-3;break}c[f>>2]=d;c[f+4>>2]=e;c[f+8>>2]=0;h=a[d]|0;if(h<<24>>24==0){q=0}else{j=0;i=0;m=h;while(1){h=m<<24>>24;b=(ac(h,h)|0)+j|0;h=i+1|0;l=a[d+h|0]|0;if(l<<24>>24==0){q=b;break}else{j=b;i=h;m=l}}}m=(c[n>>2]|0)+(((q|0)%(c[n+4>>2]|0)&-1)<<2)|0;i=c[m>>2]|0;if((i|0)==0){c[m>>2]=f}else{m=i;do{r=m+8|0;m=c[r>>2]|0;}while((m|0)!=0);c[r>>2]=k}m=n+8|0;c[m>>2]=(c[m>>2]|0)+1;o=0;return o|0}}while(0);bT(d);bT(e);o=p;return o|0}function bP(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;f=c[b+1024>>2]|0;b=a[e]|0;if(b<<24>>24==0){g=0}else{h=0;i=0;j=b;while(1){b=j<<24>>24;k=(ac(b,b)|0)+h|0;b=i+1|0;l=a[e+b|0]|0;if(l<<24>>24==0){g=k;break}else{h=k;i=b;j=l}}}j=c[f+4>>2]|0;i=c[f>>2]|0;f=c[i+(((g|0)%(j|0)&-1)<<2)>>2]|0;L878:do{if((f|0)==0){m=0}else{g=f;while(1){if((a2(c[g>>2]|0,e|0)|0)==0){break}h=c[g+8>>2]|0;if((h|0)==0){m=0;break L878}else{g=h}}if((g|0)==0){m=0;break}m=c[g+4>>2]|0}}while(0);e=c[i+((133591%(j|0)&-1)<<2)>>2]|0;L886:do{if((e|0)==0){n=0}else{j=e;while(1){if((a2(c[j>>2]|0,3264)|0)==0){break}i=c[j+8>>2]|0;if((i|0)==0){n=0;break L886}else{j=i}}if((j|0)==0){n=0;break}n=c[j+4>>2]|0}}while(0);L894:do{if((m|0)==0){o=0}else{e=a[d]|0;if(e<<24>>24==0){p=0}else{g=0;i=0;f=e;while(1){e=f<<24>>24;h=(ac(e,e)|0)+g|0;e=i+1|0;l=a[d+e|0]|0;if(l<<24>>24==0){p=h;break}else{g=h;i=e;f=l}}}f=c[(c[m>>2]|0)+(((p|0)%(c[m+4>>2]|0)&-1)<<2)>>2]|0;if((f|0)==0){o=0;break}i=f;while(1){if((a2(c[i>>2]|0,d|0)|0)==0){break}f=c[i+8>>2]|0;if((f|0)==0){o=0;break L894}else{i=f}}o=(i|0)!=0&1}}while(0);L906:do{if((n|0)!=0){m=a[d]|0;if(m<<24>>24==0){q=0}else{p=0;f=0;g=m;while(1){m=g<<24>>24;j=(ac(m,m)|0)+p|0;m=f+1|0;l=a[d+m|0]|0;if(l<<24>>24==0){q=j;break}else{p=j;f=m;g=l}}}g=c[(c[n>>2]|0)+(((q|0)%(c[n+4>>2]|0)&-1)<<2)>>2]|0;if((g|0)==0){break}f=g;while(1){if((a2(c[f>>2]|0,d|0)|0)==0){break}g=c[f+8>>2]|0;if((g|0)==0){break L906}else{f=g}}if((f|0)==0){break}else{r=1}return r|0}}while(0);r=o;return r|0}function bQ(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=c[b+1024>>2]|0;b=a[e]|0;if(b<<24>>24==0){g=0}else{h=0;i=0;j=b;while(1){b=j<<24>>24;k=(ac(b,b)|0)+h|0;b=i+1|0;l=a[e+b|0]|0;if(l<<24>>24==0){g=k;break}else{h=k;i=b;j=l}}}j=c[f+4>>2]|0;i=c[f>>2]|0;f=c[i+(((g|0)%(j|0)&-1)<<2)>>2]|0;L925:do{if((f|0)==0){m=0}else{g=f;while(1){if((a2(c[g>>2]|0,e|0)|0)==0){break}h=c[g+8>>2]|0;if((h|0)==0){m=0;break L925}else{g=h}}if((g|0)==0){m=0;break}m=c[g+4>>2]|0}}while(0);e=c[i+((133591%(j|0)&-1)<<2)>>2]|0;L933:do{if((e|0)==0){n=0}else{j=e;while(1){if((a2(c[j>>2]|0,3264)|0)==0){break}i=c[j+8>>2]|0;if((i|0)==0){n=0;break L933}else{j=i}}if((j|0)==0){n=0;break}n=c[j+4>>2]|0}}while(0);L941:do{if((m|0)==0){o=0}else{e=a[d]|0;if(e<<24>>24==0){p=0}else{g=0;i=0;f=e;while(1){e=f<<24>>24;h=(ac(e,e)|0)+g|0;e=i+1|0;l=a[d+e|0]|0;if(l<<24>>24==0){p=h;break}else{g=h;i=e;f=l}}}f=c[(c[m>>2]|0)+(((p|0)%(c[m+4>>2]|0)&-1)<<2)>>2]|0;if((f|0)==0){o=0;break}i=f;while(1){if((a2(c[i>>2]|0,d|0)|0)==0){break}f=c[i+8>>2]|0;if((f|0)==0){o=0;break L941}else{i=f}}if((i|0)==0){o=0;break}o=c[i+4>>2]|0}}while(0);do{if((o|0)!=0|(n|0)==0){q=o}else{m=a[d]|0;if(m<<24>>24==0){r=0}else{p=0;f=0;g=m;while(1){m=g<<24>>24;j=(ac(m,m)|0)+p|0;m=f+1|0;l=a[d+m|0]|0;if(l<<24>>24==0){r=j;break}else{p=j;f=m;g=l}}}g=c[(c[n>>2]|0)+(((r|0)%(c[n+4>>2]|0)&-1)<<2)>>2]|0;if((g|0)==0){s=0;return s|0}f=g;while(1){if((a2(c[f>>2]|0,d|0)|0)==0){break}g=c[f+8>>2]|0;if((g|0)==0){s=0;t=734;break}else{f=g}}if((t|0)==734){return s|0}if((f|0)==0){s=0;return s|0}else{q=c[f+4>>2]|0;break}}}while(0);if((q|0)==0){s=0;return s|0}s=a[q]|0;return s|0}function bR(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;h=i;i=i+16|0;j=h|0;k=h+8|0;if((d|0)==0){l=-1;i=h;return l|0}m=d+4|0;bZ(m|0,0,20);c[m>>2]=1;m=aF(e|0)|0;e=d+12|0;c[e>>2]=m;b[d+8>>1]=az(g&65535|0)|0;c[d+56>>2]=0;c[d+24>>2]=m;m=(f|0)==0;do{if(m){n=742}else{if((a[f]|0)==0){n=742;break}c[d+28>>2]=aF(f|0)|0}}while(0);if((n|0)==742){c[d+28>>2]=ao(0)|0}n=aX(1,20,0)|0;c[d>>2]=n;if((n|0)<0){l=-2;i=h;return l|0}do{if(!(((ao(c[e>>2]|0)|0)&-268435456|0)!=-536870912|m)){c[k>>2]=aF(f|0)|0;o;if((o|0)<0){l=-3}else{break}i=h;return l|0}}while(0);o=10;while(1){if((o|0)<=0){break}c[j>>2]=o*65507&-1;p;if((p|0)==0){break}else{o=o-1|0}}if((o|0)==0){l=-4;i=h;return l|0}c[d+52>>2]=20;l=0;i=h;return l|0}function bS(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aI=0;do{if(a>>>0<245){if(a>>>0<11){b=16}else{b=a+11&-8}d=b>>>3;e=c[836]|0;f=e>>>(d>>>0);if((f&3|0)!=0){g=(f&1^1)+d|0;h=g<<1;i=3384+(h<<2)|0;j=3384+(h+2<<2)|0;h=c[j>>2]|0;k=h+8|0;l=c[k>>2]|0;do{if((i|0)==(l|0)){c[836]=e&(1<<g^-1)}else{if(l>>>0<(c[840]|0)>>>0){as();return 0;return 0}m=l+12|0;if((c[m>>2]|0)==(h|0)){c[m>>2]=i;c[j>>2]=l;break}else{as();return 0;return 0}}}while(0);l=g<<3;c[h+4>>2]=l|3;j=h+(l|4)|0;c[j>>2]=c[j>>2]|1;n=k;return n|0}if(b>>>0<=(c[838]|0)>>>0){o=b;break}if((f|0)!=0){j=2<<d;l=f<<d&(j|-j);j=(l&-l)-1|0;l=j>>>12&16;i=j>>>(l>>>0);j=i>>>5&8;m=i>>>(j>>>0);i=m>>>2&4;p=m>>>(i>>>0);m=p>>>1&2;q=p>>>(m>>>0);p=q>>>1&1;r=(j|l|i|m|p)+(q>>>(p>>>0))|0;p=r<<1;q=3384+(p<<2)|0;m=3384+(p+2<<2)|0;p=c[m>>2]|0;i=p+8|0;l=c[i>>2]|0;do{if((q|0)==(l|0)){c[836]=e&(1<<r^-1)}else{if(l>>>0<(c[840]|0)>>>0){as();return 0;return 0}j=l+12|0;if((c[j>>2]|0)==(p|0)){c[j>>2]=q;c[m>>2]=l;break}else{as();return 0;return 0}}}while(0);l=r<<3;m=l-b|0;c[p+4>>2]=b|3;q=p;e=q+b|0;c[q+(b|4)>>2]=m|1;c[q+l>>2]=m;l=c[838]|0;if((l|0)!=0){q=c[841]|0;d=l>>>3;l=d<<1;f=3384+(l<<2)|0;k=c[836]|0;h=1<<d;do{if((k&h|0)==0){c[836]=k|h;s=f;t=3384+(l+2<<2)|0}else{d=3384+(l+2<<2)|0;g=c[d>>2]|0;if(g>>>0>=(c[840]|0)>>>0){s=g;t=d;break}as();return 0;return 0}}while(0);c[t>>2]=q;c[s+12>>2]=q;c[q+8>>2]=s;c[q+12>>2]=f}c[838]=m;c[841]=e;n=i;return n|0}l=c[837]|0;if((l|0)==0){o=b;break}h=(l&-l)-1|0;l=h>>>12&16;k=h>>>(l>>>0);h=k>>>5&8;p=k>>>(h>>>0);k=p>>>2&4;r=p>>>(k>>>0);p=r>>>1&2;d=r>>>(p>>>0);r=d>>>1&1;g=c[3648+((h|l|k|p|r)+(d>>>(r>>>0))<<2)>>2]|0;r=g;d=g;p=(c[g+4>>2]&-8)-b|0;while(1){g=c[r+16>>2]|0;if((g|0)==0){k=c[r+20>>2]|0;if((k|0)==0){break}else{u=k}}else{u=g}g=(c[u+4>>2]&-8)-b|0;k=g>>>0<p>>>0;r=u;d=k?u:d;p=k?g:p}r=d;i=c[840]|0;if(r>>>0<i>>>0){as();return 0;return 0}e=r+b|0;m=e;if(r>>>0>=e>>>0){as();return 0;return 0}e=c[d+24>>2]|0;f=c[d+12>>2]|0;do{if((f|0)==(d|0)){q=d+20|0;g=c[q>>2]|0;if((g|0)==0){k=d+16|0;l=c[k>>2]|0;if((l|0)==0){v=0;break}else{w=l;x=k}}else{w=g;x=q}while(1){q=w+20|0;g=c[q>>2]|0;if((g|0)!=0){w=g;x=q;continue}q=w+16|0;g=c[q>>2]|0;if((g|0)==0){break}else{w=g;x=q}}if(x>>>0<i>>>0){as();return 0;return 0}else{c[x>>2]=0;v=w;break}}else{q=c[d+8>>2]|0;if(q>>>0<i>>>0){as();return 0;return 0}g=q+12|0;if((c[g>>2]|0)!=(d|0)){as();return 0;return 0}k=f+8|0;if((c[k>>2]|0)==(d|0)){c[g>>2]=f;c[k>>2]=q;v=f;break}else{as();return 0;return 0}}}while(0);L1080:do{if((e|0)!=0){f=d+28|0;i=3648+(c[f>>2]<<2)|0;do{if((d|0)==(c[i>>2]|0)){c[i>>2]=v;if((v|0)!=0){break}c[837]=c[837]&(1<<c[f>>2]^-1);break L1080}else{if(e>>>0<(c[840]|0)>>>0){as();return 0;return 0}q=e+16|0;if((c[q>>2]|0)==(d|0)){c[q>>2]=v}else{c[e+20>>2]=v}if((v|0)==0){break L1080}}}while(0);if(v>>>0<(c[840]|0)>>>0){as();return 0;return 0}c[v+24>>2]=e;f=c[d+16>>2]|0;do{if((f|0)!=0){if(f>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[v+16>>2]=f;c[f+24>>2]=v;break}}}while(0);f=c[d+20>>2]|0;if((f|0)==0){break}if(f>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[v+20>>2]=f;c[f+24>>2]=v;break}}}while(0);if(p>>>0<16){e=p+b|0;c[d+4>>2]=e|3;f=r+(e+4)|0;c[f>>2]=c[f>>2]|1}else{c[d+4>>2]=b|3;c[r+(b|4)>>2]=p|1;c[r+(p+b)>>2]=p;f=c[838]|0;if((f|0)!=0){e=c[841]|0;i=f>>>3;f=i<<1;q=3384+(f<<2)|0;k=c[836]|0;g=1<<i;do{if((k&g|0)==0){c[836]=k|g;y=q;z=3384+(f+2<<2)|0}else{i=3384+(f+2<<2)|0;l=c[i>>2]|0;if(l>>>0>=(c[840]|0)>>>0){y=l;z=i;break}as();return 0;return 0}}while(0);c[z>>2]=e;c[y+12>>2]=e;c[e+8>>2]=y;c[e+12>>2]=q}c[838]=p;c[841]=m}f=d+8|0;if((f|0)==0){o=b;break}else{n=f}return n|0}else{if(a>>>0>4294967231){o=-1;break}f=a+11|0;g=f&-8;k=c[837]|0;if((k|0)==0){o=g;break}r=-g|0;i=f>>>8;do{if((i|0)==0){A=0}else{if(g>>>0>16777215){A=31;break}f=(i+1048320|0)>>>16&8;l=i<<f;h=(l+520192|0)>>>16&4;j=l<<h;l=(j+245760|0)>>>16&2;B=14-(h|f|l)+(j<<l>>>15)|0;A=g>>>((B+7|0)>>>0)&1|B<<1}}while(0);i=c[3648+(A<<2)>>2]|0;L1128:do{if((i|0)==0){C=0;D=r;E=0}else{if((A|0)==31){F=0}else{F=25-(A>>>1)|0}d=0;m=r;p=i;q=g<<F;e=0;while(1){B=c[p+4>>2]&-8;l=B-g|0;if(l>>>0<m>>>0){if((B|0)==(g|0)){C=p;D=l;E=p;break L1128}else{G=p;H=l}}else{G=d;H=m}l=c[p+20>>2]|0;B=c[p+16+(q>>>31<<2)>>2]|0;j=(l|0)==0|(l|0)==(B|0)?e:l;if((B|0)==0){C=G;D=H;E=j;break}else{d=G;m=H;p=B;q=q<<1;e=j}}}}while(0);if((E|0)==0&(C|0)==0){i=2<<A;r=k&(i|-i);if((r|0)==0){o=g;break}i=(r&-r)-1|0;r=i>>>12&16;e=i>>>(r>>>0);i=e>>>5&8;q=e>>>(i>>>0);e=q>>>2&4;p=q>>>(e>>>0);q=p>>>1&2;m=p>>>(q>>>0);p=m>>>1&1;I=c[3648+((i|r|e|q|p)+(m>>>(p>>>0))<<2)>>2]|0}else{I=E}if((I|0)==0){J=D;K=C}else{p=I;m=D;q=C;while(1){e=(c[p+4>>2]&-8)-g|0;r=e>>>0<m>>>0;i=r?e:m;e=r?p:q;r=c[p+16>>2]|0;if((r|0)!=0){p=r;m=i;q=e;continue}r=c[p+20>>2]|0;if((r|0)==0){J=i;K=e;break}else{p=r;m=i;q=e}}}if((K|0)==0){o=g;break}if(J>>>0>=((c[838]|0)-g|0)>>>0){o=g;break}q=K;m=c[840]|0;if(q>>>0<m>>>0){as();return 0;return 0}p=q+g|0;k=p;if(q>>>0>=p>>>0){as();return 0;return 0}e=c[K+24>>2]|0;i=c[K+12>>2]|0;do{if((i|0)==(K|0)){r=K+20|0;d=c[r>>2]|0;if((d|0)==0){j=K+16|0;B=c[j>>2]|0;if((B|0)==0){L=0;break}else{M=B;N=j}}else{M=d;N=r}while(1){r=M+20|0;d=c[r>>2]|0;if((d|0)!=0){M=d;N=r;continue}r=M+16|0;d=c[r>>2]|0;if((d|0)==0){break}else{M=d;N=r}}if(N>>>0<m>>>0){as();return 0;return 0}else{c[N>>2]=0;L=M;break}}else{r=c[K+8>>2]|0;if(r>>>0<m>>>0){as();return 0;return 0}d=r+12|0;if((c[d>>2]|0)!=(K|0)){as();return 0;return 0}j=i+8|0;if((c[j>>2]|0)==(K|0)){c[d>>2]=i;c[j>>2]=r;L=i;break}else{as();return 0;return 0}}}while(0);L1178:do{if((e|0)!=0){i=K+28|0;m=3648+(c[i>>2]<<2)|0;do{if((K|0)==(c[m>>2]|0)){c[m>>2]=L;if((L|0)!=0){break}c[837]=c[837]&(1<<c[i>>2]^-1);break L1178}else{if(e>>>0<(c[840]|0)>>>0){as();return 0;return 0}r=e+16|0;if((c[r>>2]|0)==(K|0)){c[r>>2]=L}else{c[e+20>>2]=L}if((L|0)==0){break L1178}}}while(0);if(L>>>0<(c[840]|0)>>>0){as();return 0;return 0}c[L+24>>2]=e;i=c[K+16>>2]|0;do{if((i|0)!=0){if(i>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[L+16>>2]=i;c[i+24>>2]=L;break}}}while(0);i=c[K+20>>2]|0;if((i|0)==0){break}if(i>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[L+20>>2]=i;c[i+24>>2]=L;break}}}while(0);do{if(J>>>0<16){e=J+g|0;c[K+4>>2]=e|3;i=q+(e+4)|0;c[i>>2]=c[i>>2]|1}else{c[K+4>>2]=g|3;c[q+(g|4)>>2]=J|1;c[q+(J+g)>>2]=J;i=J>>>3;if(J>>>0<256){e=i<<1;m=3384+(e<<2)|0;r=c[836]|0;j=1<<i;do{if((r&j|0)==0){c[836]=r|j;O=m;P=3384+(e+2<<2)|0}else{i=3384+(e+2<<2)|0;d=c[i>>2]|0;if(d>>>0>=(c[840]|0)>>>0){O=d;P=i;break}as();return 0;return 0}}while(0);c[P>>2]=k;c[O+12>>2]=k;c[q+(g+8)>>2]=O;c[q+(g+12)>>2]=m;break}e=p;j=J>>>8;do{if((j|0)==0){Q=0}else{if(J>>>0>16777215){Q=31;break}r=(j+1048320|0)>>>16&8;i=j<<r;d=(i+520192|0)>>>16&4;B=i<<d;i=(B+245760|0)>>>16&2;l=14-(d|r|i)+(B<<i>>>15)|0;Q=J>>>((l+7|0)>>>0)&1|l<<1}}while(0);j=3648+(Q<<2)|0;c[q+(g+28)>>2]=Q;c[q+(g+20)>>2]=0;c[q+(g+16)>>2]=0;m=c[837]|0;l=1<<Q;if((m&l|0)==0){c[837]=m|l;c[j>>2]=e;c[q+(g+24)>>2]=j;c[q+(g+12)>>2]=e;c[q+(g+8)>>2]=e;break}if((Q|0)==31){R=0}else{R=25-(Q>>>1)|0}l=J<<R;m=c[j>>2]|0;while(1){if((c[m+4>>2]&-8|0)==(J|0)){break}S=m+16+(l>>>31<<2)|0;j=c[S>>2]|0;if((j|0)==0){T=908;break}else{l=l<<1;m=j}}if((T|0)==908){if(S>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[S>>2]=e;c[q+(g+24)>>2]=m;c[q+(g+12)>>2]=e;c[q+(g+8)>>2]=e;break}}l=m+8|0;j=c[l>>2]|0;i=c[840]|0;if(m>>>0<i>>>0){as();return 0;return 0}if(j>>>0<i>>>0){as();return 0;return 0}else{c[j+12>>2]=e;c[l>>2]=e;c[q+(g+8)>>2]=j;c[q+(g+12)>>2]=m;c[q+(g+24)>>2]=0;break}}}while(0);q=K+8|0;if((q|0)==0){o=g;break}else{n=q}return n|0}}while(0);K=c[838]|0;if(o>>>0<=K>>>0){S=K-o|0;J=c[841]|0;if(S>>>0>15){R=J;c[841]=R+o;c[838]=S;c[R+(o+4)>>2]=S|1;c[R+K>>2]=S;c[J+4>>2]=o|3}else{c[838]=0;c[841]=0;c[J+4>>2]=K|3;S=J+(K+4)|0;c[S>>2]=c[S>>2]|1}n=J+8|0;return n|0}J=c[839]|0;if(o>>>0<J>>>0){S=J-o|0;c[839]=S;J=c[842]|0;K=J;c[842]=K+o;c[K+(o+4)>>2]=S|1;c[J+4>>2]=o|3;n=J+8|0;return n|0}do{if((c[608]|0)==0){J=aB(8)|0;if((J-1&J|0)==0){c[610]=J;c[609]=J;c[611]=-1;c[612]=2097152;c[613]=0;c[947]=0;c[608]=(a0(0)|0)&-16^1431655768;break}else{as();return 0;return 0}}}while(0);J=o+48|0;S=c[610]|0;K=o+47|0;R=S+K|0;Q=-S|0;S=R&Q;if(S>>>0<=o>>>0){n=0;return n|0}O=c[946]|0;do{if((O|0)!=0){P=c[944]|0;L=P+S|0;if(L>>>0<=P>>>0|L>>>0>O>>>0){n=0}else{break}return n|0}}while(0);L1270:do{if((c[947]&4|0)==0){O=c[842]|0;L1272:do{if((O|0)==0){T=938}else{L=O;P=3792;while(1){U=P|0;M=c[U>>2]|0;if(M>>>0<=L>>>0){V=P+4|0;if((M+(c[V>>2]|0)|0)>>>0>L>>>0){break}}M=c[P+8>>2]|0;if((M|0)==0){T=938;break L1272}else{P=M}}if((P|0)==0){T=938;break}L=R-(c[839]|0)&Q;if(L>>>0>=2147483647){W=0;break}m=a$(L|0)|0;e=(m|0)==((c[U>>2]|0)+(c[V>>2]|0)|0);X=e?m:-1;Y=e?L:0;Z=m;_=L;T=947}}while(0);do{if((T|0)==938){O=a$(0)|0;if((O|0)==-1){W=0;break}g=O;L=c[609]|0;m=L-1|0;if((m&g|0)==0){$=S}else{$=S-g+(m+g&-L)|0}L=c[944]|0;g=L+$|0;if(!($>>>0>o>>>0&$>>>0<2147483647)){W=0;break}m=c[946]|0;if((m|0)!=0){if(g>>>0<=L>>>0|g>>>0>m>>>0){W=0;break}}m=a$($|0)|0;g=(m|0)==(O|0);X=g?O:-1;Y=g?$:0;Z=m;_=$;T=947}}while(0);L1292:do{if((T|0)==947){m=-_|0;if((X|0)!=-1){aa=Y;ab=X;T=958;break L1270}do{if((Z|0)!=-1&_>>>0<2147483647&_>>>0<J>>>0){g=c[610]|0;O=K-_+g&-g;if(O>>>0>=2147483647){ac=_;break}if((a$(O|0)|0)==-1){a$(m|0)|0;W=Y;break L1292}else{ac=O+_|0;break}}else{ac=_}}while(0);if((Z|0)==-1){W=Y}else{aa=ac;ab=Z;T=958;break L1270}}}while(0);c[947]=c[947]|4;ad=W;T=955}else{ad=0;T=955}}while(0);do{if((T|0)==955){if(S>>>0>=2147483647){break}W=a$(S|0)|0;Z=a$(0)|0;if(!((Z|0)!=-1&(W|0)!=-1&W>>>0<Z>>>0)){break}ac=Z-W|0;Z=ac>>>0>(o+40|0)>>>0;Y=Z?W:-1;if((Y|0)!=-1){aa=Z?ac:ad;ab=Y;T=958}}}while(0);do{if((T|0)==958){ad=(c[944]|0)+aa|0;c[944]=ad;if(ad>>>0>(c[945]|0)>>>0){c[945]=ad}ad=c[842]|0;L1312:do{if((ad|0)==0){S=c[840]|0;if((S|0)==0|ab>>>0<S>>>0){c[840]=ab}c[948]=ab;c[949]=aa;c[951]=0;c[845]=c[608];c[844]=-1;S=0;do{Y=S<<1;ac=3384+(Y<<2)|0;c[3384+(Y+3<<2)>>2]=ac;c[3384+(Y+2<<2)>>2]=ac;S=S+1|0;}while(S>>>0<32);S=ab+8|0;if((S&7|0)==0){ae=0}else{ae=-S&7}S=aa-40-ae|0;c[842]=ab+ae;c[839]=S;c[ab+(ae+4)>>2]=S|1;c[ab+(aa-36)>>2]=40;c[843]=c[612]}else{S=3792;while(1){af=c[S>>2]|0;ag=S+4|0;ah=c[ag>>2]|0;if((ab|0)==(af+ah|0)){T=970;break}ac=c[S+8>>2]|0;if((ac|0)==0){break}else{S=ac}}do{if((T|0)==970){if((c[S+12>>2]&8|0)!=0){break}ac=ad;if(!(ac>>>0>=af>>>0&ac>>>0<ab>>>0)){break}c[ag>>2]=ah+aa;ac=c[842]|0;Y=(c[839]|0)+aa|0;Z=ac;W=ac+8|0;if((W&7|0)==0){ai=0}else{ai=-W&7}W=Y-ai|0;c[842]=Z+ai;c[839]=W;c[Z+(ai+4)>>2]=W|1;c[Z+(Y+4)>>2]=40;c[843]=c[612];break L1312}}while(0);if(ab>>>0<(c[840]|0)>>>0){c[840]=ab}S=ab+aa|0;Y=3792;while(1){aj=Y|0;if((c[aj>>2]|0)==(S|0)){T=980;break}Z=c[Y+8>>2]|0;if((Z|0)==0){break}else{Y=Z}}do{if((T|0)==980){if((c[Y+12>>2]&8|0)!=0){break}c[aj>>2]=ab;S=Y+4|0;c[S>>2]=(c[S>>2]|0)+aa;S=ab+8|0;if((S&7|0)==0){ak=0}else{ak=-S&7}S=ab+(aa+8)|0;if((S&7|0)==0){al=0}else{al=-S&7}S=ab+(al+aa)|0;Z=S;W=ak+o|0;ac=ab+W|0;_=ac;K=S-(ab+ak)-o|0;c[ab+(ak+4)>>2]=o|3;do{if((Z|0)==(c[842]|0)){J=(c[839]|0)+K|0;c[839]=J;c[842]=_;c[ab+(W+4)>>2]=J|1}else{if((Z|0)==(c[841]|0)){J=(c[838]|0)+K|0;c[838]=J;c[841]=_;c[ab+(W+4)>>2]=J|1;c[ab+(J+W)>>2]=J;break}J=aa+4|0;X=c[ab+(J+al)>>2]|0;if((X&3|0)==1){$=X&-8;V=X>>>3;L1357:do{if(X>>>0<256){U=c[ab+((al|8)+aa)>>2]|0;Q=c[ab+(aa+12+al)>>2]|0;R=3384+(V<<1<<2)|0;do{if((U|0)!=(R|0)){if(U>>>0<(c[840]|0)>>>0){as();return 0;return 0}if((c[U+12>>2]|0)==(Z|0)){break}as();return 0;return 0}}while(0);if((Q|0)==(U|0)){c[836]=c[836]&(1<<V^-1);break}do{if((Q|0)==(R|0)){am=Q+8|0}else{if(Q>>>0<(c[840]|0)>>>0){as();return 0;return 0}m=Q+8|0;if((c[m>>2]|0)==(Z|0)){am=m;break}as();return 0;return 0}}while(0);c[U+12>>2]=Q;c[am>>2]=U}else{R=S;m=c[ab+((al|24)+aa)>>2]|0;P=c[ab+(aa+12+al)>>2]|0;do{if((P|0)==(R|0)){O=al|16;g=ab+(J+O)|0;L=c[g>>2]|0;if((L|0)==0){e=ab+(O+aa)|0;O=c[e>>2]|0;if((O|0)==0){an=0;break}else{ao=O;ap=e}}else{ao=L;ap=g}while(1){g=ao+20|0;L=c[g>>2]|0;if((L|0)!=0){ao=L;ap=g;continue}g=ao+16|0;L=c[g>>2]|0;if((L|0)==0){break}else{ao=L;ap=g}}if(ap>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[ap>>2]=0;an=ao;break}}else{g=c[ab+((al|8)+aa)>>2]|0;if(g>>>0<(c[840]|0)>>>0){as();return 0;return 0}L=g+12|0;if((c[L>>2]|0)!=(R|0)){as();return 0;return 0}e=P+8|0;if((c[e>>2]|0)==(R|0)){c[L>>2]=P;c[e>>2]=g;an=P;break}else{as();return 0;return 0}}}while(0);if((m|0)==0){break}P=ab+(aa+28+al)|0;U=3648+(c[P>>2]<<2)|0;do{if((R|0)==(c[U>>2]|0)){c[U>>2]=an;if((an|0)!=0){break}c[837]=c[837]&(1<<c[P>>2]^-1);break L1357}else{if(m>>>0<(c[840]|0)>>>0){as();return 0;return 0}Q=m+16|0;if((c[Q>>2]|0)==(R|0)){c[Q>>2]=an}else{c[m+20>>2]=an}if((an|0)==0){break L1357}}}while(0);if(an>>>0<(c[840]|0)>>>0){as();return 0;return 0}c[an+24>>2]=m;R=al|16;P=c[ab+(R+aa)>>2]|0;do{if((P|0)!=0){if(P>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[an+16>>2]=P;c[P+24>>2]=an;break}}}while(0);P=c[ab+(J+R)>>2]|0;if((P|0)==0){break}if(P>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[an+20>>2]=P;c[P+24>>2]=an;break}}}while(0);aq=ab+(($|al)+aa)|0;ar=$+K|0}else{aq=Z;ar=K}J=aq+4|0;c[J>>2]=c[J>>2]&-2;c[ab+(W+4)>>2]=ar|1;c[ab+(ar+W)>>2]=ar;J=ar>>>3;if(ar>>>0<256){V=J<<1;X=3384+(V<<2)|0;P=c[836]|0;m=1<<J;do{if((P&m|0)==0){c[836]=P|m;at=X;au=3384+(V+2<<2)|0}else{J=3384+(V+2<<2)|0;U=c[J>>2]|0;if(U>>>0>=(c[840]|0)>>>0){at=U;au=J;break}as();return 0;return 0}}while(0);c[au>>2]=_;c[at+12>>2]=_;c[ab+(W+8)>>2]=at;c[ab+(W+12)>>2]=X;break}V=ac;m=ar>>>8;do{if((m|0)==0){av=0}else{if(ar>>>0>16777215){av=31;break}P=(m+1048320|0)>>>16&8;$=m<<P;J=($+520192|0)>>>16&4;U=$<<J;$=(U+245760|0)>>>16&2;Q=14-(J|P|$)+(U<<$>>>15)|0;av=ar>>>((Q+7|0)>>>0)&1|Q<<1}}while(0);m=3648+(av<<2)|0;c[ab+(W+28)>>2]=av;c[ab+(W+20)>>2]=0;c[ab+(W+16)>>2]=0;X=c[837]|0;Q=1<<av;if((X&Q|0)==0){c[837]=X|Q;c[m>>2]=V;c[ab+(W+24)>>2]=m;c[ab+(W+12)>>2]=V;c[ab+(W+8)>>2]=V;break}if((av|0)==31){aw=0}else{aw=25-(av>>>1)|0}Q=ar<<aw;X=c[m>>2]|0;while(1){if((c[X+4>>2]&-8|0)==(ar|0)){break}ax=X+16+(Q>>>31<<2)|0;m=c[ax>>2]|0;if((m|0)==0){T=1053;break}else{Q=Q<<1;X=m}}if((T|0)==1053){if(ax>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[ax>>2]=V;c[ab+(W+24)>>2]=X;c[ab+(W+12)>>2]=V;c[ab+(W+8)>>2]=V;break}}Q=X+8|0;m=c[Q>>2]|0;$=c[840]|0;if(X>>>0<$>>>0){as();return 0;return 0}if(m>>>0<$>>>0){as();return 0;return 0}else{c[m+12>>2]=V;c[Q>>2]=V;c[ab+(W+8)>>2]=m;c[ab+(W+12)>>2]=X;c[ab+(W+24)>>2]=0;break}}}while(0);n=ab+(ak|8)|0;return n|0}}while(0);Y=ad;W=3792;while(1){ay=c[W>>2]|0;if(ay>>>0<=Y>>>0){az=c[W+4>>2]|0;aA=ay+az|0;if(aA>>>0>Y>>>0){break}}W=c[W+8>>2]|0}W=ay+(az-39)|0;if((W&7|0)==0){aC=0}else{aC=-W&7}W=ay+(az-47+aC)|0;ac=W>>>0<(ad+16|0)>>>0?Y:W;W=ac+8|0;_=ab+8|0;if((_&7|0)==0){aD=0}else{aD=-_&7}_=aa-40-aD|0;c[842]=ab+aD;c[839]=_;c[ab+(aD+4)>>2]=_|1;c[ab+(aa-36)>>2]=40;c[843]=c[612];c[ac+4>>2]=27;c[W>>2]=c[948];c[W+4>>2]=c[3796>>2];c[W+8>>2]=c[3800>>2];c[W+12>>2]=c[3804>>2];c[948]=ab;c[949]=aa;c[951]=0;c[950]=W;W=ac+28|0;c[W>>2]=7;if((ac+32|0)>>>0<aA>>>0){_=W;while(1){W=_+4|0;c[W>>2]=7;if((_+8|0)>>>0<aA>>>0){_=W}else{break}}}if((ac|0)==(Y|0)){break}_=ac-ad|0;W=Y+(_+4)|0;c[W>>2]=c[W>>2]&-2;c[ad+4>>2]=_|1;c[Y+_>>2]=_;W=_>>>3;if(_>>>0<256){K=W<<1;Z=3384+(K<<2)|0;S=c[836]|0;m=1<<W;do{if((S&m|0)==0){c[836]=S|m;aE=Z;aF=3384+(K+2<<2)|0}else{W=3384+(K+2<<2)|0;Q=c[W>>2]|0;if(Q>>>0>=(c[840]|0)>>>0){aE=Q;aF=W;break}as();return 0;return 0}}while(0);c[aF>>2]=ad;c[aE+12>>2]=ad;c[ad+8>>2]=aE;c[ad+12>>2]=Z;break}K=ad;m=_>>>8;do{if((m|0)==0){aG=0}else{if(_>>>0>16777215){aG=31;break}S=(m+1048320|0)>>>16&8;Y=m<<S;ac=(Y+520192|0)>>>16&4;W=Y<<ac;Y=(W+245760|0)>>>16&2;Q=14-(ac|S|Y)+(W<<Y>>>15)|0;aG=_>>>((Q+7|0)>>>0)&1|Q<<1}}while(0);m=3648+(aG<<2)|0;c[ad+28>>2]=aG;c[ad+20>>2]=0;c[ad+16>>2]=0;Z=c[837]|0;Q=1<<aG;if((Z&Q|0)==0){c[837]=Z|Q;c[m>>2]=K;c[ad+24>>2]=m;c[ad+12>>2]=ad;c[ad+8>>2]=ad;break}if((aG|0)==31){aH=0}else{aH=25-(aG>>>1)|0}Q=_<<aH;Z=c[m>>2]|0;while(1){if((c[Z+4>>2]&-8|0)==(_|0)){break}aI=Z+16+(Q>>>31<<2)|0;m=c[aI>>2]|0;if((m|0)==0){T=1088;break}else{Q=Q<<1;Z=m}}if((T|0)==1088){if(aI>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[aI>>2]=K;c[ad+24>>2]=Z;c[ad+12>>2]=ad;c[ad+8>>2]=ad;break}}Q=Z+8|0;_=c[Q>>2]|0;m=c[840]|0;if(Z>>>0<m>>>0){as();return 0;return 0}if(_>>>0<m>>>0){as();return 0;return 0}else{c[_+12>>2]=K;c[Q>>2]=K;c[ad+8>>2]=_;c[ad+12>>2]=Z;c[ad+24>>2]=0;break}}}while(0);ad=c[839]|0;if(ad>>>0<=o>>>0){break}_=ad-o|0;c[839]=_;ad=c[842]|0;Q=ad;c[842]=Q+o;c[Q+(o+4)>>2]=_|1;c[ad+4>>2]=o|3;n=ad+8|0;return n|0}}while(0);c[(aZ()|0)>>2]=12;n=0;return n|0}function bT(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0;if((a|0)==0){return}b=a-8|0;d=b;e=c[840]|0;if(b>>>0<e>>>0){as()}f=c[a-4>>2]|0;g=f&3;if((g|0)==1){as()}h=f&-8;i=a+(h-8)|0;j=i;L1529:do{if((f&1|0)==0){k=c[b>>2]|0;if((g|0)==0){return}l=-8-k|0;m=a+l|0;n=m;o=k+h|0;if(m>>>0<e>>>0){as()}if((n|0)==(c[841]|0)){p=a+(h-4)|0;if((c[p>>2]&3|0)!=3){q=n;r=o;break}c[838]=o;c[p>>2]=c[p>>2]&-2;c[a+(l+4)>>2]=o|1;c[i>>2]=o;return}p=k>>>3;if(k>>>0<256){k=c[a+(l+8)>>2]|0;s=c[a+(l+12)>>2]|0;t=3384+(p<<1<<2)|0;do{if((k|0)!=(t|0)){if(k>>>0<e>>>0){as()}if((c[k+12>>2]|0)==(n|0)){break}as()}}while(0);if((s|0)==(k|0)){c[836]=c[836]&(1<<p^-1);q=n;r=o;break}do{if((s|0)==(t|0)){u=s+8|0}else{if(s>>>0<e>>>0){as()}v=s+8|0;if((c[v>>2]|0)==(n|0)){u=v;break}as()}}while(0);c[k+12>>2]=s;c[u>>2]=k;q=n;r=o;break}t=m;p=c[a+(l+24)>>2]|0;v=c[a+(l+12)>>2]|0;do{if((v|0)==(t|0)){w=a+(l+20)|0;x=c[w>>2]|0;if((x|0)==0){y=a+(l+16)|0;z=c[y>>2]|0;if((z|0)==0){A=0;break}else{B=z;C=y}}else{B=x;C=w}while(1){w=B+20|0;x=c[w>>2]|0;if((x|0)!=0){B=x;C=w;continue}w=B+16|0;x=c[w>>2]|0;if((x|0)==0){break}else{B=x;C=w}}if(C>>>0<e>>>0){as()}else{c[C>>2]=0;A=B;break}}else{w=c[a+(l+8)>>2]|0;if(w>>>0<e>>>0){as()}x=w+12|0;if((c[x>>2]|0)!=(t|0)){as()}y=v+8|0;if((c[y>>2]|0)==(t|0)){c[x>>2]=v;c[y>>2]=w;A=v;break}else{as()}}}while(0);if((p|0)==0){q=n;r=o;break}v=a+(l+28)|0;m=3648+(c[v>>2]<<2)|0;do{if((t|0)==(c[m>>2]|0)){c[m>>2]=A;if((A|0)!=0){break}c[837]=c[837]&(1<<c[v>>2]^-1);q=n;r=o;break L1529}else{if(p>>>0<(c[840]|0)>>>0){as()}k=p+16|0;if((c[k>>2]|0)==(t|0)){c[k>>2]=A}else{c[p+20>>2]=A}if((A|0)==0){q=n;r=o;break L1529}}}while(0);if(A>>>0<(c[840]|0)>>>0){as()}c[A+24>>2]=p;t=c[a+(l+16)>>2]|0;do{if((t|0)!=0){if(t>>>0<(c[840]|0)>>>0){as()}else{c[A+16>>2]=t;c[t+24>>2]=A;break}}}while(0);t=c[a+(l+20)>>2]|0;if((t|0)==0){q=n;r=o;break}if(t>>>0<(c[840]|0)>>>0){as()}else{c[A+20>>2]=t;c[t+24>>2]=A;q=n;r=o;break}}else{q=d;r=h}}while(0);d=q;if(d>>>0>=i>>>0){as()}A=a+(h-4)|0;e=c[A>>2]|0;if((e&1|0)==0){as()}do{if((e&2|0)==0){if((j|0)==(c[842]|0)){B=(c[839]|0)+r|0;c[839]=B;c[842]=q;c[q+4>>2]=B|1;if((q|0)==(c[841]|0)){c[841]=0;c[838]=0}if(B>>>0<=(c[843]|0)>>>0){return}bV(0)|0;return}if((j|0)==(c[841]|0)){B=(c[838]|0)+r|0;c[838]=B;c[841]=q;c[q+4>>2]=B|1;c[d+B>>2]=B;return}B=(e&-8)+r|0;C=e>>>3;L1634:do{if(e>>>0<256){u=c[a+h>>2]|0;g=c[a+(h|4)>>2]|0;b=3384+(C<<1<<2)|0;do{if((u|0)!=(b|0)){if(u>>>0<(c[840]|0)>>>0){as()}if((c[u+12>>2]|0)==(j|0)){break}as()}}while(0);if((g|0)==(u|0)){c[836]=c[836]&(1<<C^-1);break}do{if((g|0)==(b|0)){D=g+8|0}else{if(g>>>0<(c[840]|0)>>>0){as()}f=g+8|0;if((c[f>>2]|0)==(j|0)){D=f;break}as()}}while(0);c[u+12>>2]=g;c[D>>2]=u}else{b=i;f=c[a+(h+16)>>2]|0;t=c[a+(h|4)>>2]|0;do{if((t|0)==(b|0)){p=a+(h+12)|0;v=c[p>>2]|0;if((v|0)==0){m=a+(h+8)|0;k=c[m>>2]|0;if((k|0)==0){E=0;break}else{F=k;G=m}}else{F=v;G=p}while(1){p=F+20|0;v=c[p>>2]|0;if((v|0)!=0){F=v;G=p;continue}p=F+16|0;v=c[p>>2]|0;if((v|0)==0){break}else{F=v;G=p}}if(G>>>0<(c[840]|0)>>>0){as()}else{c[G>>2]=0;E=F;break}}else{p=c[a+h>>2]|0;if(p>>>0<(c[840]|0)>>>0){as()}v=p+12|0;if((c[v>>2]|0)!=(b|0)){as()}m=t+8|0;if((c[m>>2]|0)==(b|0)){c[v>>2]=t;c[m>>2]=p;E=t;break}else{as()}}}while(0);if((f|0)==0){break}t=a+(h+20)|0;u=3648+(c[t>>2]<<2)|0;do{if((b|0)==(c[u>>2]|0)){c[u>>2]=E;if((E|0)!=0){break}c[837]=c[837]&(1<<c[t>>2]^-1);break L1634}else{if(f>>>0<(c[840]|0)>>>0){as()}g=f+16|0;if((c[g>>2]|0)==(b|0)){c[g>>2]=E}else{c[f+20>>2]=E}if((E|0)==0){break L1634}}}while(0);if(E>>>0<(c[840]|0)>>>0){as()}c[E+24>>2]=f;b=c[a+(h+8)>>2]|0;do{if((b|0)!=0){if(b>>>0<(c[840]|0)>>>0){as()}else{c[E+16>>2]=b;c[b+24>>2]=E;break}}}while(0);b=c[a+(h+12)>>2]|0;if((b|0)==0){break}if(b>>>0<(c[840]|0)>>>0){as()}else{c[E+20>>2]=b;c[b+24>>2]=E;break}}}while(0);c[q+4>>2]=B|1;c[d+B>>2]=B;if((q|0)!=(c[841]|0)){H=B;break}c[838]=B;return}else{c[A>>2]=e&-2;c[q+4>>2]=r|1;c[d+r>>2]=r;H=r}}while(0);r=H>>>3;if(H>>>0<256){d=r<<1;e=3384+(d<<2)|0;A=c[836]|0;E=1<<r;do{if((A&E|0)==0){c[836]=A|E;I=e;J=3384+(d+2<<2)|0}else{r=3384+(d+2<<2)|0;h=c[r>>2]|0;if(h>>>0>=(c[840]|0)>>>0){I=h;J=r;break}as()}}while(0);c[J>>2]=q;c[I+12>>2]=q;c[q+8>>2]=I;c[q+12>>2]=e;return}e=q;I=H>>>8;do{if((I|0)==0){K=0}else{if(H>>>0>16777215){K=31;break}J=(I+1048320|0)>>>16&8;d=I<<J;E=(d+520192|0)>>>16&4;A=d<<E;d=(A+245760|0)>>>16&2;r=14-(E|J|d)+(A<<d>>>15)|0;K=H>>>((r+7|0)>>>0)&1|r<<1}}while(0);I=3648+(K<<2)|0;c[q+28>>2]=K;c[q+20>>2]=0;c[q+16>>2]=0;r=c[837]|0;d=1<<K;do{if((r&d|0)==0){c[837]=r|d;c[I>>2]=e;c[q+24>>2]=I;c[q+12>>2]=q;c[q+8>>2]=q}else{if((K|0)==31){L=0}else{L=25-(K>>>1)|0}A=H<<L;J=c[I>>2]|0;while(1){if((c[J+4>>2]&-8|0)==(H|0)){break}M=J+16+(A>>>31<<2)|0;E=c[M>>2]|0;if((E|0)==0){N=1267;break}else{A=A<<1;J=E}}if((N|0)==1267){if(M>>>0<(c[840]|0)>>>0){as()}else{c[M>>2]=e;c[q+24>>2]=J;c[q+12>>2]=q;c[q+8>>2]=q;break}}A=J+8|0;B=c[A>>2]|0;E=c[840]|0;if(J>>>0<E>>>0){as()}if(B>>>0<E>>>0){as()}else{c[B+12>>2]=e;c[A>>2]=e;c[q+8>>2]=B;c[q+12>>2]=J;c[q+24>>2]=0;break}}}while(0);q=(c[844]|0)-1|0;c[844]=q;if((q|0)==0){O=3800}else{return}while(1){q=c[O>>2]|0;if((q|0)==0){break}else{O=q+8|0}}c[844]=-1;return}function bU(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0;if((a|0)==0){d=bS(b)|0;return d|0}if(b>>>0>4294967231){c[(aZ()|0)>>2]=12;d=0;return d|0}if(b>>>0<11){e=16}else{e=b+11&-8}f=bW(a-8|0,e)|0;if((f|0)!=0){d=f+8|0;return d|0}f=bS(b)|0;if((f|0)==0){d=0;return d|0}e=c[a-4>>2]|0;g=(e&-8)-((e&3|0)==0?8:4)|0;e=g>>>0<b>>>0?g:b;b_(f|0,a|0,e)|0;bT(a);d=f;return d|0}function bV(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do{if((c[608]|0)==0){b=aB(8)|0;if((b-1&b|0)==0){c[610]=b;c[609]=b;c[611]=-1;c[612]=2097152;c[613]=0;c[947]=0;c[608]=(a0(0)|0)&-16^1431655768;break}else{as();return 0;return 0}}}while(0);if(a>>>0>=4294967232){d=0;return d|0}b=c[842]|0;if((b|0)==0){d=0;return d|0}e=c[839]|0;do{if(e>>>0>(a+40|0)>>>0){f=c[610]|0;g=ac((((-40-a-1+e+f|0)>>>0)/(f>>>0)>>>0)-1|0,f)|0;h=b;i=3792;while(1){j=c[i>>2]|0;if(j>>>0<=h>>>0){if((j+(c[i+4>>2]|0)|0)>>>0>h>>>0){k=i;break}}j=c[i+8>>2]|0;if((j|0)==0){k=0;break}else{i=j}}if((c[k+12>>2]&8|0)!=0){break}i=a$(0)|0;h=k+4|0;if((i|0)!=((c[k>>2]|0)+(c[h>>2]|0)|0)){break}j=a$(-(g>>>0>2147483646?-2147483648-f|0:g)|0)|0;l=a$(0)|0;if(!((j|0)!=-1&l>>>0<i>>>0)){break}j=i-l|0;if((i|0)==(l|0)){break}c[h>>2]=(c[h>>2]|0)-j;c[944]=(c[944]|0)-j;h=c[842]|0;m=(c[839]|0)-j|0;j=h;n=h+8|0;if((n&7|0)==0){o=0}else{o=-n&7}n=m-o|0;c[842]=j+o;c[839]=n;c[j+(o+4)>>2]=n|1;c[j+(m+4)>>2]=40;c[843]=c[612];d=(i|0)!=(l|0)&1;return d|0}}while(0);if((c[839]|0)>>>0<=(c[843]|0)>>>0){d=0;return d|0}c[843]=-1;d=0;return d|0}function bW(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;d=a+4|0;e=c[d>>2]|0;f=e&-8;g=a;h=g+f|0;i=h;j=c[840]|0;if(g>>>0<j>>>0){as();return 0;return 0}k=e&3;if(!((k|0)!=1&g>>>0<h>>>0)){as();return 0;return 0}l=g+(f|4)|0;m=c[l>>2]|0;if((m&1|0)==0){as();return 0;return 0}if((k|0)==0){if(b>>>0<256){n=0;return n|0}do{if(f>>>0>=(b+4|0)>>>0){if((f-b|0)>>>0>c[610]<<1>>>0){break}else{n=a}return n|0}}while(0);n=0;return n|0}if(f>>>0>=b>>>0){k=f-b|0;if(k>>>0<=15){n=a;return n|0}c[d>>2]=e&1|b|2;c[g+(b+4)>>2]=k|3;c[l>>2]=c[l>>2]|1;bX(g+b|0,k);n=a;return n|0}if((i|0)==(c[842]|0)){k=(c[839]|0)+f|0;if(k>>>0<=b>>>0){n=0;return n|0}l=k-b|0;c[d>>2]=e&1|b|2;c[g+(b+4)>>2]=l|1;c[842]=g+b;c[839]=l;n=a;return n|0}if((i|0)==(c[841]|0)){l=(c[838]|0)+f|0;if(l>>>0<b>>>0){n=0;return n|0}k=l-b|0;if(k>>>0>15){c[d>>2]=e&1|b|2;c[g+(b+4)>>2]=k|1;c[g+l>>2]=k;o=g+(l+4)|0;c[o>>2]=c[o>>2]&-2;p=g+b|0;q=k}else{c[d>>2]=e&1|l|2;e=g+(l+4)|0;c[e>>2]=c[e>>2]|1;p=0;q=0}c[838]=q;c[841]=p;n=a;return n|0}if((m&2|0)!=0){n=0;return n|0}p=(m&-8)+f|0;if(p>>>0<b>>>0){n=0;return n|0}q=p-b|0;e=m>>>3;L1855:do{if(m>>>0<256){l=c[g+(f+8)>>2]|0;k=c[g+(f+12)>>2]|0;o=3384+(e<<1<<2)|0;do{if((l|0)!=(o|0)){if(l>>>0<j>>>0){as();return 0;return 0}if((c[l+12>>2]|0)==(i|0)){break}as();return 0;return 0}}while(0);if((k|0)==(l|0)){c[836]=c[836]&(1<<e^-1);break}do{if((k|0)==(o|0)){r=k+8|0}else{if(k>>>0<j>>>0){as();return 0;return 0}s=k+8|0;if((c[s>>2]|0)==(i|0)){r=s;break}as();return 0;return 0}}while(0);c[l+12>>2]=k;c[r>>2]=l}else{o=h;s=c[g+(f+24)>>2]|0;t=c[g+(f+12)>>2]|0;do{if((t|0)==(o|0)){u=g+(f+20)|0;v=c[u>>2]|0;if((v|0)==0){w=g+(f+16)|0;x=c[w>>2]|0;if((x|0)==0){y=0;break}else{z=x;A=w}}else{z=v;A=u}while(1){u=z+20|0;v=c[u>>2]|0;if((v|0)!=0){z=v;A=u;continue}u=z+16|0;v=c[u>>2]|0;if((v|0)==0){break}else{z=v;A=u}}if(A>>>0<j>>>0){as();return 0;return 0}else{c[A>>2]=0;y=z;break}}else{u=c[g+(f+8)>>2]|0;if(u>>>0<j>>>0){as();return 0;return 0}v=u+12|0;if((c[v>>2]|0)!=(o|0)){as();return 0;return 0}w=t+8|0;if((c[w>>2]|0)==(o|0)){c[v>>2]=t;c[w>>2]=u;y=t;break}else{as();return 0;return 0}}}while(0);if((s|0)==0){break}t=g+(f+28)|0;l=3648+(c[t>>2]<<2)|0;do{if((o|0)==(c[l>>2]|0)){c[l>>2]=y;if((y|0)!=0){break}c[837]=c[837]&(1<<c[t>>2]^-1);break L1855}else{if(s>>>0<(c[840]|0)>>>0){as();return 0;return 0}k=s+16|0;if((c[k>>2]|0)==(o|0)){c[k>>2]=y}else{c[s+20>>2]=y}if((y|0)==0){break L1855}}}while(0);if(y>>>0<(c[840]|0)>>>0){as();return 0;return 0}c[y+24>>2]=s;o=c[g+(f+16)>>2]|0;do{if((o|0)!=0){if(o>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[y+16>>2]=o;c[o+24>>2]=y;break}}}while(0);o=c[g+(f+20)>>2]|0;if((o|0)==0){break}if(o>>>0<(c[840]|0)>>>0){as();return 0;return 0}else{c[y+20>>2]=o;c[o+24>>2]=y;break}}}while(0);if(q>>>0<16){c[d>>2]=p|c[d>>2]&1|2;y=g+(p|4)|0;c[y>>2]=c[y>>2]|1;n=a;return n|0}else{c[d>>2]=c[d>>2]&1|b|2;c[g+(b+4)>>2]=q|3;d=g+(p|4)|0;c[d>>2]=c[d>>2]|1;bX(g+b|0,q);n=a;return n|0}return 0}function bX(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0;d=a;e=d+b|0;f=e;g=c[a+4>>2]|0;L1931:do{if((g&1|0)==0){h=c[a>>2]|0;if((g&3|0)==0){return}i=d+(-h|0)|0;j=i;k=h+b|0;l=c[840]|0;if(i>>>0<l>>>0){as()}if((j|0)==(c[841]|0)){m=d+(b+4)|0;if((c[m>>2]&3|0)!=3){n=j;o=k;break}c[838]=k;c[m>>2]=c[m>>2]&-2;c[d+(4-h)>>2]=k|1;c[e>>2]=k;return}m=h>>>3;if(h>>>0<256){p=c[d+(8-h)>>2]|0;q=c[d+(12-h)>>2]|0;r=3384+(m<<1<<2)|0;do{if((p|0)!=(r|0)){if(p>>>0<l>>>0){as()}if((c[p+12>>2]|0)==(j|0)){break}as()}}while(0);if((q|0)==(p|0)){c[836]=c[836]&(1<<m^-1);n=j;o=k;break}do{if((q|0)==(r|0)){s=q+8|0}else{if(q>>>0<l>>>0){as()}t=q+8|0;if((c[t>>2]|0)==(j|0)){s=t;break}as()}}while(0);c[p+12>>2]=q;c[s>>2]=p;n=j;o=k;break}r=i;m=c[d+(24-h)>>2]|0;t=c[d+(12-h)>>2]|0;do{if((t|0)==(r|0)){u=16-h|0;v=d+(u+4)|0;w=c[v>>2]|0;if((w|0)==0){x=d+u|0;u=c[x>>2]|0;if((u|0)==0){y=0;break}else{z=u;A=x}}else{z=w;A=v}while(1){v=z+20|0;w=c[v>>2]|0;if((w|0)!=0){z=w;A=v;continue}v=z+16|0;w=c[v>>2]|0;if((w|0)==0){break}else{z=w;A=v}}if(A>>>0<l>>>0){as()}else{c[A>>2]=0;y=z;break}}else{v=c[d+(8-h)>>2]|0;if(v>>>0<l>>>0){as()}w=v+12|0;if((c[w>>2]|0)!=(r|0)){as()}x=t+8|0;if((c[x>>2]|0)==(r|0)){c[w>>2]=t;c[x>>2]=v;y=t;break}else{as()}}}while(0);if((m|0)==0){n=j;o=k;break}t=d+(28-h)|0;l=3648+(c[t>>2]<<2)|0;do{if((r|0)==(c[l>>2]|0)){c[l>>2]=y;if((y|0)!=0){break}c[837]=c[837]&(1<<c[t>>2]^-1);n=j;o=k;break L1931}else{if(m>>>0<(c[840]|0)>>>0){as()}i=m+16|0;if((c[i>>2]|0)==(r|0)){c[i>>2]=y}else{c[m+20>>2]=y}if((y|0)==0){n=j;o=k;break L1931}}}while(0);if(y>>>0<(c[840]|0)>>>0){as()}c[y+24>>2]=m;r=16-h|0;t=c[d+r>>2]|0;do{if((t|0)!=0){if(t>>>0<(c[840]|0)>>>0){as()}else{c[y+16>>2]=t;c[t+24>>2]=y;break}}}while(0);t=c[d+(r+4)>>2]|0;if((t|0)==0){n=j;o=k;break}if(t>>>0<(c[840]|0)>>>0){as()}else{c[y+20>>2]=t;c[t+24>>2]=y;n=j;o=k;break}}else{n=a;o=b}}while(0);a=c[840]|0;if(e>>>0<a>>>0){as()}y=d+(b+4)|0;z=c[y>>2]|0;do{if((z&2|0)==0){if((f|0)==(c[842]|0)){A=(c[839]|0)+o|0;c[839]=A;c[842]=n;c[n+4>>2]=A|1;if((n|0)!=(c[841]|0)){return}c[841]=0;c[838]=0;return}if((f|0)==(c[841]|0)){A=(c[838]|0)+o|0;c[838]=A;c[841]=n;c[n+4>>2]=A|1;c[n+A>>2]=A;return}A=(z&-8)+o|0;s=z>>>3;L2030:do{if(z>>>0<256){g=c[d+(b+8)>>2]|0;t=c[d+(b+12)>>2]|0;h=3384+(s<<1<<2)|0;do{if((g|0)!=(h|0)){if(g>>>0<a>>>0){as()}if((c[g+12>>2]|0)==(f|0)){break}as()}}while(0);if((t|0)==(g|0)){c[836]=c[836]&(1<<s^-1);break}do{if((t|0)==(h|0)){B=t+8|0}else{if(t>>>0<a>>>0){as()}m=t+8|0;if((c[m>>2]|0)==(f|0)){B=m;break}as()}}while(0);c[g+12>>2]=t;c[B>>2]=g}else{h=e;m=c[d+(b+24)>>2]|0;l=c[d+(b+12)>>2]|0;do{if((l|0)==(h|0)){i=d+(b+20)|0;p=c[i>>2]|0;if((p|0)==0){q=d+(b+16)|0;v=c[q>>2]|0;if((v|0)==0){C=0;break}else{D=v;E=q}}else{D=p;E=i}while(1){i=D+20|0;p=c[i>>2]|0;if((p|0)!=0){D=p;E=i;continue}i=D+16|0;p=c[i>>2]|0;if((p|0)==0){break}else{D=p;E=i}}if(E>>>0<a>>>0){as()}else{c[E>>2]=0;C=D;break}}else{i=c[d+(b+8)>>2]|0;if(i>>>0<a>>>0){as()}p=i+12|0;if((c[p>>2]|0)!=(h|0)){as()}q=l+8|0;if((c[q>>2]|0)==(h|0)){c[p>>2]=l;c[q>>2]=i;C=l;break}else{as()}}}while(0);if((m|0)==0){break}l=d+(b+28)|0;g=3648+(c[l>>2]<<2)|0;do{if((h|0)==(c[g>>2]|0)){c[g>>2]=C;if((C|0)!=0){break}c[837]=c[837]&(1<<c[l>>2]^-1);break L2030}else{if(m>>>0<(c[840]|0)>>>0){as()}t=m+16|0;if((c[t>>2]|0)==(h|0)){c[t>>2]=C}else{c[m+20>>2]=C}if((C|0)==0){break L2030}}}while(0);if(C>>>0<(c[840]|0)>>>0){as()}c[C+24>>2]=m;h=c[d+(b+16)>>2]|0;do{if((h|0)!=0){if(h>>>0<(c[840]|0)>>>0){as()}else{c[C+16>>2]=h;c[h+24>>2]=C;break}}}while(0);h=c[d+(b+20)>>2]|0;if((h|0)==0){break}if(h>>>0<(c[840]|0)>>>0){as()}else{c[C+20>>2]=h;c[h+24>>2]=C;break}}}while(0);c[n+4>>2]=A|1;c[n+A>>2]=A;if((n|0)!=(c[841]|0)){F=A;break}c[838]=A;return}else{c[y>>2]=z&-2;c[n+4>>2]=o|1;c[n+o>>2]=o;F=o}}while(0);o=F>>>3;if(F>>>0<256){z=o<<1;y=3384+(z<<2)|0;C=c[836]|0;b=1<<o;do{if((C&b|0)==0){c[836]=C|b;G=y;H=3384+(z+2<<2)|0}else{o=3384+(z+2<<2)|0;d=c[o>>2]|0;if(d>>>0>=(c[840]|0)>>>0){G=d;H=o;break}as()}}while(0);c[H>>2]=n;c[G+12>>2]=n;c[n+8>>2]=G;c[n+12>>2]=y;return}y=n;G=F>>>8;do{if((G|0)==0){I=0}else{if(F>>>0>16777215){I=31;break}H=(G+1048320|0)>>>16&8;z=G<<H;b=(z+520192|0)>>>16&4;C=z<<b;z=(C+245760|0)>>>16&2;o=14-(b|H|z)+(C<<z>>>15)|0;I=F>>>((o+7|0)>>>0)&1|o<<1}}while(0);G=3648+(I<<2)|0;c[n+28>>2]=I;c[n+20>>2]=0;c[n+16>>2]=0;o=c[837]|0;z=1<<I;if((o&z|0)==0){c[837]=o|z;c[G>>2]=y;c[n+24>>2]=G;c[n+12>>2]=n;c[n+8>>2]=n;return}if((I|0)==31){J=0}else{J=25-(I>>>1)|0}I=F<<J;J=c[G>>2]|0;while(1){if((c[J+4>>2]&-8|0)==(F|0)){break}K=J+16+(I>>>31<<2)|0;G=c[K>>2]|0;if((G|0)==0){L=1573;break}else{I=I<<1;J=G}}if((L|0)==1573){if(K>>>0<(c[840]|0)>>>0){as()}c[K>>2]=y;c[n+24>>2]=J;c[n+12>>2]=n;c[n+8>>2]=n;return}K=J+8|0;L=c[K>>2]|0;I=c[840]|0;if(J>>>0<I>>>0){as()}if(L>>>0<I>>>0){as()}c[L+12>>2]=y;c[K>>2]=y;c[n+8>>2]=L;c[n+12>>2]=J;c[n+24>>2]=0;return}function bY(b){b=b|0;var c=0;c=b;while(a[c]|0){c=c+1|0}return c-b|0}function bZ(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=b+e|0;if((e|0)>=20){d=d&255;e=b&3;g=d|d<<8|d<<16|d<<24;h=f&~3;if(e){e=b+4-e|0;while((b|0)<(e|0)){a[b]=d;b=b+1|0}}while((b|0)<(h|0)){c[b>>2]=g;b=b+4|0}}while((b|0)<(f|0)){a[b]=d;b=b+1|0}}function b_(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;f=b|0;if((b&3)==(d&3)){while(b&3){if((e|0)==0)return f|0;a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}while((e|0)>=4){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0;e=e-4|0}}while((e|0)>0){a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}return f|0}function b$(b,c){b=b|0;c=c|0;var d=0;do{a[b+d|0]=a[c+d|0];d=d+1|0}while(a[c+(d-1)|0]|0);return b|0}function b0(b,c){b=b|0;c=c|0;var d=0,e=0;d=b+(bY(b)|0)|0;do{a[d+e|0]=a[c+e|0];e=e+1|0}while(a[c+(e-1)|0]|0);return b|0}function b1(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return(G=b+d+(e>>>0<a>>>0|0)>>>0,e|0)|0}function b2(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return(G=e,a-c>>>0|0)|0}function b3(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){G=b<<c|(a&(1<<c)-1<<32-c)>>>32-c;return a<<c}G=a<<c-32;return 0}function b4(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){G=b>>>c;return a>>>c|(b&(1<<c)-1)<<32-c}G=0;return b>>>c-32|0}function b5(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){G=b>>c;return a>>>c|(b&(1<<c)-1)<<32-c}G=(b|0)<0?-1:0;return b>>c-32|0}function b6(b){b=b|0;var c=0;c=a[n+(b>>>24)|0]|0;if((c|0)<8)return c|0;c=a[n+(b>>16&255)|0]|0;if((c|0)<8)return c+8|0;c=a[n+(b>>8&255)|0]|0;if((c|0)<8)return c+16|0;return(a[n+(b&255)|0]|0)+24|0}function b7(b){b=b|0;var c=0;c=a[m+(b&255)|0]|0;if((c|0)<8)return c|0;c=a[m+(b>>8&255)|0]|0;if((c|0)<8)return c+8|0;c=a[m+(b>>16&255)|0]|0;if((c|0)<8)return c+16|0;return(a[m+(b>>>24)|0]|0)+24|0}function b8(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=ac(d,c)|0;f=a>>>16;a=(e>>>16)+(ac(d,f)|0)|0;d=b>>>16;b=ac(d,c)|0;return(G=(a>>>16)+(ac(d,f)|0)+(((a&65535)+b|0)>>>16)|0,a+b<<16|e&65535|0)|0}function b9(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=b>>31|((b|0)<0?-1:0)<<1;f=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;g=d>>31|((d|0)<0?-1:0)<<1;h=((d|0)<0?-1:0)>>31|((d|0)<0?-1:0)<<1;i=b2(e^a,f^b,e,f)|0;b=G;a=g^e;e=h^f;f=b2((ce(i,b,b2(g^c,h^d,g,h)|0,G,0)|0)^a,G^e,a,e)|0;return(G=G,f)|0}function ca(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0;f=i;i=i+8|0;g=f|0;h=b>>31|((b|0)<0?-1:0)<<1;j=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;k=e>>31|((e|0)<0?-1:0)<<1;l=((e|0)<0?-1:0)>>31|((e|0)<0?-1:0)<<1;m=b2(h^a,j^b,h,j)|0;b=G;a=b2(k^d,l^e,k,l)|0;ce(m,b,a,G,g)|0;a=b2(c[g>>2]^h,c[g+4>>2]^j,h,j)|0;j=G;i=f;return(G=j,a)|0}function cb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=b8(e,a)|0;f=G;return(G=(ac(b,a)|0)+(ac(d,e)|0)+f|f&0,c&-1|0)|0}function cc(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=ce(a,b,c,d,0)|0;return(G=G,e)|0}function cd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;f=i;i=i+8|0;g=f|0;ce(a,b,d,e,g)|0;i=f;return(G=c[g+4>>2]|0,c[g>>2]|0)|0}function ce(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,H=0,I=0,J=0,K=0,L=0,M=0;g=a;h=b;i=h;j=d;k=e;l=k;if((i|0)==0){m=(f|0)!=0;if((l|0)==0){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return(G=n,o)|0}else{if(!m){n=0;o=0;return(G=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=b&0;n=0;o=0;return(G=n,o)|0}}m=(l|0)==0;do{if((j|0)==0){if(m){if((f|0)!=0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return(G=n,o)|0}if((g|0)==0){if((f|0)!=0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return(G=n,o)|0}p=l-1|0;if((p&l|0)==0){if((f|0)!=0){c[f>>2]=a&-1;c[f+4>>2]=p&i|b&0}n=0;o=i>>>((b7(l|0)|0)>>>0);return(G=n,o)|0}p=(b6(l|0)|0)-(b6(i|0)|0)|0;if(p>>>0<=30){q=p+1|0;r=31-p|0;s=q;t=i<<r|g>>>(q>>>0);u=i>>>(q>>>0);v=0;w=g<<r;break}if((f|0)==0){n=0;o=0;return(G=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=h|b&0;n=0;o=0;return(G=n,o)|0}else{if(!m){r=(b6(l|0)|0)-(b6(i|0)|0)|0;if(r>>>0<=31){q=r+1|0;p=31-r|0;x=r-31>>31;s=q;t=g>>>(q>>>0)&x|i<<p;u=i>>>(q>>>0)&x;v=0;w=g<<p;break}if((f|0)==0){n=0;o=0;return(G=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=h|b&0;n=0;o=0;return(G=n,o)|0}p=j-1|0;if((p&j|0)!=0){x=(b6(j|0)|0)+33-(b6(i|0)|0)|0;q=64-x|0;r=32-x|0;y=r>>31;z=x-32|0;A=z>>31;s=x;t=r-1>>31&i>>>(z>>>0)|(i<<r|g>>>(x>>>0))&A;u=A&i>>>(x>>>0);v=g<<q&y;w=(i<<q|g>>>(z>>>0))&y|g<<r&x-33>>31;break}if((f|0)!=0){c[f>>2]=p&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a&-1|0;return(G=n,o)|0}else{p=b7(j|0)|0;n=i>>>(p>>>0)|0;o=i<<32-p|g>>>(p>>>0)|0;return(G=n,o)|0}}}while(0);if((s|0)==0){B=w;C=v;D=u;E=t;F=0;H=0}else{g=d&-1|0;d=k|e&0;e=b1(g,d,-1,-1)|0;k=G;i=w;w=v;v=u;u=t;t=s;s=0;while(1){I=w>>>31|i<<1;J=s|w<<1;j=u<<1|i>>>31|0;a=u>>>31|v<<1|0;b2(e,k,j,a)|0;b=G;h=b>>31|((b|0)<0?-1:0)<<1;K=h&1;L=b2(j,a,h&g,(((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1)&d)|0;M=G;b=t-1|0;if((b|0)==0){break}else{i=I;w=J;v=M;u=L;t=b;s=K}}B=I;C=J;D=M;E=L;F=0;H=K}K=C;C=0;if((f|0)!=0){c[f>>2]=E;c[f+4>>2]=D}n=(K|0)>>>31|(B|C)<<1|(C<<1|K>>>31)&0|F;o=(K<<1|0>>>31)&-2|H;return(G=n,o)|0}function cf(a,b){a=a|0;b=b|0;return a3[a&1](b|0)|0}function cg(a){a=a|0;a4[a&1]()}function ch(a,b,c){a=a|0;b=b|0;c=c|0;return a5[a&1](b|0,c|0)|0}function ci(a,b){a=a|0;b=b|0;a6[a&1](b|0)}function cj(a){a=a|0;ad(0);return 0}function ck(){ad(1)}function cl(a,b){a=a|0;b=b|0;ad(2);return 0}function cm(a){a=a|0;ad(3)}
// EMSCRIPTEN_END_FUNCS
var a3=[cj,cj];var a4=[ck,ck];var a5=[cl,cl];var a6=[cm,cm];return{_strlen:bY,_strcat:b0,_lwes_event_set_BOOLEAN:bG,_lwes_event_destroy:bz,_lwes_event_set_U_INT_64:bE,_lwes_event_create:bx,_lwes_event_type_db_get_attr_type:bQ,_memset:bZ,_memcpy:b_,_lwes_event_set_INT_64:bF,_lwes_event_set_IP_ADDR_w_string:bL,_realloc:bU,_lwes_event_set_U_INT_16:bB,_lwes_event_set_U_INT_32:bC,_lwes_emitter_create:bn,_lwes_event_type_db_create:bM,_free:bT,_lwes_event_set_STRING:bH,_lwes_event_set_U_INT_64_w_string:bJ,_lwes_event_set_INT_32:bD,_lwes_event_set_INT_16:by,_malloc:bS,_lwes_emitter_emit:bp,_lwes_event_set_INT_64_w_string:bK,_strcpy:b$,stackAlloc:a7,stackSave:a8,stackRestore:a9,setThrew:ba,setTempRet0:bd,setTempRet1:be,setTempRet2:bf,setTempRet3:bg,setTempRet4:bh,setTempRet5:bi,setTempRet6:bj,setTempRet7:bk,setTempRet8:bl,setTempRet9:bm,dynCall_ii:cf,dynCall_v:cg,dynCall_iii:ch,dynCall_vi:ci}})
// EMSCRIPTEN_END_ASM
({ "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array }, { "abort": abort, "assert": assert, "asmPrintInt": asmPrintInt, "asmPrintFloat": asmPrintFloat, "min": Math_min, "invoke_ii": invoke_ii, "invoke_v": invoke_v, "invoke_iii": invoke_iii, "invoke_vi": invoke_vi, "_strncmp": _strncmp, "_llvm_lifetime_end": _llvm_lifetime_end, "_htonl": _htonl, "_snprintf": _snprintf, "_fgetc": _fgetc, "_fclose": _fclose, "_abort": _abort, "_fprintf": _fprintf, "_close": _close, "_strtoull": _strtoull, "_pread": _pread, "_fopen": _fopen, "__reallyNegative": __reallyNegative, "_htons": _htons, "_clearerr": _clearerr, "_sysconf": _sysconf, "_open": _open, "___setErrNo": ___setErrNo, "_fwrite": _fwrite, "_inet_addr": _inet_addr, "_send": _send, "_write": _write, "_exit": _exit, "_sprintf": _sprintf, "_strdup": _strdup, "_isspace": _isspace, "_fread": _fread, "_isatty": _isatty, "_setsockopt": _setsockopt, "_read": _read, "_ferror": _ferror, "__formatString": __formatString, "_js_send_bytes": _js_send_bytes, "_recv": _recv, "__parseInt64": __parseInt64, "_fileno": _fileno, "_pwrite": _pwrite, "_socket": _socket, "_fsync": _fsync, "___errno_location": ___errno_location, "_llvm_lifetime_start": _llvm_lifetime_start, "_sbrk": _sbrk, "_time": _time, "__exit": __exit, "_strcmp": _strcmp, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8, "ctlz_i8": ctlz_i8, "NaN": NaN, "Infinity": Infinity, "_stdout": _stdout, "_stderr": _stderr, "_stdin": _stdin }, buffer);
var _strlen = Module["_strlen"] = asm["_strlen"];
var _strcat = Module["_strcat"] = asm["_strcat"];
var _lwes_event_set_BOOLEAN = Module["_lwes_event_set_BOOLEAN"] = asm["_lwes_event_set_BOOLEAN"];
var _lwes_event_destroy = Module["_lwes_event_destroy"] = asm["_lwes_event_destroy"];
var _lwes_event_set_U_INT_64 = Module["_lwes_event_set_U_INT_64"] = asm["_lwes_event_set_U_INT_64"];
var _lwes_event_create = Module["_lwes_event_create"] = asm["_lwes_event_create"];
var _lwes_event_type_db_get_attr_type = Module["_lwes_event_type_db_get_attr_type"] = asm["_lwes_event_type_db_get_attr_type"];
var _memset = Module["_memset"] = asm["_memset"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _lwes_event_set_INT_64 = Module["_lwes_event_set_INT_64"] = asm["_lwes_event_set_INT_64"];
var _lwes_event_set_IP_ADDR_w_string = Module["_lwes_event_set_IP_ADDR_w_string"] = asm["_lwes_event_set_IP_ADDR_w_string"];
var _realloc = Module["_realloc"] = asm["_realloc"];
var _lwes_event_set_U_INT_16 = Module["_lwes_event_set_U_INT_16"] = asm["_lwes_event_set_U_INT_16"];
var _lwes_event_set_U_INT_32 = Module["_lwes_event_set_U_INT_32"] = asm["_lwes_event_set_U_INT_32"];
var _lwes_emitter_create = Module["_lwes_emitter_create"] = asm["_lwes_emitter_create"];
var _lwes_event_type_db_create = Module["_lwes_event_type_db_create"] = asm["_lwes_event_type_db_create"];
var _free = Module["_free"] = asm["_free"];
var _lwes_event_set_STRING = Module["_lwes_event_set_STRING"] = asm["_lwes_event_set_STRING"];
var _lwes_event_set_U_INT_64_w_string = Module["_lwes_event_set_U_INT_64_w_string"] = asm["_lwes_event_set_U_INT_64_w_string"];
var _lwes_event_set_INT_32 = Module["_lwes_event_set_INT_32"] = asm["_lwes_event_set_INT_32"];
var _lwes_event_set_INT_16 = Module["_lwes_event_set_INT_16"] = asm["_lwes_event_set_INT_16"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _lwes_emitter_emit = Module["_lwes_emitter_emit"] = asm["_lwes_emitter_emit"];
var _lwes_event_set_INT_64_w_string = Module["_lwes_event_set_INT_64_w_string"] = asm["_lwes_event_set_INT_64_w_string"];
var _strcpy = Module["_strcpy"] = asm["_strcpy"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
Runtime.stackAlloc = function(size) { return asm['stackAlloc'](size) };
Runtime.stackSave = function() { return asm['stackSave']() };
Runtime.stackRestore = function(top) { asm['stackRestore'](top) };
// TODO: strip out parts of this we do not need
//======= begin closure i64 code =======
// Copyright 2009 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * @fileoverview Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "long". This
 * implementation is derived from LongLib in GWT.
 *
 */
var i64Math = (function() { // Emscripten wrapper
  var goog = { math: {} };
  /**
   * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
   * values as *signed* integers.  See the from* functions below for more
   * convenient ways of constructing Longs.
   *
   * The internal representation of a long is the two given signed, 32-bit values.
   * We use 32-bit pieces because these are the size of integers on which
   * Javascript performs bit-operations.  For operations like addition and
   * multiplication, we split each number into 16-bit pieces, which can easily be
   * multiplied within Javascript's floating-point representation without overflow
   * or change in sign.
   *
   * In the algorithms below, we frequently reduce the negative case to the
   * positive case by negating the input(s) and then post-processing the result.
   * Note that we must ALWAYS check specially whether those values are MIN_VALUE
   * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
   * a positive number, it overflows back into a negative).  Not handling this
   * case would often result in infinite recursion.
   *
   * @param {number} low  The low (signed) 32 bits of the long.
   * @param {number} high  The high (signed) 32 bits of the long.
   * @constructor
   */
  goog.math.Long = function(low, high) {
    /**
     * @type {number}
     * @private
     */
    this.low_ = low | 0;  // force into 32 signed bits.
    /**
     * @type {number}
     * @private
     */
    this.high_ = high | 0;  // force into 32 signed bits.
  };
  // NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
  // from* methods on which they depend.
  /**
   * A cache of the Long representations of small integer values.
   * @type {!Object}
   * @private
   */
  goog.math.Long.IntCache_ = {};
  /**
   * Returns a Long representing the given (32-bit) integer value.
   * @param {number} value The 32-bit integer in question.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromInt = function(value) {
    if (-128 <= value && value < 128) {
      var cachedObj = goog.math.Long.IntCache_[value];
      if (cachedObj) {
        return cachedObj;
      }
    }
    var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
    if (-128 <= value && value < 128) {
      goog.math.Long.IntCache_[value] = obj;
    }
    return obj;
  };
  /**
   * Returns a Long representing the given value, provided that it is a finite
   * number.  Otherwise, zero is returned.
   * @param {number} value The number in question.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromNumber = function(value) {
    if (isNaN(value) || !isFinite(value)) {
      return goog.math.Long.ZERO;
    } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
      return goog.math.Long.MIN_VALUE;
    } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
      return goog.math.Long.MAX_VALUE;
    } else if (value < 0) {
      return goog.math.Long.fromNumber(-value).negate();
    } else {
      return new goog.math.Long(
          (value % goog.math.Long.TWO_PWR_32_DBL_) | 0,
          (value / goog.math.Long.TWO_PWR_32_DBL_) | 0);
    }
  };
  /**
   * Returns a Long representing the 64-bit integer that comes by concatenating
   * the given high and low bits.  Each is assumed to use 32 bits.
   * @param {number} lowBits The low 32-bits.
   * @param {number} highBits The high 32-bits.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromBits = function(lowBits, highBits) {
    return new goog.math.Long(lowBits, highBits);
  };
  /**
   * Returns a Long representation of the given string, written using the given
   * radix.
   * @param {string} str The textual representation of the Long.
   * @param {number=} opt_radix The radix in which the text is written.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromString = function(str, opt_radix) {
    if (str.length == 0) {
      throw Error('number format error: empty string');
    }
    var radix = opt_radix || 10;
    if (radix < 2 || 36 < radix) {
      throw Error('radix out of range: ' + radix);
    }
    if (str.charAt(0) == '-') {
      return goog.math.Long.fromString(str.substring(1), radix).negate();
    } else if (str.indexOf('-') >= 0) {
      throw Error('number format error: interior "-" character: ' + str);
    }
    // Do several (8) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));
    var result = goog.math.Long.ZERO;
    for (var i = 0; i < str.length; i += 8) {
      var size = Math.min(8, str.length - i);
      var value = parseInt(str.substring(i, i + size), radix);
      if (size < 8) {
        var power = goog.math.Long.fromNumber(Math.pow(radix, size));
        result = result.multiply(power).add(goog.math.Long.fromNumber(value));
      } else {
        result = result.multiply(radixToPower);
        result = result.add(goog.math.Long.fromNumber(value));
      }
    }
    return result;
  };
  // NOTE: the compiler should inline these constant values below and then remove
  // these variables, so there should be no runtime penalty for these.
  /**
   * Number used repeated below in calculations.  This must appear before the
   * first call to any from* function below.
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_32_DBL_ =
      goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_31_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ / 2;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_48_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_64_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_63_DBL_ =
      goog.math.Long.TWO_PWR_64_DBL_ / 2;
  /** @type {!goog.math.Long} */
  goog.math.Long.ZERO = goog.math.Long.fromInt(0);
  /** @type {!goog.math.Long} */
  goog.math.Long.ONE = goog.math.Long.fromInt(1);
  /** @type {!goog.math.Long} */
  goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);
  /** @type {!goog.math.Long} */
  goog.math.Long.MAX_VALUE =
      goog.math.Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);
  /** @type {!goog.math.Long} */
  goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 0x80000000 | 0);
  /**
   * @type {!goog.math.Long}
   * @private
   */
  goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);
  /** @return {number} The value, assuming it is a 32-bit integer. */
  goog.math.Long.prototype.toInt = function() {
    return this.low_;
  };
  /** @return {number} The closest floating-point representation to this value. */
  goog.math.Long.prototype.toNumber = function() {
    return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ +
           this.getLowBitsUnsigned();
  };
  /**
   * @param {number=} opt_radix The radix in which the text should be written.
   * @return {string} The textual representation of this value.
   */
  goog.math.Long.prototype.toString = function(opt_radix) {
    var radix = opt_radix || 10;
    if (radix < 2 || 36 < radix) {
      throw Error('radix out of range: ' + radix);
    }
    if (this.isZero()) {
      return '0';
    }
    if (this.isNegative()) {
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        // We need to change the Long value before it can be negated, so we remove
        // the bottom-most digit in this base and then recurse to do the rest.
        var radixLong = goog.math.Long.fromNumber(radix);
        var div = this.div(radixLong);
        var rem = div.multiply(radixLong).subtract(this);
        return div.toString(radix) + rem.toInt().toString(radix);
      } else {
        return '-' + this.negate().toString(radix);
      }
    }
    // Do several (6) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));
    var rem = this;
    var result = '';
    while (true) {
      var remDiv = rem.div(radixToPower);
      var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
      var digits = intval.toString(radix);
      rem = remDiv;
      if (rem.isZero()) {
        return digits + result;
      } else {
        while (digits.length < 6) {
          digits = '0' + digits;
        }
        result = '' + digits + result;
      }
    }
  };
  /** @return {number} The high 32-bits as a signed value. */
  goog.math.Long.prototype.getHighBits = function() {
    return this.high_;
  };
  /** @return {number} The low 32-bits as a signed value. */
  goog.math.Long.prototype.getLowBits = function() {
    return this.low_;
  };
  /** @return {number} The low 32-bits as an unsigned value. */
  goog.math.Long.prototype.getLowBitsUnsigned = function() {
    return (this.low_ >= 0) ?
        this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
  };
  /**
   * @return {number} Returns the number of bits needed to represent the absolute
   *     value of this Long.
   */
  goog.math.Long.prototype.getNumBitsAbs = function() {
    if (this.isNegative()) {
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        return 64;
      } else {
        return this.negate().getNumBitsAbs();
      }
    } else {
      var val = this.high_ != 0 ? this.high_ : this.low_;
      for (var bit = 31; bit > 0; bit--) {
        if ((val & (1 << bit)) != 0) {
          break;
        }
      }
      return this.high_ != 0 ? bit + 33 : bit + 1;
    }
  };
  /** @return {boolean} Whether this value is zero. */
  goog.math.Long.prototype.isZero = function() {
    return this.high_ == 0 && this.low_ == 0;
  };
  /** @return {boolean} Whether this value is negative. */
  goog.math.Long.prototype.isNegative = function() {
    return this.high_ < 0;
  };
  /** @return {boolean} Whether this value is odd. */
  goog.math.Long.prototype.isOdd = function() {
    return (this.low_ & 1) == 1;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long equals the other.
   */
  goog.math.Long.prototype.equals = function(other) {
    return (this.high_ == other.high_) && (this.low_ == other.low_);
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long does not equal the other.
   */
  goog.math.Long.prototype.notEquals = function(other) {
    return (this.high_ != other.high_) || (this.low_ != other.low_);
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is less than the other.
   */
  goog.math.Long.prototype.lessThan = function(other) {
    return this.compare(other) < 0;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is less than or equal to the other.
   */
  goog.math.Long.prototype.lessThanOrEqual = function(other) {
    return this.compare(other) <= 0;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is greater than the other.
   */
  goog.math.Long.prototype.greaterThan = function(other) {
    return this.compare(other) > 0;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is greater than or equal to the other.
   */
  goog.math.Long.prototype.greaterThanOrEqual = function(other) {
    return this.compare(other) >= 0;
  };
  /**
   * Compares this Long with the given one.
   * @param {goog.math.Long} other Long to compare against.
   * @return {number} 0 if they are the same, 1 if the this is greater, and -1
   *     if the given one is greater.
   */
  goog.math.Long.prototype.compare = function(other) {
    if (this.equals(other)) {
      return 0;
    }
    var thisNeg = this.isNegative();
    var otherNeg = other.isNegative();
    if (thisNeg && !otherNeg) {
      return -1;
    }
    if (!thisNeg && otherNeg) {
      return 1;
    }
    // at this point, the signs are the same, so subtraction will not overflow
    if (this.subtract(other).isNegative()) {
      return -1;
    } else {
      return 1;
    }
  };
  /** @return {!goog.math.Long} The negation of this value. */
  goog.math.Long.prototype.negate = function() {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.MIN_VALUE;
    } else {
      return this.not().add(goog.math.Long.ONE);
    }
  };
  /**
   * Returns the sum of this and the given Long.
   * @param {goog.math.Long} other Long to add to this one.
   * @return {!goog.math.Long} The sum of this and the given Long.
   */
  goog.math.Long.prototype.add = function(other) {
    // Divide each number into 4 chunks of 16 bits, and then sum the chunks.
    var a48 = this.high_ >>> 16;
    var a32 = this.high_ & 0xFFFF;
    var a16 = this.low_ >>> 16;
    var a00 = this.low_ & 0xFFFF;
    var b48 = other.high_ >>> 16;
    var b32 = other.high_ & 0xFFFF;
    var b16 = other.low_ >>> 16;
    var b00 = other.low_ & 0xFFFF;
    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += a00 + b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 + b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 + b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 + b48;
    c48 &= 0xFFFF;
    return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
  };
  /**
   * Returns the difference of this and the given Long.
   * @param {goog.math.Long} other Long to subtract from this.
   * @return {!goog.math.Long} The difference of this and the given Long.
   */
  goog.math.Long.prototype.subtract = function(other) {
    return this.add(other.negate());
  };
  /**
   * Returns the product of this and the given long.
   * @param {goog.math.Long} other Long to multiply with this.
   * @return {!goog.math.Long} The product of this and the other.
   */
  goog.math.Long.prototype.multiply = function(other) {
    if (this.isZero()) {
      return goog.math.Long.ZERO;
    } else if (other.isZero()) {
      return goog.math.Long.ZERO;
    }
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
    }
    if (this.isNegative()) {
      if (other.isNegative()) {
        return this.negate().multiply(other.negate());
      } else {
        return this.negate().multiply(other).negate();
      }
    } else if (other.isNegative()) {
      return this.multiply(other.negate()).negate();
    }
    // If both longs are small, use float multiplication
    if (this.lessThan(goog.math.Long.TWO_PWR_24_) &&
        other.lessThan(goog.math.Long.TWO_PWR_24_)) {
      return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
    }
    // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
    // We can skip products that would overflow.
    var a48 = this.high_ >>> 16;
    var a32 = this.high_ & 0xFFFF;
    var a16 = this.low_ >>> 16;
    var a00 = this.low_ & 0xFFFF;
    var b48 = other.high_ >>> 16;
    var b32 = other.high_ & 0xFFFF;
    var b16 = other.low_ >>> 16;
    var b00 = other.low_ & 0xFFFF;
    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += a00 * b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 * b00;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c16 += a00 * b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 * b00;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a16 * b16;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a00 * b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
    c48 &= 0xFFFF;
    return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
  };
  /**
   * Returns this Long divided by the given one.
   * @param {goog.math.Long} other Long by which to divide.
   * @return {!goog.math.Long} This Long divided by the given one.
   */
  goog.math.Long.prototype.div = function(other) {
    if (other.isZero()) {
      throw Error('division by zero');
    } else if (this.isZero()) {
      return goog.math.Long.ZERO;
    }
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      if (other.equals(goog.math.Long.ONE) ||
          other.equals(goog.math.Long.NEG_ONE)) {
        return goog.math.Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
      } else if (other.equals(goog.math.Long.MIN_VALUE)) {
        return goog.math.Long.ONE;
      } else {
        // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
        var halfThis = this.shiftRight(1);
        var approx = halfThis.div(other).shiftLeft(1);
        if (approx.equals(goog.math.Long.ZERO)) {
          return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
        } else {
          var rem = this.subtract(other.multiply(approx));
          var result = approx.add(rem.div(other));
          return result;
        }
      }
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.ZERO;
    }
    if (this.isNegative()) {
      if (other.isNegative()) {
        return this.negate().div(other.negate());
      } else {
        return this.negate().div(other).negate();
      }
    } else if (other.isNegative()) {
      return this.div(other.negate()).negate();
    }
    // Repeat the following until the remainder is less than other:  find a
    // floating-point that approximates remainder / other *from below*, add this
    // into the result, and subtract it from the remainder.  It is critical that
    // the approximate value is less than or equal to the real value so that the
    // remainder never becomes negative.
    var res = goog.math.Long.ZERO;
    var rem = this;
    while (rem.greaterThanOrEqual(other)) {
      // Approximate the result of division. This may be a little greater or
      // smaller than the actual value.
      var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));
      // We will tweak the approximate result by changing it in the 48-th digit or
      // the smallest non-fractional digit, whichever is larger.
      var log2 = Math.ceil(Math.log(approx) / Math.LN2);
      var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);
      // Decrease the approximation until it is smaller than the remainder.  Note
      // that if it is too large, the product overflows and is negative.
      var approxRes = goog.math.Long.fromNumber(approx);
      var approxRem = approxRes.multiply(other);
      while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
        approx -= delta;
        approxRes = goog.math.Long.fromNumber(approx);
        approxRem = approxRes.multiply(other);
      }
      // We know the answer can't be zero... and actually, zero would cause
      // infinite recursion since we would make no progress.
      if (approxRes.isZero()) {
        approxRes = goog.math.Long.ONE;
      }
      res = res.add(approxRes);
      rem = rem.subtract(approxRem);
    }
    return res;
  };
  /**
   * Returns this Long modulo the given one.
   * @param {goog.math.Long} other Long by which to mod.
   * @return {!goog.math.Long} This Long modulo the given one.
   */
  goog.math.Long.prototype.modulo = function(other) {
    return this.subtract(this.div(other).multiply(other));
  };
  /** @return {!goog.math.Long} The bitwise-NOT of this value. */
  goog.math.Long.prototype.not = function() {
    return goog.math.Long.fromBits(~this.low_, ~this.high_);
  };
  /**
   * Returns the bitwise-AND of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to AND.
   * @return {!goog.math.Long} The bitwise-AND of this and the other.
   */
  goog.math.Long.prototype.and = function(other) {
    return goog.math.Long.fromBits(this.low_ & other.low_,
                                   this.high_ & other.high_);
  };
  /**
   * Returns the bitwise-OR of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to OR.
   * @return {!goog.math.Long} The bitwise-OR of this and the other.
   */
  goog.math.Long.prototype.or = function(other) {
    return goog.math.Long.fromBits(this.low_ | other.low_,
                                   this.high_ | other.high_);
  };
  /**
   * Returns the bitwise-XOR of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to XOR.
   * @return {!goog.math.Long} The bitwise-XOR of this and the other.
   */
  goog.math.Long.prototype.xor = function(other) {
    return goog.math.Long.fromBits(this.low_ ^ other.low_,
                                   this.high_ ^ other.high_);
  };
  /**
   * Returns this Long with bits shifted to the left by the given amount.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the left by the given amount.
   */
  goog.math.Long.prototype.shiftLeft = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var low = this.low_;
      if (numBits < 32) {
        var high = this.high_;
        return goog.math.Long.fromBits(
            low << numBits,
            (high << numBits) | (low >>> (32 - numBits)));
      } else {
        return goog.math.Long.fromBits(0, low << (numBits - 32));
      }
    }
  };
  /**
   * Returns this Long with bits shifted to the right by the given amount.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the right by the given amount.
   */
  goog.math.Long.prototype.shiftRight = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var high = this.high_;
      if (numBits < 32) {
        var low = this.low_;
        return goog.math.Long.fromBits(
            (low >>> numBits) | (high << (32 - numBits)),
            high >> numBits);
      } else {
        return goog.math.Long.fromBits(
            high >> (numBits - 32),
            high >= 0 ? 0 : -1);
      }
    }
  };
  /**
   * Returns this Long with bits shifted to the right by the given amount, with
   * the new top bits matching the current sign bit.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the right by the given amount, with
   *     zeros placed into the new leading bits.
   */
  goog.math.Long.prototype.shiftRightUnsigned = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var high = this.high_;
      if (numBits < 32) {
        var low = this.low_;
        return goog.math.Long.fromBits(
            (low >>> numBits) | (high << (32 - numBits)),
            high >>> numBits);
      } else if (numBits == 32) {
        return goog.math.Long.fromBits(high, 0);
      } else {
        return goog.math.Long.fromBits(high >>> (numBits - 32), 0);
      }
    }
  };
  //======= begin jsbn =======
  var navigator = { appName: 'Modern Browser' }; // polyfill a little
  // Copyright (c) 2005  Tom Wu
  // All Rights Reserved.
  // http://www-cs-students.stanford.edu/~tjw/jsbn/
  /*
   * Copyright (c) 2003-2005  Tom Wu
   * All Rights Reserved.
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND, 
   * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY 
   * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  
   *
   * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
   * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
   * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
   * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
   * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * In addition, the following condition applies:
   *
   * All redistributions must retain an intact copy of this copyright notice
   * and disclaimer.
   */
  // Basic JavaScript BN library - subset useful for RSA encryption.
  // Bits per digit
  var dbits;
  // JavaScript engine analysis
  var canary = 0xdeadbeefcafe;
  var j_lm = ((canary&0xffffff)==0xefcafe);
  // (public) Constructor
  function BigInteger(a,b,c) {
    if(a != null)
      if("number" == typeof a) this.fromNumber(a,b,c);
      else if(b == null && "string" != typeof a) this.fromString(a,256);
      else this.fromString(a,b);
  }
  // return new, unset BigInteger
  function nbi() { return new BigInteger(null); }
  // am: Compute w_j += (x*this_i), propagate carries,
  // c is initial carry, returns final carry.
  // c < 3*dvalue, x < 2*dvalue, this_i < dvalue
  // We need to select the fastest one that works in this environment.
  // am1: use a single mult and divide to get the high bits,
  // max digit bits should be 26 because
  // max internal value = 2*dvalue^2-2*dvalue (< 2^53)
  function am1(i,x,w,j,c,n) {
    while(--n >= 0) {
      var v = x*this[i++]+w[j]+c;
      c = Math.floor(v/0x4000000);
      w[j++] = v&0x3ffffff;
    }
    return c;
  }
  // am2 avoids a big mult-and-extract completely.
  // Max digit bits should be <= 30 because we do bitwise ops
  // on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
  function am2(i,x,w,j,c,n) {
    var xl = x&0x7fff, xh = x>>15;
    while(--n >= 0) {
      var l = this[i]&0x7fff;
      var h = this[i++]>>15;
      var m = xh*l+h*xl;
      l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
      c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
      w[j++] = l&0x3fffffff;
    }
    return c;
  }
  // Alternately, set max digit bits to 28 since some
  // browsers slow down when dealing with 32-bit numbers.
  function am3(i,x,w,j,c,n) {
    var xl = x&0x3fff, xh = x>>14;
    while(--n >= 0) {
      var l = this[i]&0x3fff;
      var h = this[i++]>>14;
      var m = xh*l+h*xl;
      l = xl*l+((m&0x3fff)<<14)+w[j]+c;
      c = (l>>28)+(m>>14)+xh*h;
      w[j++] = l&0xfffffff;
    }
    return c;
  }
  if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
    BigInteger.prototype.am = am2;
    dbits = 30;
  }
  else if(j_lm && (navigator.appName != "Netscape")) {
    BigInteger.prototype.am = am1;
    dbits = 26;
  }
  else { // Mozilla/Netscape seems to prefer am3
    BigInteger.prototype.am = am3;
    dbits = 28;
  }
  BigInteger.prototype.DB = dbits;
  BigInteger.prototype.DM = ((1<<dbits)-1);
  BigInteger.prototype.DV = (1<<dbits);
  var BI_FP = 52;
  BigInteger.prototype.FV = Math.pow(2,BI_FP);
  BigInteger.prototype.F1 = BI_FP-dbits;
  BigInteger.prototype.F2 = 2*dbits-BI_FP;
  // Digit conversions
  var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
  var BI_RC = new Array();
  var rr,vv;
  rr = "0".charCodeAt(0);
  for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
  rr = "a".charCodeAt(0);
  for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
  rr = "A".charCodeAt(0);
  for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
  function int2char(n) { return BI_RM.charAt(n); }
  function intAt(s,i) {
    var c = BI_RC[s.charCodeAt(i)];
    return (c==null)?-1:c;
  }
  // (protected) copy this to r
  function bnpCopyTo(r) {
    for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
    r.t = this.t;
    r.s = this.s;
  }
  // (protected) set from integer value x, -DV <= x < DV
  function bnpFromInt(x) {
    this.t = 1;
    this.s = (x<0)?-1:0;
    if(x > 0) this[0] = x;
    else if(x < -1) this[0] = x+DV;
    else this.t = 0;
  }
  // return bigint initialized to value
  function nbv(i) { var r = nbi(); r.fromInt(i); return r; }
  // (protected) set from string and radix
  function bnpFromString(s,b) {
    var k;
    if(b == 16) k = 4;
    else if(b == 8) k = 3;
    else if(b == 256) k = 8; // byte array
    else if(b == 2) k = 1;
    else if(b == 32) k = 5;
    else if(b == 4) k = 2;
    else { this.fromRadix(s,b); return; }
    this.t = 0;
    this.s = 0;
    var i = s.length, mi = false, sh = 0;
    while(--i >= 0) {
      var x = (k==8)?s[i]&0xff:intAt(s,i);
      if(x < 0) {
        if(s.charAt(i) == "-") mi = true;
        continue;
      }
      mi = false;
      if(sh == 0)
        this[this.t++] = x;
      else if(sh+k > this.DB) {
        this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
        this[this.t++] = (x>>(this.DB-sh));
      }
      else
        this[this.t-1] |= x<<sh;
      sh += k;
      if(sh >= this.DB) sh -= this.DB;
    }
    if(k == 8 && (s[0]&0x80) != 0) {
      this.s = -1;
      if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
    }
    this.clamp();
    if(mi) BigInteger.ZERO.subTo(this,this);
  }
  // (protected) clamp off excess high words
  function bnpClamp() {
    var c = this.s&this.DM;
    while(this.t > 0 && this[this.t-1] == c) --this.t;
  }
  // (public) return string representation in given radix
  function bnToString(b) {
    if(this.s < 0) return "-"+this.negate().toString(b);
    var k;
    if(b == 16) k = 4;
    else if(b == 8) k = 3;
    else if(b == 2) k = 1;
    else if(b == 32) k = 5;
    else if(b == 4) k = 2;
    else return this.toRadix(b);
    var km = (1<<k)-1, d, m = false, r = "", i = this.t;
    var p = this.DB-(i*this.DB)%k;
    if(i-- > 0) {
      if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
      while(i >= 0) {
        if(p < k) {
          d = (this[i]&((1<<p)-1))<<(k-p);
          d |= this[--i]>>(p+=this.DB-k);
        }
        else {
          d = (this[i]>>(p-=k))&km;
          if(p <= 0) { p += this.DB; --i; }
        }
        if(d > 0) m = true;
        if(m) r += int2char(d);
      }
    }
    return m?r:"0";
  }
  // (public) -this
  function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }
  // (public) |this|
  function bnAbs() { return (this.s<0)?this.negate():this; }
  // (public) return + if this > a, - if this < a, 0 if equal
  function bnCompareTo(a) {
    var r = this.s-a.s;
    if(r != 0) return r;
    var i = this.t;
    r = i-a.t;
    if(r != 0) return (this.s<0)?-r:r;
    while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
    return 0;
  }
  // returns bit length of the integer x
  function nbits(x) {
    var r = 1, t;
    if((t=x>>>16) != 0) { x = t; r += 16; }
    if((t=x>>8) != 0) { x = t; r += 8; }
    if((t=x>>4) != 0) { x = t; r += 4; }
    if((t=x>>2) != 0) { x = t; r += 2; }
    if((t=x>>1) != 0) { x = t; r += 1; }
    return r;
  }
  // (public) return the number of bits in "this"
  function bnBitLength() {
    if(this.t <= 0) return 0;
    return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
  }
  // (protected) r = this << n*DB
  function bnpDLShiftTo(n,r) {
    var i;
    for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
    for(i = n-1; i >= 0; --i) r[i] = 0;
    r.t = this.t+n;
    r.s = this.s;
  }
  // (protected) r = this >> n*DB
  function bnpDRShiftTo(n,r) {
    for(var i = n; i < this.t; ++i) r[i-n] = this[i];
    r.t = Math.max(this.t-n,0);
    r.s = this.s;
  }
  // (protected) r = this << n
  function bnpLShiftTo(n,r) {
    var bs = n%this.DB;
    var cbs = this.DB-bs;
    var bm = (1<<cbs)-1;
    var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
    for(i = this.t-1; i >= 0; --i) {
      r[i+ds+1] = (this[i]>>cbs)|c;
      c = (this[i]&bm)<<bs;
    }
    for(i = ds-1; i >= 0; --i) r[i] = 0;
    r[ds] = c;
    r.t = this.t+ds+1;
    r.s = this.s;
    r.clamp();
  }
  // (protected) r = this >> n
  function bnpRShiftTo(n,r) {
    r.s = this.s;
    var ds = Math.floor(n/this.DB);
    if(ds >= this.t) { r.t = 0; return; }
    var bs = n%this.DB;
    var cbs = this.DB-bs;
    var bm = (1<<bs)-1;
    r[0] = this[ds]>>bs;
    for(var i = ds+1; i < this.t; ++i) {
      r[i-ds-1] |= (this[i]&bm)<<cbs;
      r[i-ds] = this[i]>>bs;
    }
    if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
    r.t = this.t-ds;
    r.clamp();
  }
  // (protected) r = this - a
  function bnpSubTo(a,r) {
    var i = 0, c = 0, m = Math.min(a.t,this.t);
    while(i < m) {
      c += this[i]-a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    if(a.t < this.t) {
      c -= a.s;
      while(i < this.t) {
        c += this[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += this.s;
    }
    else {
      c += this.s;
      while(i < a.t) {
        c -= a[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c -= a.s;
    }
    r.s = (c<0)?-1:0;
    if(c < -1) r[i++] = this.DV+c;
    else if(c > 0) r[i++] = c;
    r.t = i;
    r.clamp();
  }
  // (protected) r = this * a, r != this,a (HAC 14.12)
  // "this" should be the larger one if appropriate.
  function bnpMultiplyTo(a,r) {
    var x = this.abs(), y = a.abs();
    var i = x.t;
    r.t = i+y.t;
    while(--i >= 0) r[i] = 0;
    for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
    r.s = 0;
    r.clamp();
    if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
  }
  // (protected) r = this^2, r != this (HAC 14.16)
  function bnpSquareTo(r) {
    var x = this.abs();
    var i = r.t = 2*x.t;
    while(--i >= 0) r[i] = 0;
    for(i = 0; i < x.t-1; ++i) {
      var c = x.am(i,x[i],r,2*i,0,1);
      if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
        r[i+x.t] -= x.DV;
        r[i+x.t+1] = 1;
      }
    }
    if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
    r.s = 0;
    r.clamp();
  }
  // (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
  // r != q, this != m.  q or r may be null.
  function bnpDivRemTo(m,q,r) {
    var pm = m.abs();
    if(pm.t <= 0) return;
    var pt = this.abs();
    if(pt.t < pm.t) {
      if(q != null) q.fromInt(0);
      if(r != null) this.copyTo(r);
      return;
    }
    if(r == null) r = nbi();
    var y = nbi(), ts = this.s, ms = m.s;
    var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
    if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
    else { pm.copyTo(y); pt.copyTo(r); }
    var ys = y.t;
    var y0 = y[ys-1];
    if(y0 == 0) return;
    var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
    var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
    var i = r.t, j = i-ys, t = (q==null)?nbi():q;
    y.dlShiftTo(j,t);
    if(r.compareTo(t) >= 0) {
      r[r.t++] = 1;
      r.subTo(t,r);
    }
    BigInteger.ONE.dlShiftTo(ys,t);
    t.subTo(y,y);	// "negative" y so we can replace sub with am later
    while(y.t < ys) y[y.t++] = 0;
    while(--j >= 0) {
      // Estimate quotient digit
      var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
      if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
        y.dlShiftTo(j,t);
        r.subTo(t,r);
        while(r[i] < --qd) r.subTo(t,r);
      }
    }
    if(q != null) {
      r.drShiftTo(ys,q);
      if(ts != ms) BigInteger.ZERO.subTo(q,q);
    }
    r.t = ys;
    r.clamp();
    if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
    if(ts < 0) BigInteger.ZERO.subTo(r,r);
  }
  // (public) this mod a
  function bnMod(a) {
    var r = nbi();
    this.abs().divRemTo(a,null,r);
    if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
    return r;
  }
  // Modular reduction using "classic" algorithm
  function Classic(m) { this.m = m; }
  function cConvert(x) {
    if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
    else return x;
  }
  function cRevert(x) { return x; }
  function cReduce(x) { x.divRemTo(this.m,null,x); }
  function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
  function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }
  Classic.prototype.convert = cConvert;
  Classic.prototype.revert = cRevert;
  Classic.prototype.reduce = cReduce;
  Classic.prototype.mulTo = cMulTo;
  Classic.prototype.sqrTo = cSqrTo;
  // (protected) return "-1/this % 2^DB"; useful for Mont. reduction
  // justification:
  //         xy == 1 (mod m)
  //         xy =  1+km
  //   xy(2-xy) = (1+km)(1-km)
  // x[y(2-xy)] = 1-k^2m^2
  // x[y(2-xy)] == 1 (mod m^2)
  // if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
  // should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
  // JS multiply "overflows" differently from C/C++, so care is needed here.
  function bnpInvDigit() {
    if(this.t < 1) return 0;
    var x = this[0];
    if((x&1) == 0) return 0;
    var y = x&3;		// y == 1/x mod 2^2
    y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
    y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
    y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
    // last step - calculate inverse mod DV directly;
    // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
    y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
    // we really want the negative inverse, and -DV < y < DV
    return (y>0)?this.DV-y:-y;
  }
  // Montgomery reduction
  function Montgomery(m) {
    this.m = m;
    this.mp = m.invDigit();
    this.mpl = this.mp&0x7fff;
    this.mph = this.mp>>15;
    this.um = (1<<(m.DB-15))-1;
    this.mt2 = 2*m.t;
  }
  // xR mod m
  function montConvert(x) {
    var r = nbi();
    x.abs().dlShiftTo(this.m.t,r);
    r.divRemTo(this.m,null,r);
    if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
    return r;
  }
  // x/R mod m
  function montRevert(x) {
    var r = nbi();
    x.copyTo(r);
    this.reduce(r);
    return r;
  }
  // x = x/R mod m (HAC 14.32)
  function montReduce(x) {
    while(x.t <= this.mt2)	// pad x so am has enough room later
      x[x.t++] = 0;
    for(var i = 0; i < this.m.t; ++i) {
      // faster way of calculating u0 = x[i]*mp mod DV
      var j = x[i]&0x7fff;
      var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
      // use am to combine the multiply-shift-add into one call
      j = i+this.m.t;
      x[j] += this.m.am(0,u0,x,i,0,this.m.t);
      // propagate carry
      while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
    }
    x.clamp();
    x.drShiftTo(this.m.t,x);
    if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
  }
  // r = "x^2/R mod m"; x != r
  function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }
  // r = "xy/R mod m"; x,y != r
  function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
  Montgomery.prototype.convert = montConvert;
  Montgomery.prototype.revert = montRevert;
  Montgomery.prototype.reduce = montReduce;
  Montgomery.prototype.mulTo = montMulTo;
  Montgomery.prototype.sqrTo = montSqrTo;
  // (protected) true iff this is even
  function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }
  // (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
  function bnpExp(e,z) {
    if(e > 0xffffffff || e < 1) return BigInteger.ONE;
    var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
    g.copyTo(r);
    while(--i >= 0) {
      z.sqrTo(r,r2);
      if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
      else { var t = r; r = r2; r2 = t; }
    }
    return z.revert(r);
  }
  // (public) this^e % m, 0 <= e < 2^32
  function bnModPowInt(e,m) {
    var z;
    if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
    return this.exp(e,z);
  }
  // protected
  BigInteger.prototype.copyTo = bnpCopyTo;
  BigInteger.prototype.fromInt = bnpFromInt;
  BigInteger.prototype.fromString = bnpFromString;
  BigInteger.prototype.clamp = bnpClamp;
  BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
  BigInteger.prototype.drShiftTo = bnpDRShiftTo;
  BigInteger.prototype.lShiftTo = bnpLShiftTo;
  BigInteger.prototype.rShiftTo = bnpRShiftTo;
  BigInteger.prototype.subTo = bnpSubTo;
  BigInteger.prototype.multiplyTo = bnpMultiplyTo;
  BigInteger.prototype.squareTo = bnpSquareTo;
  BigInteger.prototype.divRemTo = bnpDivRemTo;
  BigInteger.prototype.invDigit = bnpInvDigit;
  BigInteger.prototype.isEven = bnpIsEven;
  BigInteger.prototype.exp = bnpExp;
  // public
  BigInteger.prototype.toString = bnToString;
  BigInteger.prototype.negate = bnNegate;
  BigInteger.prototype.abs = bnAbs;
  BigInteger.prototype.compareTo = bnCompareTo;
  BigInteger.prototype.bitLength = bnBitLength;
  BigInteger.prototype.mod = bnMod;
  BigInteger.prototype.modPowInt = bnModPowInt;
  // "constants"
  BigInteger.ZERO = nbv(0);
  BigInteger.ONE = nbv(1);
  // jsbn2 stuff
  // (protected) convert from radix string
  function bnpFromRadix(s,b) {
    this.fromInt(0);
    if(b == null) b = 10;
    var cs = this.chunkSize(b);
    var d = Math.pow(b,cs), mi = false, j = 0, w = 0;
    for(var i = 0; i < s.length; ++i) {
      var x = intAt(s,i);
      if(x < 0) {
        if(s.charAt(i) == "-" && this.signum() == 0) mi = true;
        continue;
      }
      w = b*w+x;
      if(++j >= cs) {
        this.dMultiply(d);
        this.dAddOffset(w,0);
        j = 0;
        w = 0;
      }
    }
    if(j > 0) {
      this.dMultiply(Math.pow(b,j));
      this.dAddOffset(w,0);
    }
    if(mi) BigInteger.ZERO.subTo(this,this);
  }
  // (protected) return x s.t. r^x < DV
  function bnpChunkSize(r) { return Math.floor(Math.LN2*this.DB/Math.log(r)); }
  // (public) 0 if this == 0, 1 if this > 0
  function bnSigNum() {
    if(this.s < 0) return -1;
    else if(this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
    else return 1;
  }
  // (protected) this *= n, this >= 0, 1 < n < DV
  function bnpDMultiply(n) {
    this[this.t] = this.am(0,n-1,this,0,0,this.t);
    ++this.t;
    this.clamp();
  }
  // (protected) this += n << w words, this >= 0
  function bnpDAddOffset(n,w) {
    if(n == 0) return;
    while(this.t <= w) this[this.t++] = 0;
    this[w] += n;
    while(this[w] >= this.DV) {
      this[w] -= this.DV;
      if(++w >= this.t) this[this.t++] = 0;
      ++this[w];
    }
  }
  // (protected) convert to radix string
  function bnpToRadix(b) {
    if(b == null) b = 10;
    if(this.signum() == 0 || b < 2 || b > 36) return "0";
    var cs = this.chunkSize(b);
    var a = Math.pow(b,cs);
    var d = nbv(a), y = nbi(), z = nbi(), r = "";
    this.divRemTo(d,y,z);
    while(y.signum() > 0) {
      r = (a+z.intValue()).toString(b).substr(1) + r;
      y.divRemTo(d,y,z);
    }
    return z.intValue().toString(b) + r;
  }
  // (public) return value as integer
  function bnIntValue() {
    if(this.s < 0) {
      if(this.t == 1) return this[0]-this.DV;
      else if(this.t == 0) return -1;
    }
    else if(this.t == 1) return this[0];
    else if(this.t == 0) return 0;
    // assumes 16 < DB < 32
    return ((this[1]&((1<<(32-this.DB))-1))<<this.DB)|this[0];
  }
  // (protected) r = this + a
  function bnpAddTo(a,r) {
    var i = 0, c = 0, m = Math.min(a.t,this.t);
    while(i < m) {
      c += this[i]+a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    if(a.t < this.t) {
      c += a.s;
      while(i < this.t) {
        c += this[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += this.s;
    }
    else {
      c += this.s;
      while(i < a.t) {
        c += a[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += a.s;
    }
    r.s = (c<0)?-1:0;
    if(c > 0) r[i++] = c;
    else if(c < -1) r[i++] = this.DV+c;
    r.t = i;
    r.clamp();
  }
  BigInteger.prototype.fromRadix = bnpFromRadix;
  BigInteger.prototype.chunkSize = bnpChunkSize;
  BigInteger.prototype.signum = bnSigNum;
  BigInteger.prototype.dMultiply = bnpDMultiply;
  BigInteger.prototype.dAddOffset = bnpDAddOffset;
  BigInteger.prototype.toRadix = bnpToRadix;
  BigInteger.prototype.intValue = bnIntValue;
  BigInteger.prototype.addTo = bnpAddTo;
  //======= end jsbn =======
  // Emscripten wrapper
  var Wrapper = {
    abs: function(l, h) {
      var x = new goog.math.Long(l, h);
      var ret;
      if (x.isNegative()) {
        ret = x.negate();
      } else {
        ret = x;
      }
      HEAP32[tempDoublePtr>>2] = ret.low_;
      HEAP32[tempDoublePtr+4>>2] = ret.high_;
    },
    ensureTemps: function() {
      if (Wrapper.ensuredTemps) return;
      Wrapper.ensuredTemps = true;
      Wrapper.two32 = new BigInteger();
      Wrapper.two32.fromString('4294967296', 10);
      Wrapper.two64 = new BigInteger();
      Wrapper.two64.fromString('18446744073709551616', 10);
      Wrapper.temp1 = new BigInteger();
      Wrapper.temp2 = new BigInteger();
    },
    lh2bignum: function(l, h) {
      var a = new BigInteger();
      a.fromString(h.toString(), 10);
      var b = new BigInteger();
      a.multiplyTo(Wrapper.two32, b);
      var c = new BigInteger();
      c.fromString(l.toString(), 10);
      var d = new BigInteger();
      c.addTo(b, d);
      return d;
    },
    stringify: function(l, h, unsigned) {
      var ret = new goog.math.Long(l, h).toString();
      if (unsigned && ret[0] == '-') {
        // unsign slowly using jsbn bignums
        Wrapper.ensureTemps();
        var bignum = new BigInteger();
        bignum.fromString(ret, 10);
        ret = new BigInteger();
        Wrapper.two64.addTo(bignum, ret);
        ret = ret.toString(10);
      }
      return ret;
    },
    fromString: function(str, base, min, max, unsigned) {
      Wrapper.ensureTemps();
      var bignum = new BigInteger();
      bignum.fromString(str, base);
      var bigmin = new BigInteger();
      bigmin.fromString(min, 10);
      var bigmax = new BigInteger();
      bigmax.fromString(max, 10);
      if (unsigned && bignum.compareTo(BigInteger.ZERO) < 0) {
        var temp = new BigInteger();
        bignum.addTo(Wrapper.two64, temp);
        bignum = temp;
      }
      var error = false;
      if (bignum.compareTo(bigmin) < 0) {
        bignum = bigmin;
        error = true;
      } else if (bignum.compareTo(bigmax) > 0) {
        bignum = bigmax;
        error = true;
      }
      var ret = goog.math.Long.fromString(bignum.toString()); // min-max checks should have clamped this to a range goog.math.Long can handle well
      HEAP32[tempDoublePtr>>2] = ret.low_;
      HEAP32[tempDoublePtr+4>>2] = ret.high_;
      if (error) throw 'range error';
    }
  };
  return Wrapper;
})();
//======= end closure i64 code =======
// === Auto-generated postamble setup entry stuff ===
Module['callMain'] = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(!Module['preRun'] || Module['preRun'].length == 0, 'cannot call main when preRun functions remain to be called');
  args = args || [];
  ensureInitRuntime();
  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString("/bin/this.program"), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);
  var ret;
  var initialStackTop = STACKTOP;
  try {
    ret = Module['_main'](argc, argv, 0);
  }
  catch(e) {
    if (e.name == 'ExitStatus') {
      return e.status;
    } else if (e == 'SimulateInfiniteLoop') {
      Module['noExitRuntime'] = true;
    } else {
      throw e;
    }
  } finally {
    STACKTOP = initialStackTop;
  }
  return ret;
}
function run(args) {
  args = args || Module['arguments'];
  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return 0;
  }
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    var toRun = Module['preRun'];
    Module['preRun'] = [];
    for (var i = toRun.length-1; i >= 0; i--) {
      toRun[i]();
    }
    if (runDependencies > 0) {
      // a preRun added a dependency, run will be called later
      return 0;
    }
  }
  function doRun() {
    ensureInitRuntime();
    preMain();
    var ret = 0;
    calledRun = true;
    if (Module['_main'] && shouldRunNow) {
      ret = Module['callMain'](args);
      if (!Module['noExitRuntime']) {
        exitRuntime();
      }
    }
    if (Module['postRun']) {
      if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
      while (Module['postRun'].length > 0) {
        Module['postRun'].pop()();
      }
    }
    return ret;
  }
  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      if (!ABORT) doRun();
    }, 1);
    return 0;
  } else {
    return doRun();
  }
}
Module['run'] = Module.run = run;
// {{PRE_RUN_ADDITIONS}}
(function() {
function assert(check, msg) {
  if (!check) throw msg + new Error().stack;
}
Module['FS_createPath']('/', 'data', true, true);
Module['FS_createDataFile']('/data', 'sample.esf', [70, 111, 111, 66, 97, 114, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 76, 87, 69, 83, 32, 101, 118, 101, 110, 116, 10, 123, 10, 32, 32, 115, 116, 114, 105, 110, 103, 32, 32, 32, 102, 111, 111, 83, 116, 114, 59, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 115, 116, 114, 105, 110, 103, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 105, 110, 116, 49, 54, 32, 32, 32, 32, 102, 111, 111, 49, 54, 59, 32, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 49, 54, 45, 98, 105, 116, 32, 105, 110, 116, 101, 103, 101, 114, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 117, 105, 110, 116, 49, 54, 32, 32, 32, 102, 111, 111, 85, 49, 54, 59, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 49, 54, 45, 98, 105, 116, 32, 117, 110, 115, 105, 103, 110, 101, 100, 32, 105, 110, 116, 101, 103, 101, 114, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 105, 110, 116, 51, 50, 32, 32, 32, 32, 102, 111, 111, 51, 50, 59, 32, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 51, 50, 45, 98, 105, 116, 32, 105, 110, 116, 101, 103, 101, 114, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 117, 105, 110, 116, 51, 50, 32, 32, 32, 102, 111, 111, 85, 51, 50, 59, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 51, 50, 45, 98, 105, 116, 32, 117, 110, 115, 105, 103, 110, 101, 100, 32, 105, 110, 116, 101, 103, 101, 114, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 105, 110, 116, 54, 52, 32, 32, 32, 32, 102, 111, 111, 54, 52, 59, 32, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 54, 52, 45, 98, 105, 116, 32, 105, 110, 116, 101, 103, 101, 114, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 117, 105, 110, 116, 54, 52, 32, 32, 32, 102, 111, 111, 85, 54, 52, 59, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 54, 52, 45, 98, 105, 116, 32, 117, 110, 115, 105, 103, 110, 101, 100, 32, 105, 110, 116, 101, 103, 101, 114, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 98, 111, 111, 108, 101, 97, 110, 32, 32, 102, 111, 111, 66, 111, 111, 108, 59, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 98, 111, 111, 108, 101, 97, 110, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 32, 32, 105, 112, 95, 97, 100, 100, 114, 32, 32, 102, 111, 111, 73, 80, 59, 32, 32, 32, 32, 32, 32, 32, 35, 32, 83, 97, 109, 112, 108, 101, 32, 73, 80, 32, 97, 100, 100, 114, 101, 115, 115, 32, 97, 116, 116, 114, 105, 98, 117, 116, 101, 10, 125, 10], true, true);
})();
if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}
// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}
run();
// {{POST_RUN_ADDITIONS}}
  // {{MODULE_ADDITIONS}}
// Export interface
module.exports = {
  'Emitter' : Emitter
};
