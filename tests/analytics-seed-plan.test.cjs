const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

test("analytics actor discovery paginates and supports current and explicit legacy demo accounts", async () => {
  const { analyticsActors } = await import("../scripts/analytics-seed-plan.mjs");
  const pages = [];
  const user = (id, email) => ({ id, email, email_confirmed_at: "2026-11-12" });
  const client = {
    auth: {
      admin: {
        listUsers: async ({ page }) => {
          pages.push(page);
          return {
            data: {
              users:
                page === 1
                  ? Array.from({ length: 100 }, (_, i) => user(String(i), "other" + i + "@example.test"))
                  : [
                      user("student", "student@apfoods.local"),
                      user("legacy", "student-a@ap-food-demo.example"),
                      user("admin", "admin@apfoods.local"),
                    ],
            },
            error: null,
          };
        },
      },
    },
  };
  const actors = await analyticsActors(client, [
    { role: "student", email: "student@apfoods.local" },
    { role: "admin", email: "admin@apfoods.local" },
  ]);
  assert.deepEqual(pages, [1, 2]);
  assert.deepEqual(
    actors.students.map((user) => user.id),
    ["student", "legacy"],
  );
  assert.equal(actors.admin.id, "admin");
});

test("analytics plans survive write failures and retries do not duplicate orders, receipts or markers", async () => {
  const { loadOrCreateAnalyticsPlan, applyAnalyticsPlan } = await import("../scripts/analytics-seed-plan.mjs");
  const directory = await mkdtemp(join(tmpdir(), "ap-food-analytics-"));
  try {
    const filename = join(directory, ".env.analytics-plan-test-stall.json");
    const identity = { projectRef: "test", vendorId: "stall" };
    const plan = await loadOrCreateAnalyticsPlan(filename, identity, async () => ({
      slots: [{ vendor_id: "stall", starts_at: "2026-11-11T12:00:00Z" }],
      orders: [{ id: "order-1" }],
      cash: [{ id: "receipt-1", order_id: "order-1" }],
      audit: { id: "marker-1" },
    }));
    const saved = new Map();
    let failTable = "cash_entries";
    const client = {
      from: (table) => ({
        upsert: async (rows, options) => {
          assert.equal(options.ignoreDuplicates, true);
          if (table === failTable) return { error: new Error("Injected failure") };
          const entries = saved.get(table) ?? new Map();
          for (const row of rows) entries.set(row.id ?? row.vendor_id + row.starts_at, row);
          saved.set(table, entries);
          return { error: null };
        },
      }),
    };
    await assert.rejects(() => applyAnalyticsPlan(client, plan), /Injected failure/);
    assert.equal(saved.get("orders").size, 1);
    const resumed = await loadOrCreateAnalyticsPlan(filename, identity, async () => {
      throw new Error("Must reuse persisted IDs");
    });
    assert.deepEqual(resumed, plan);
    failTable = "audit_events";
    await assert.rejects(() => applyAnalyticsPlan(client, resumed), /Injected failure/);
    failTable = null;
    await applyAnalyticsPlan(client, resumed);
    await applyAnalyticsPlan(client, resumed);
    assert.equal(saved.get("orders").size, 1);
    assert.equal(saved.get("cash_entries").size, 1);
    assert.equal(saved.get("audit_events").size, 1);
    await assert.rejects(
      () => loadOrCreateAnalyticsPlan(filename, { ...identity, projectRef: "other" }, async () => null),
      /does not match/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("analytics marker lookup propagates database failures", async () => {
  const { hasAnalyticsMarker } = await import("../scripts/analytics-seed-plan.mjs");
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: null, error: new Error("Marker lookup failed") }),
  };
  await assert.rejects(() => hasAnalyticsMarker({ from: () => query }, "analytics-v1:stall"), /Marker lookup failed/);
});
