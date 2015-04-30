mergeInto(LibraryManager.library, {

  // Sends LWES payload via Node.js UDP socket
  'js_send_bytes' : function (emitterIndex, buf, len) {
    var data    = Array.prototype.slice.call(HEAPU8, buf, buf + len),
        payload = new Buffer(data),
        emitter = emitters[emitterIndex]
    ;
    emitter.socket.send(payload, 0, len, emitter.port, emitter.address, function () {});
    return 0;
  },

  // Suppressing the setsockopt warning as we are not relying on C sockets
  'setsockopt' : function () {}

});
