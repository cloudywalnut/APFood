const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { operatingRecommendations } = loadTypescript("lib/backend/vendor-operating-signals.ts");
const { parseCampusWeather } = loadTypescript("lib/backend/campus-weather.ts");

test("weather requires complete finite observations instead of labelling an empty response live", () => {
  for (const value of [{}, { current: {} }, { current: { temperature_2m: 30, precipitation: 0 } }]) {
    assert.throws(() => parseCampusWeather(value));
  }
  assert.equal(
    parseCampusWeather({ current: { temperature_2m: 26.26, precipitation: 2, weather_code: 61 } }).weather,
    "rainy",
  );
});

test("replenishment uses actual sales pace and stock, independent of weather", () => {
  const actions = operatingRecommendations({
    menu: [{ id: "a", name: "Rice", active: true, stock: 12 }],
    products: [{ id: "a", units: 70 }],
    days: 7,
    queue: [],
    queueComplete: true,
    nowMs: Date.now(),
  });
  assert.equal(actions.length, 1);
  assert.match(actions[0].title, /replenishment/);
  assert.match(actions[0].evidence[1], /1.2 days/);
  assert.equal(actions[0].volumeChangePct, 0);
});

test("queue priorities distinguish late preparation from ready orders and withhold incomplete data", () => {
  const input = {
    menu: [],
    products: [],
    days: 7,
    nowMs: Date.parse("2026-11-12T12:00:00+08:00"),
    queueComplete: true,
    queue: [
      { status: "preparing", pickup_at: "2026-11-12T11:45:00+08:00" },
      { status: "ready", pickup_at: "2026-11-12T11:45:00+08:00" },
    ],
  };
  const [action] = operatingRecommendations(input);
  assert.match(action.evidence[0], /1 past pickup time and not ready/);
  assert.deepEqual(operatingRecommendations({ ...input, queueComplete: false }), []);
});

test("automatic analysis fetches multiple sources and labels explicit weather overrides", async () => {
  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const history = [
      {
        status: "collected",
        total_sen: 1000,
        lines: [{ itemId: "rice", name: "Hot Rice", quantity: 1, unit: 1000 }],
        pickup_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];
    const menu = [
      { id: "rice", name: "Hot Rice", price_sen: 1000, discount_sen: 0, stock: 2, active: true, work_units: 1 },
    ];
    const client = {
      from(table) {
        let fields = "";
        const query = {
          select(value) {
            fields = value;
            return query;
          },
          eq() {
            return query;
          },
          neq() {
            return query;
          },
          gte() {
            return query;
          },
          lte() {
            return query;
          },
          limit() {
            return query;
          },
          in() {
            return query;
          },
          then(resolve, reject) {
            const data =
              table === "vendors"
                ? [{ id: "stall" }]
                : table === "menu_items"
                  ? fields.includes("vendors!inner")
                    ? []
                    : menu
                  : fields === "status,pickup_at"
                    ? []
                    : fields === "vendor_id,status,total_sen"
                      ? []
                      : history;
            return Promise.resolve({ data, error: null, count: data.length }).then(resolve, reject);
          },
        };
        return query;
      },
    };
    const { vendorScenarios } = loadTypescript("lib/backend/vendor-scenarios.ts", {
      "./auth": { privilegedClient: () => client },
      "./reports": {
        adminReport: async () => ({
          asOf: new Date().toISOString(),
          products: [{ id: "rice", name: "Hot Rice", units: 10, fulfilledValueSen: 10000 }],
        }),
      },
      "./campus-weather": {
        fetchCampusWeather: async () => ({
          weather: "hot",
          weatherLabel: "Clear - 30C",
          temperatureC: 30,
          fetchedLive: true,
        }),
      },
    });
    const result = await vendorScenarios(client, "user", { vendorId: "stall", days: "7", weather: "rainy" });
    assert.deepEqual(
      result.signals.map((signal) => signal.id),
      ["sales", "timing", "stock", "queue", "prices", "audience", "weather"],
    );
    assert.equal(result.context.fetchedLive, false);
    assert.equal(result.context.temperatureC, undefined);
    assert.match(result.context.weatherLabel, /scenario/);
    assert.match(result.notes[0], /scenario/);
    assert.ok(result.actions.some((action) => /replenishment/.test(action.title)));
  } finally {
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  }
});
