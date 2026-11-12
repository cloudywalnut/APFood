const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { readReportPages } = loadTypescript(path.join(__dirname, "../lib/backend/read-report-pages.ts"));

test("report pagination loads more than 1000 rows in stable order", async () => {
  const rows = Array.from({ length: 1603 }, (_, id) => ({ id }));
  const result = await readReportPages(async (from, to) => ({
    data: rows.slice(from, to + 1),
    count: rows.length,
    error: null,
  }));
  assert.deepEqual(result.data, rows);
});
test("report pagination rejects changing counts and incomplete pages", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  await assert.rejects(
    () =>
      readReportPages(async (from, to) => ({ data: rows.slice(from, to + 1), count: from ? 1002 : 1001, error: null })),
    /complete report/,
  );
  await assert.rejects(() => readReportPages(async () => ({ data: [], count: 1001, error: null })), /complete report/);
});
