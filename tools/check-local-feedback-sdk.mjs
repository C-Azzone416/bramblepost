// Manual test only. Never imports or runs the SDK with real credentials or transport.
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.BRAMBLEPOST_FRAMEBRIAR_SDK_ROOT;
assert(root, "Point BRAMBLEPOST_FRAMEBRIAR_SDK_ROOT at the reviewed official checkout");
const load = (name) => import(pathToFileURL(path.resolve(root, "adapters/browser", name + ".mjs")).href);
const { createPlaytestAccess } = await load("playtest-access");
const { createDurableFeedback } = await load("durable-feedback");
const { prepareLocalFeedback } = await load("local-export");
const gameId = "bramblepost-local-synthetic-fixture";
let fetchAttempts = 0;
const access = createPlaytestAccess({
  gameId,
  origin: "http://localhost:8080",
  store: { subscribe: () => () => {}, read: async () => ({revision: null, session: null}) },
  fetchImpl: async () => { ++fetchAttempts; throw Error("Network disabled"); },
});
await access.start();
assert.equal(access.status().connected, false);
assert.equal(await access.getToken(), undefined);
assert.equal(fetchAttempts, 0);
access.stop();

const rows = new Map();
const queue = {
  all: async () => [...rows.values()],
  add: async (row) => rows.set(row.report.id, row),
  remove: async (id) => rows.delete(id),
  defer: async (id, patch) => Object.assign(rows.get(id), patch),
};
const screenshot = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=", "base64")], {type:"image/png"});
const prepared = await prepareLocalFeedback({blob: screenshot, notes: "Synthetic fixture", captureContext: {
  gameId, scene:"stand-in-preview", platform:"browser", input:"unknown", capturedAt:new Date().toISOString(),
}});
let now = Date.now();
let attempts = 0;
let receipt;
function worker(isOnline) {
  return createDurableFeedback({
    gameId, endpoint:access.endpoint, getToken:() => access.getToken(), queue, isOnline:() => isOnline,
    now:() => now, random:() => 0, onReceipt:(value) => { receipt = value; },
    send:async ({report, media}) => {
      assert.deepEqual(report, prepared.report);
      assert.deepEqual(await media.arrayBuffer(), await screenshot.arrayBuffer());
      if (++attempts === 1) throw Object.assign(Error("Synthetic failure"), {code:"network"});
      if (attempts === 2) return { id: crypto.randomUUID(), gameId, status:"ready" };
      return { id:report.id, gameId, status:"ready" };
    },
  });
}
const first = worker(false);
try {
  await first.start();
  assert.deepEqual(await first.enqueue(prepared), {id:prepared.report.id, gameId, status:"saved-local", sent:false});
  assert.equal(attempts, 0);
} finally { first.stop(); }
const restored = worker(true);
try {
  await restored.start();
  assert.equal(attempts, 1);
  assert.equal(rows.size, 1);
  await restored.resume();
  assert.equal(attempts, 1, "persisted backoff");
  now += 30_000;
  await restored.resume();
  assert.equal(rows.size, 1, "incorrect receipt must not discard the report");
  assert.equal(receipt, undefined);
  now += 30_000;
  await restored.resume();
  assert.equal(attempts, 3);
  assert.equal(rows.size, 0);
  assert.deepEqual(receipt, {id:prepared.report.id, gameId, status:"ready"});
  assert.equal(fetchAttempts, 0);
} finally { restored.stop(); }
console.log("Inert SDK access and synthetic outbox lifecycle passed (no network or persisted user reports)");
