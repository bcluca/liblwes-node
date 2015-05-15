var uncaughtExceptionListeners = process.listeners('uncaughtException') || [];

function restoreUncaughtExceptionListeners() {
  for (var i = 0; i < uncaughtExceptionListeners.length; i++) {
    process.on('uncaughtException', uncaughtExceptionListeners[i]);
  }
}

function removeUnwantedUncaughtExceptionListener() {
  process.removeAllListeners('uncaughtException');
  restoreUncaughtExceptionListeners();
}
