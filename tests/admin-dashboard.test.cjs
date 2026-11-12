const test = require("node:test"),
  assert = require("node:assert/strict");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { adminOutlook, selectedAdminImpact } = loadTypescript("lib/admin-dashboard.ts");
const { overviewFingerprint } = loadTypescript("lib/backend/admin-overview.ts");
const data = {
  asOf: "2026-11-13T04:00:00Z",
  since: "2026-11-06T16:00:00Z",
  previousSince: "2026-10-30T16:00:00Z",
  previousAsOf: "2026-11-06T04:00:00Z",
  days: 7,
  daily: [
    { day: "2026-11-11", netSen: 1000 },
    { day: "2026-11-12", netSen: -200 },
    { day: "2026-11-13", netSen: 90000 },
  ],
};
test("admin outlook excludes partial days, preserves losses and never compounds", () => {
  const rows = adminOutlook(data, 30, 700);
  assert.equal(rows.at(-1).baselineSen, 12000);
  assert.equal(rows.at(-1).optimizedSen, 15000);
  assert.equal(rows[0].baselineSen, 0);
  assert.equal(adminOutlook({ ...data, daily: [{ day: "2026-11-11", netSen: -100 }] }, 30).at(-1).baselineSen, -3000);
});
test("admin optimization counts overlapping vendor impacts once and withholds stale or unquantified effects", () => {
  const insights = {
    source: "gemini",
    recommendations: [
      { id: "a", vendorId: "stall", impactSen: 100 },
      { id: "b", vendorId: "stall", impactSen: 200 },
      { id: "c", vendorId: "other", impactSen: 50 },
      { id: "d", vendorId: "other" },
    ],
  };
  assert.equal(selectedAdminImpact(insights, ["a", "b", "c", "d"]), 250);
  assert.equal(selectedAdminImpact(insights, ["d"]), undefined);
  assert.equal(selectedAdminImpact(insights, ["a"], true), undefined);
  assert.equal(selectedAdminImpact({ ...insights, source: "unavailable" }, ["a"]), undefined);
});
test("admin evidence fingerprints ignore read timestamps but detect financial and scope changes", () => {
  const first = overviewFingerprint(data);
  assert.equal(
    overviewFingerprint({
      ...data,
      asOf: "2026-11-13T04:01:00Z",
      previousAsOf: "2026-11-06T04:01:00Z",
      fingerprint: "old",
    }),
    first,
  );
  assert.notEqual(overviewFingerprint({ ...data, days: 14 }), first);
  assert.notEqual(overviewFingerprint({ ...data, daily: [...data.daily, { day: "2026-11-10", netSen: 1 }] }), first);
});
test("admin AI candidates remain scoped, keep review-only actions and disclose illustrative effects", () => {
  const { adminCandidates, adminChatFacts } = loadTypescript("lib/backend/admin-fif.ts");
  const vendor = {
    id: "stall",
    name: "Stall",
    zone_id: "zone-a",
    status: "approved",
    paused: false,
    orders: 100,
    collected: 90,
    cancelled: 10,
    closed: 100,
    receiptsSen: 90000,
    netSen: 30000,
    expenseSen: 60000,
    overdueCount: 1,
    readyWaiting: 2,
    previousReceiptsSen: 100000,
  };
  const snapshot = {
    ...data,
    summary: { netSen: 30000, receiptsSen: 90000, sharedNetSen: 0 },
    previous: {},
    vendors: [vendor],
    products: [
      {
        id: "dish",
        vendorId: "stall",
        name: "Dish",
        stock: 1,
        active: true,
        units: 20,
        priceSen: 1000,
        revenueSen: 20000,
      },
    ],
    intelligence: {
      vendors: [{ vendorId: "stall", unsuccessfulValueSen: 10000, receiptedOrders: 90, averageReceiptSen: 1000 }],
    },
    demand: [],
    statuses: [],
  };
  const { candidates, targets } = adminCandidates(snapshot);
  assert.ok(candidates.length >= 3);
  assert.ok([...targets.values()].every((t) => t.vendorId === "stall"));
  const financial = [...targets.values()].filter((t) => t.financialOpportunity);
  assert.equal(financial.length, 1);
  assert.ok(candidates.some((c) => c.assumptions.some((a) => a.includes("recovery"))));
  const facts = adminChatFacts(snapshot);
  assert.match(facts.period.asOfMYT, /13 Nov 2026/);
  assert.match(facts.period.asOfMYT, /MYT/);
  assert.match(facts.vendors[0].netCashflowRM, /300/);
  assert.equal("staff" in facts, false);
});
