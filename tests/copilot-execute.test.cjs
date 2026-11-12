const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { executeVendorCopilotAction } = loadTypescript(path.join(__dirname, "../lib/backend/vendor-copilot.ts"), {
  "./auth": {
    privilegedClient: () => {
      throw new Error("Execution must use the vendor's session");
    },
  },
  "./campus-weather": {
    fetchCampusWeather: async () => ({ weather: "hot", weatherLabel: "Assumption", fetchedLive: false }),
  },
});
const stall = {
  id: "stall-a",
  zone_id: "zone-a",
  name: "Stall A",
  description: "",
  category: "Meals",
  status: "approved",
  paused: false,
  capacity: 20,
  lead_minutes: 10,
  opens_at: "00:00",
  closes_at: "23:59",
};
const item = {
  id: "dish-a",
  vendor_id: stall.id,
  name: "Dish A",
  description: "",
  stock: 10,
  price_sen: 900,
  discount_sen: 0,
  active: true,
  work_units: 1,
};
const menuAction = {
  type: "update_menu_item",
  summary: "Offer a discount",
  itemId: item.id,
  itemName: item.name,
  expectedStock: item.stock,
  before: { stock: item.stock, priceSen: item.price_sen, discountSen: item.discount_sen, active: item.active },
  changes: { priceSen: 1000, discountSen: 100 },
};
function fakeClient(calls) {
  return {
    from(table) {
      const rows = table === "vendors" ? [stall] : table === "menu_items" ? [item] : [];
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
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
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then(resolve) {
          return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve);
        },
      };
    },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  };
}
test("copilot applies price and discount with one authenticated atomic RPC", async () => {
  const calls = [];
  const result = await executeVendorCopilotAction(fakeClient(calls), { vendorId: stall.id, action: menuAction });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "apply_vendor_copilot_action");
  assert.deepEqual(calls[0].args.p_action.changes, menuAction.changes);
  assert.deepEqual(calls[0].args.p_action.before, menuAction.before);
});

test("copilot rejects stale price, discount, visibility and stall snapshots before writing", async () => {
  const actions = [
    ...[{ priceSen: 850 }, { discountSen: 50 }, { active: false }].map((before) => ({
      ...menuAction,
      before: { ...menuAction.before, ...before },
    })),
    {
      type: "update_stall_settings",
      summary: "Change capacity",
      before: { paused: false, capacity: 19, leadMinutes: 10 },
      changes: { capacity: 25 },
    },
  ];
  for (const action of actions) {
    const calls = [];
    await assert.rejects(
      () => executeVendorCopilotAction(fakeClient(calls), { vendorId: stall.id, action }),
      (error) => error.code === "ACTION_CHANGED",
    );
    assert.deepEqual(calls, []);
  }
});
