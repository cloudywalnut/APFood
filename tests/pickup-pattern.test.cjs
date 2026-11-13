const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { pickupPattern } = loadTypescript(path.join(__dirname, "../lib/pickup-pattern.ts"));

test("pickup time windows preserve totals and correctly label noon and midnight", () => {
  const windows = pickupPattern([
    { hour: 23, count: 4 },
    { hour: 12, count: 7 },
    { hour: 13, count: 2 },
    { hour: 0, count: 1 },
  ]);
  assert.equal(windows.length, 12);
  assert.deepEqual(windows[0], { start: 0, label: "12am–2am", count: 1 });
  assert.deepEqual(windows[6], { start: 12, label: "12pm–2pm", count: 9 });
  assert.deepEqual(windows[11], { start: 22, label: "10pm–12am", count: 4 });
  assert.equal(
    windows.reduce((sum, row) => sum + row.count, 0),
    14,
  );
});

test("sparse and repeated hours aggregate without adding invalid pickup counts", () => {
  const windows = pickupPattern([
    { hour: 8, count: 2 },
    { hour: 8, count: 3 },
    { hour: 24, count: 9 },
    { hour: 6, count: -1 },
  ]);
  assert.equal(windows[4].count, 5);
  assert.equal(
    windows.reduce((sum, row) => sum + row.count, 0),
    5,
  );
  assert(pickupPattern([]).every((row) => row.count === 0));
});
