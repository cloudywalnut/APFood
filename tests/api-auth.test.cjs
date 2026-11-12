const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");

const userId = "00000000-0000-4000-8000-000000000001";
let memberships;
let calls;
let orderFilters = [];
const client = {
  auth: { getUser: async () => ({ data: { user: { id: userId, email_confirmed_at: "2026-11-12" } } }) },
  from: (table) => ({
    select() {
      return this;
    },
    eq(column, value) {
      if (table === "orders") orderFilters.push([column, value]);
      return this;
    },
    in(column, values) {
      if (table === "orders") orderFilters.push([column, values]);
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    single: async () => ({ data: { id: userId, status: "active" }, error: null }),
    then(resolve) {
      resolve({ data: table === "memberships" ? memberships : [], error: null });
    },
  }),
  rpc: async (name) => {
    calls.push(name);
    return { data: {}, error: null };
  },
};
const { handleRequest } = loadTypescript(path.join(__dirname, "../lib/backend/api.ts"), {
  "./supabase": { requestClient: async () => client },
  "./auth": {},
  "./account-actions": {},
  "./recovery": {},
  "./fif": {},
  "./vendor-copilot": {},
  "./student-fif-chat": {},
  "./vendor-scenarios": {},
});
const endpoints = [
  [
    "checkout/quote",
    { vendorId: "campus-noodle-bar", items: [{ itemId: "chicken-noodles", quantity: 1, extra: false }] },
  ],
  ["orders", { quoteId: userId, pickupAt: "2026-11-12T05:00:00Z", payment: "demo", idempotencyKey: userId }],
  ["orders/" + userId + "/payment-claim", {}],
  ["orders/" + userId + "/pickup-token", {}],
];

test("student-only checkout and pickup APIs reject vendor/student accounts before RPC", async () => {
  memberships = [
    { role: "student", vendor_id: null },
    { role: "vendor", vendor_id: "campus-noodle-bar" },
  ];
  calls = [];
  for (const [endpoint, body] of endpoints) {
    const response = await handleRequest(
      new Request("https://ap-food.test/api/" + endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
      endpoint.split("/"),
    );
    assert.equal(response.status, 403, endpoint);
    assert.equal((await response.json()).error.code, "FORBIDDEN");
  }
  assert.deepEqual(calls, []);
});

test("student-only checkout and pickup APIs retain ordinary student RPC access", async () => {
  memberships = [{ role: "student", vendor_id: null }];
  calls = [];
  for (const [endpoint, body] of endpoints) {
    const response = await handleRequest(
      new Request("https://ap-food.test/api/" + endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
      endpoint.split("/"),
    );
    assert.ok(response.ok, endpoint);
  }
  assert.deepEqual(calls, ["quote_checkout", "place_order", "claim_qr_payment", "issue_pickup_code"]);
});

test("account administration treats malformed JSON as invalid input", async () => {
  const { manageAccount, inviteAccount } = loadTypescript(path.join(__dirname, "../lib/backend/account-actions.ts"), {
    "./auth": {},
  });
  for (const action of [manageAccount, inviteAccount]) {
    await assert.rejects(
      () => action(new Request("https://ap-food.test/api/admin/users", { method: "POST", body: "{" }), client, userId),
      (error) => error.status === 400 && error.code === "INVALID_INPUT",
    );
  }
});

test("student order tabs filter before limiting history and retain owner scoping", async () => {
  memberships = [{ role: "student", vendor_id: null }];
  for (const [view, statuses] of [
    ["active", ["placed", "accepted", "preparing", "ready"]],
    ["history", ["collected", "cancelled", "rejected"]],
  ]) {
    orderFilters = [];
    const response = await handleRequest(new Request("https://ap-food.test/api/orders?view=" + view), ["orders"]);
    assert.equal(response.status, 200);
    assert.deepEqual(orderFilters, [["student_id", userId], ["status", statuses]]);
  }
  const invalid = await handleRequest(new Request("https://ap-food.test/api/orders?view=invalid"), ["orders"]);
  assert.equal(invalid.status, 400);
});

test("collection accepts eight-digit codes including leading zeroes and rejects invalid lengths", async () => {
  memberships = [{ role: "vendor", vendor_id: "campus-noodle-bar" }];
  for (const [code, expected] of [["01234567", 200], ["12345678", 200], ["A".repeat(32), 200], ["1234567", 400], ["123456789", 400], ["12ABC678", 400]]) {
    const response = await handleRequest(new Request("https://ap-food.test/api/vendor/orders/" + userId + "/collect", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, counterConfirmed: true }),
    }), ["vendor", "orders", userId, "collect"]);
    assert.equal(response.status, expected, code);
  }
});
