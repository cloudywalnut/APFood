const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { netIncomeOutlook } = loadTypescript(path.join(__dirname, "../lib/revenue-outlook.ts"));
const since = "2026-10-31T16:00:00Z",
  asOf = "2026-11-03T04:00:00Z";
const entry = (kind, amount_sen, date = "2026-11-01") => ({ kind, amount_sen, created_at: `${date}T04:00:00Z` });
const entries = [
  entry("counter", 10000),
  entry("expense", 4000),
  entry("refund", 1000),
  entry("reversal", 500),
  entry("duitnow_qr", 10000, "2026-11-02"),
  entry("expense", 4500, "2026-11-02"),
  entry("counter", 90000, "2026-11-03"),
];

test("net outlook reconciles cash entries and excludes partial days without automatic growth", () => {
  const data = netIncomeOutlook(entries, since, asOf);
  assert.equal(data.history.length, 2);
  assert.equal(data.recordedSen, 11000);
  assert.equal(data.baselineSen, 5500 * 30);
  assert.equal(data.scenarioSen, data.baselineSen);
  assert.equal(data.forecast[0].day, "2026-11-03");
  assert.equal(data.forecast.at(-1).scenarioCumulativeSen, data.recordedSen + data.scenarioSen);
});

test("AI adjusts receipts once and monthly horizons never silently compound the adjustment", () => {
  for (const horizon of [30, 60, 90, 180]) {
    const data = netIncomeOutlook(entries, since, asOf, horizon, 10);
    assert.equal(data.forecast.length, horizon);
    assert.equal(data.scenarioSen, 6500 * horizon);
    assert.equal(data.baselineSen, 5500 * horizon);
    assert.ok(data.forecast.every((row) => row.scenarioDailySen === 6500));
  }
});

test("losses remain negative and invalid projection inputs are rejected", () => {
  const loss = netIncomeOutlook([entry("counter", 1000), entry("expense", 5000)], since, asOf, 30);
  assert.ok(loss.baselineSen < 0);
  assert.equal(loss.scenarioSen, loss.baselineSen);
  assert.throws(() => netIncomeOutlook(entries, since, asOf, 365), /supported/);
  assert.throws(() => netIncomeOutlook(entries, since, asOf, 30, NaN), /finite/);
});
