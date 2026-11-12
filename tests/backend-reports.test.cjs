const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { adminReport } = loadTypescript(path.join(__dirname, "../lib/backend/reports.ts"));
const vendor = { id: "stall-a", zone_id: "zone-a", name: "Stall A", capacity: 20, status: "approved", paused: false };
const now = new Date().toISOString();
const old = new Date(Date.now() - 2 * 86400_000).toISOString();
const uuid = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const line = { itemId: "dish-a", name: "Discounted dish", unit: 900, quantity: 1, extra: false, work: 1 };
const order = (values) => ({
  vendor_id: vendor.id,
  zone_id: vendor.zone_id,
  payment: "counter",
  status: "placed",
  total_sen: 500,
  lines: [line],
  pickup_at: now,
  created_at: now,
  ready_at: null,
  collected_at: null,
  ...values,
});
function clientFor(rows, reportedCount) {
  return {
    from(table) {
      const query = {
        from: 0,
        to: Infinity,
        range(from, to) {
          this.from = from;
          this.to = to;
          return this;
        },
        select() {
          return this;
        },
        order() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        gte() {
          return this;
        },
        lte() {
          return this;
        },
        or() {
          return this;
        },
        then(resolve) {
          resolve({
            data: (rows[table] ?? []).slice(this.from, this.to + 1),
            error: null,
            count: reportedCount?.[table] ?? rows[table]?.length ?? 0,
          });
        },
      };
      return query;
    },
  };
}
test("report keeps collection revenue, ordered value, reversals and analytics on their intended dates", async () => {
  const cash = (n, kind, amount_sen) => ({
    id: uuid(n),
    vendor_id: vendor.id,
    zone_id: vendor.zone_id,
    order_id: kind === "demo" ? uuid(9) : null,
    kind,
    amount_sen,
    label: kind,
    reverses_id: kind === "reversal" ? uuid(2) : null,
    created_at: now,
  });
  const report = await adminReport(
    clientFor({
      vendors: [vendor],
      menu_items: [{ id: "dish-a", vendor_id: vendor.id, name: line.name, stock: 3, active: true }],
      orders: [
        order({ created_at: old, status: "collected", collected_at: now, total_sen: 900 }),
        order({}),
        order({ status: "cancelled", total_sen: 300 }),
      ],
      cash_entries: [cash(1, "demo", 900), cash(2, "expense", 200), cash(3, "reversal", 200)],
    }),
    new URLSearchParams({ days: "1", vendorId: vendor.id }),
  );
  assert.equal(report.finance.netSen, 900);
  assert.equal(report.finance.orderedValueSen, 500);
  assert.equal(report.finance.outstandingCounterSen, 500);
  assert.equal(report.products[0].units, 1);
  assert.equal(report.products[0].fulfilledValueSen, 900);
  assert.equal(report.vendors[0].orderCount, 2);
  assert.equal(
    report.analytics.daily.reduce((sum, row) => sum + row.count, 0),
    2,
  );
  assert.equal(
    report.analytics.hours.reduce((sum, row) => sum + row.count, 0),
    1,
  );
});

test("report rejects silently truncated ledger or order results", async () => {
  for (const table of ["orders", "cash_entries"]) {
    await assert.rejects(
      () =>
        adminReport(
          clientFor({ vendors: [vendor], orders: [], cash_entries: [] }, { [table]: 1001 }),
          new URLSearchParams(),
        ),
      (error) => error.code === "REPORT_RANGE_TOO_LARGE",
    );
  }
});
