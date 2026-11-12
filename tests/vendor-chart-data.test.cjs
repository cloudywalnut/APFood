const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { cashflowBridge, productDrivers } = loadTypescript(path.join(__dirname, "../lib/vendor-chart-data.ts"));

test("cashflow bridge reconciles receipts, refunds, expenses and reversals in integer sen", () => {
  const bridge = cashflowBridge({
    demo: 1000,
    counter: 2000,
    duitnow_qr: 3000,
    expense: 2500,
    refund: 1000,
    reversal: 500,
    netSen: 3000,
  });
  assert.equal(bridge.receipts, 6000);
  assert.equal(bridge.net, 3000);
  assert(bridge.reconciled);
  assert.deepEqual(
    bridge.steps.map(({ start, end }) => [start, end]),
    [
      [0, 6000],
      [6000, 3500],
      [3500, 2500],
      [2500, 3000],
      [0, 3000],
    ],
  );
});

test("cashflow can cross zero and flags mismatched reported totals", () => {
  const input = { demo: 100, counter: 0, duitnow_qr: 0, expense: 300, refund: 0, reversal: 0, netSen: -200 };
  assert.equal(cashflowBridge(input).net, -200);
  assert(cashflowBridge(input).reconciled);
  assert.equal(Object.is(cashflowBridge(input).steps[2].value, -0), false);
  assert.equal(cashflowBridge({ ...input, netSen: 200 }).reconciled, false);
});

test("product revenue and portion rankings differ without changing the full-catalogue denominator", () => {
  const items = [
    { id: "a", name: "Tea", units: 10, fulfilledValueSen: 2000 },
    { id: "b", name: "Rice", units: 3, fulfilledValueSen: 3000 },
    { id: "c", name: "Unsold", units: 0, fulfilledValueSen: 0 },
  ];
  assert.equal(productDrivers(items, "revenue").ranked[0].id, "b");
  assert.equal(productDrivers(items, "units").ranked[0].id, "a");
  assert.equal(productDrivers(items, "revenue").total, 5000);
  assert.equal(productDrivers(items, "units").total, 13);
  assert.deepEqual(
    items.map((item) => item.id),
    ["a", "b", "c"],
  );
  assert.equal(productDrivers([], "revenue").total, 0);
});
