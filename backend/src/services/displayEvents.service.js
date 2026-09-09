const { EventEmitter } = require("events");

const emitter = new EventEmitter();
emitter.setMaxListeners(250);
let version = 0;

function publishDisplayChange(reason = "data_changed") {
  version += 1;
  emitter.emit("change", { version, reason, generatedAt: new Date().toISOString() });
}

function subscribe(listener) {
  emitter.on("change", listener);
  return () => emitter.off("change", listener);
}

module.exports = { publishDisplayChange, subscribe };
