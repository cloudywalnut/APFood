const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");

const userId = "00000000-0000-4000-8000-000000000001";
let memberships;
let calls;
const client = {
  auth: { getUser: async () => ({ data: { user: { id: userId, email_confirmed_at: "2026-11-12" } } }) },
  from: (table) => ({
    select() {
      return this;
    },
    eq() {
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
