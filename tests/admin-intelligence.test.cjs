const test = require("node:test"),
  assert = require("node:assert/strict");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { adminStrategicFacts, recoveryEffect, adminOptimization, adminDailyPreview } =
  loadTypescript("lib/admin-intelligence.ts");
const { validateAdminIntelligence, generateAdminIntelligence } = loadTypescript(
  "lib/backend/admin-intelligence-writer.ts",
);
const vendor = (id) => ({
  id,
  name: id,
  status: "approved",
  paused: false,
  closed: 100,
  collected: 80,
  cancelled: 20,
  receiptsSen: 100000,
  netSen: 50000,
  readyCount: 100,
  onTimeCount: 70,
  overdueCount: 2,
  previousReceiptsSen: 120000,
});
const data = {
  days: 7,
  summary: { orders: 200, active: 4 },
  vendors: [vendor("a"), vendor("b")],
  products: [{ vendorId: "a", name: "Dish", active: true, stock: 0, units: 100 }],
  intelligence: {
    vendors: [
      { vendorId: "a", unsuccessfulValueSen: 20000 },
      { vendorId: "b", unsuccessfulValueSen: 10000 },
    ],
  },
  daily: [
    { day: "2026-11-10", receiptsSen: 100000, costsSen: 50000, netSen: 50000, orders: 100 },
    { day: "2026-11-11", receiptsSen: 100000, costsSen: 50000, netSen: 50000, orders: 100 },
    { day: "2026-11-12", receiptsSen: 0, costsSen: 0, netSen: 0, orders: 0 },
  ],
};
const candidate = {
  id: "proposal",
  kind: "preparation",
  title: "Review failed orders",
  detail: "Investigate the observed unsuccessful orders before making changes.",
  evidence: ["Recorded unsuccessful order value is RM 200.00 for 20 orders."],
  assumptions: [],
  volumeChangePct: 0,
  workSavingPct: 0,
};
const facts = adminStrategicFacts(data);
const response = () => ({
  recommendations: [
    {
      candidateId: "proposal",
      title: "Coordinate an order recovery review",
      detail: "Review the recorded unsuccessful orders with the affected stalls before trialling improvements.",
      evidenceIds: ["proposal:e0"],
      capturePct: 25,
    },
  ],
  assessments: facts.map((f) => ({
    id: f.id,
    summary:
      "Review the supplied evidence and acknowledge the stated data limitations before making a management decision.",
    evidenceIds: [`${f.id}:e0`],
  })),
});
test("strategic evidence distinguishes pressure, menu breadth and performance from unobserved demand", () => {
  assert.equal(facts.find((f) => f.id === "expansion").verdict, "Investigate peak coverage");
  assert.equal(facts.find((f) => f.id === "variety").verdict, "Review menu breadth");
  assert.match(facts.find((f) => f.id === "performance").verdict, /2 stalls/);
  const healthy = {
    ...data,
    vendors: data.vendors.map((v) => ({
      ...v,
      overdueCount: 0,
      onTimeCount: 100,
      collected: 98,
      cancelled: 2,
      previousReceiptsSen: 100000,
    })),
  };
  assert.equal(adminStrategicFacts(healthy).find((f) => f.id === "expansion").verdict, "Expansion not established");
  assert.ok(facts[0].limitations.some((s) => s.includes("not tracked")));
  const empty = { ...healthy, vendors: healthy.vendors.map((v) => ({ ...v, closed: 0, collected: 0, cancelled: 0 })) };
  assert.equal(
    adminStrategicFacts(empty).find((f) => f.id === "performance").verdict,
    "Insufficient performance history",
  );
});
test("recovery uses recorded unsuccessful-order values and bounded AI assumptions, never fabricated campus growth", () => {
  const effect = recoveryEffect(data, "a", 25);
  assert.deepEqual(effect, { recoveredOrders: 5, receiptsSen: 5000, netSen: 2500, capturePct: 25 });
  assert.throws(() => recoveryEffect(data, "a", 80), /bounds/);
  assert.equal(recoveryEffect({ ...data, intelligence: undefined }, "a", 25), undefined);
  assert.equal(recoveryEffect({ ...data, vendors: [{ ...vendor("a"), netSen: -1 }] }, "a", 25), undefined);
});
test("global and individual recovery effects deduplicate by vendor and daily previews reconcile to the cent", () => {
  const a = { vendorId: "a", ...recoveryEffect(data, "a", 25) },
    b = { vendorId: "b", ...recoveryEffect(data, "b", 25) };
  const insights = {
    source: "gemini",
    fingerprint: "source",
    recommendations: [
      { id: "campus", vendorId: "a", vendorIds: ["a", "b"], effect: { ...a, byVendor: [a, b] } },
      { id: "individual", vendorId: "a", effect: a },
    ],
  };
  const p = adminOptimization(data, insights, ["campus", "individual"]);
  assert.equal(p.netSen, 3750);
  assert.equal(p.recoveredOrders, 10);
  assert.equal(p.priorityVendorIds.length, 2);
  const daily = adminDailyPreview(data, p);
  assert.equal(
    daily.reduce((n, d) => n + d.optimizedNetSen - d.netSen, 0),
    p.netSen,
  );
  assert.equal(
    daily.reduce((n, d) => n + d.optimizedReceiptsSen - d.receiptsSen, 0),
    p.receiptsSen,
  );
  assert.equal(daily[2].optimizedNetSen, 0);
  assert.equal(adminOptimization(data, insights, ["campus"], true), undefined);
  assert.equal(adminOptimization(data, insights, []), undefined);
});
test("Gemini strategic responses require exact evidence IDs and supported financial assumptions", () => {
  const result = validateAdminIntelligence(response(), [candidate], facts, new Set(["proposal"]));
  assert.equal(result.capture.get("proposal"), 25);
  assert.equal(result.assessments.length, 3);
  const unknown = response();
  unknown.recommendations[0].evidenceIds = ["proposal:e99"];
  assert.throws(() => validateAdminIntelligence(unknown, [candidate], facts, new Set(["proposal"])));
  const forged = response();
  forged.recommendations[0].capturePct = 30;
  assert.throws(() => validateAdminIntelligence(forged, [candidate], facts, new Set()), /financial assumption/);
  const invented = response();
  invented.assessments[0].summary = "The cafeteria has 99999 hungry students and must immediately add more vendors.";
  assert.throws(() => validateAdminIntelligence(invented, [candidate], facts, new Set(["proposal"])), /numerical/);
  const duplicate = response();
  duplicate.assessments[1] = duplicate.assessments[0];
  assert.throws(() => validateAdminIntelligence(duplicate, [candidate], facts, new Set(["proposal"])), /strategic/);
});
test("Gemini schema uses supported numeric bounds and enumerated evidence strings", async () => {
  let request;
  const result = await generateAdminIntelligence([candidate], facts, {}, new Set(["proposal"]), {
    key: "test-key",
    model: "test-model",
    fetcher: async (_url, options) => {
      request = JSON.parse(options.body);
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(response()) }] } }] }),
        { status: 200 },
      );
    },
  });
  assert.equal(result.actions.length, 1);
  const props = request.generationConfig.responseSchema.properties.recommendations.items.properties;
  assert.equal(props.capturePct.enum, undefined);
  assert.equal(props.capturePct.maximum, 40);
  assert.ok(props.evidenceIds.items.enum.includes("proposal:e0"));
  await assert.rejects(() =>
    generateAdminIntelligence([candidate], facts, {}, new Set(["proposal"]), {
      key: "test-key",
      model: "test-model",
      fetcher: async () => new Response("", { status: 503 }),
    }),
  );
});
