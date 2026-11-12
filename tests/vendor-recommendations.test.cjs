const test = require("node:test");
const assert = require("node:assert/strict");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { validateVendorRecommendations, generateVendorRecommendations } = loadTypescript(
  "lib/backend/vendor-recommendation-writer.ts",
);
const candidates = Array.from({ length: 5 }, (_, index) => ({
  id: "proposal-" + index,
  kind: "preparation",
  title: "Prepare ahead for lunch",
  detail: "Group shared preparation before the recorded lunch peak.",
  evidence: ["Lunch has 20 collected orders.", "Current stock is 8 portions."],
  assumptions: ["Assume 5% less work; not measured uplift."],
  volumeChangePct: 0,
  workSavingPct: 5,
}));
const recommendation = (id = "proposal-0") => ({
  candidateId: id,
  title: "Stage shared ingredients before lunch",
  detail: "Use the observed lunch demand to prepare common ingredients in advance, preserving individual pickup times.",
  evidenceIndexes: [0],
});

test("AI-authored wording retains trusted evidence and immutable impact assumptions", () => {
  const [result] = validateVendorRecommendations({ recommendations: [recommendation()] }, candidates);
  assert.equal(result.title, recommendation().title);
  assert.notEqual(result.title, candidates[0].title);
  assert.deepEqual(result.evidence, [candidates[0].evidence[0]]);
  assert.deepEqual(result.assumptions, candidates[0].assumptions);
  assert.equal(result.workSavingPct, 5);
  assert.equal(result.volumeChangePct, 0);
  assert.deepEqual(validateVendorRecommendations({ recommendations: [] }, candidates), []);
});

test("recommendations reject five suggestions, unknown or duplicate IDs, invented numbers and untrusted changes", () => {
  const parse = (recommendations) => validateVendorRecommendations({ recommendations }, candidates);
  assert.throws(() => parse(candidates.map((row) => recommendation(row.id))));
  assert.throws(() => parse([recommendation("unknown")]));
  assert.throws(() => parse([recommendation(), recommendation()]));
  assert.throws(() => parse([{ ...recommendation(), evidenceIndexes: [99] }]));
  assert.throws(() =>
    parse([{ ...recommendation(), detail: "Guaranteed demand will rise by 99% when you apply this proposal." }]),
  );
  assert.throws(() => parse([{ ...recommendation(), proposedPriceSen: 500 }]));
});

test("Gemini writes at most four recommendations and provider failures cannot produce rule-written advice", async () => {
  let sent;
  const result = await generateVendorRecommendations(
    candidates,
    { weather: "unknown" },
    {
      key: "test-key",
      model: "test-model",
      fetcher: async (_url, options) => {
        sent = JSON.parse(options.body);
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ recommendations: [recommendation()] }) }] } }],
          }),
          { status: 200 },
        );
      },
    },
  );
  assert.equal(result.length, 1);
  assert.equal(sent.generationConfig.responseSchema.properties.recommendations.maxItems, 4);
  assert.ok(JSON.parse(sent.contents[0].parts[0].text).candidates[0].evidence.length);
  await assert.rejects(() =>
    generateVendorRecommendations(
      candidates,
      {},
      { key: "test-key", model: "test-model", fetcher: async () => new Response("", { status: 503 }) },
    ),
  );
  await assert.rejects(() =>
    generateVendorRecommendations(
      candidates,
      {},
      {
        key: "test-key",
        model: "test-model",
        fetcher: async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
      },
    ),
  );
  await assert.rejects(() => generateVendorRecommendations(candidates, {}, { key: "", model: "test-model" }));
});
