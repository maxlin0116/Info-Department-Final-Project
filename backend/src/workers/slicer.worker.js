const dotenv = require("dotenv");
const connectDatabase = require("../database/db");
const { processNextSliceJob } = require("../services/slicer.service");

dotenv.config();

const pollMs = Math.max(Number(process.env.SLICER_POLL_MS || 3000), 500);
let stopping = false;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await connectDatabase();
  console.log("Bambu Studio slicing worker started");
  while (!stopping) {
    const processed = await processNextSliceJob();
    if (!processed) await wait(pollMs);
  }
}

process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

run().catch((error) => {
  console.error("Slicing worker failed", error);
  process.exit(1);
});
