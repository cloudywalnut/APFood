const test = require("node:test"),
  assert = require("node:assert/strict");
const { loadTypescript } = require("./support/load-typescript.cjs");
const snapshot = {
  asOf: "2026-11-13T04:00:00Z",
  since: "2026-11-06T16:00:00Z",
  previousSince: "2026-10-30T16:00:00Z",
  previousAsOf: "2026-11-06T04:00:00Z",
  days: 7,
  source: "demo",
  summary: { netSen: 500, receiptsSen: 1000, sharedNetSen: 0 },
  previous: { available: true },
  vendors: [
    {
      id: "stall",
      name: "Stall",
      zone_id: "zone-a",
      status: "approved",
      paused: false,
      orders: 10,
      collected: 9,
      cancelled: 1,
      closed: 10,
      receiptsSen: 1000,
      netSen: 500,
      expenseSen: 500,
      overdueCount: 1,
      readyWaiting: 0,
      previousReceiptsSen: 1000,
    },
  ],
  products: [],
  daily: [],
  demand: [],
  statuses: [],
};
test("admin insight failures return no substitute advice; successful evidence snapshots are cached and capped", async () => {
  const saved = process.env.GEMINI_API_KEY;
  let fail = false,
    calls = 0;
  const { adminInsights } = loadTypescript("lib/backend/admin-fif.ts", {
    "./admin-overview": { adminOverview: async () => snapshot, overviewFingerprint: () => "source-fingerprint" },
    "./auth": { privilegedClient: () => ({ rpc: async () => ({ data: true, error: null }) }) },
    "./campus-weather": { fetchCampusWeather: async () => ({ weatherLabel: "Unavailable", fetchedLive: false }) },
    "./admin-intelligence-writer": {
      generateAdminIntelligence: async (candidates, facts) => {
        calls++;
        if (fail) throw Error("provider down");
        return {
          capture: new Map(),
          assessments: facts.map((f) => ({
            ...f,
            summary: "Review the supplied evidence and its stated limitations before taking management action.",
          })),
          actions: [
            {
              ...candidates[0],
              title: "AI-authored preparation review",
              detail: "Review the recorded overdue preparation with this stall before increasing demand.",
            },
          ],
        };
      },
    },
  });
  try {
    delete process.env.GEMINI_API_KEY;
    const missing = await adminInsights({}, "missing-key-user", { days: "7" });
    assert.equal(missing.source, "unavailable");
    assert.deepEqual(missing.recommendations, []);
    assert.equal(calls, 0);
    process.env.GEMINI_API_KEY = "test-key";
    fail = true;
    const unavailable = await adminInsights({}, "provider-failure-user", { days: "7" });
    assert.equal(unavailable.source, "unavailable");
    assert.deepEqual(unavailable.recommendations, []);
    fail = false;
    const generated = await adminInsights({}, "generated-user", { days: "7" });
    assert.equal(generated.source, "gemini");
    assert.equal(generated.recommendations.length, 1);
    assert.equal(generated.recommendations[0].vendorId, "stall");
    assert.match(generated.recommendations[0].href, /^\/admin\/traffic\?/);
    const before = calls,
      cached = await adminInsights({}, "generated-user", { days: "7" });
    assert.equal(cached.cached, true);
    assert.equal(calls, before);
  } finally {
    if (saved === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved;
  }
});
test("admin assistant tools expose aggregates, format MYT/RM, honour explicit scope and never expose staff or customer identities", async () => {
  const scopes = [];
  const { adminChat } = loadTypescript("lib/backend/admin-fif.ts", {
    "./admin-overview": {
      adminOverview: async (_client, scope) => {
        scopes.push(scope);
        return snapshot;
      },
      adminVendorDetail: async () => ({
        ...snapshot,
        staff: [{ id: "private-person", name: "Staff person" }],
        events: [
          {
            action: "Approval changed",
            created_at: snapshot.asOf,
            reason: "Private person detail",
            actor_id: "private-person",
          },
        ],
      }),
    },
    "./auth": { privilegedClient: () => ({ rpc: async () => ({ data: true, error: null }) }) },
    "./fif-chat-runtime": {
      runFifChat: async (input) => {
        assert.deepEqual(
          input.tools.map((t) => t.name),
          ["cafeteria_overview", "vendor_detail", "local_conditions"],
        );
        const local = await input.tools[0].run({}),
          all = await input.tools[0].run({ allCampus: true });
        assert.match(local.period.asOfMYT, /MYT/);
        assert.match(all.vendors[0].netCashflowRM, /RM/);
        const detail = await input.tools[1].run({ vendorId: "stall" });
        assert.equal(JSON.stringify(detail).includes("private-person"), false);
        assert.equal("staff" in detail, false);
        return { ok: true, reply: "Grounded answer", toolsUsed: ["cafeteria_overview", "vendor_detail"] };
      },
    },
  });
  const result = await adminChat({}, "admin-user", {
    scope: { days: "7", vendorId: "stall", zoneId: "zone-a" },
    message: "Compare across campus",
    history: [],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(scopes[0], { days: "7", vendorId: "stall", zoneId: "zone-a" });
  assert.deepEqual(scopes[1], { days: "7" });
  assert.ok(result.links.every((link) => link.href.startsWith("/admin")));
  assert.ok(result.links.some((link) => link.href === "/admin?days=7"));
});
