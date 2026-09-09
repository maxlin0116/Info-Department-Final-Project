const displayService = require("../services/display.service");
const { subscribe } = require("../services/displayEvents.service");

exports.getSnapshot = async (_req, res, next) => {
  try { res.json(await displayService.getDisplaySnapshot()); } catch (error) { next(error); }
};

exports.stream = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event) => res.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
  send({ reason: "connected", generatedAt: new Date().toISOString() });
  const unsubscribe = subscribe(send);
  const heartbeat = setInterval(() => res.write(`: heartbeat ${Date.now()}\n\n`), 15000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};
