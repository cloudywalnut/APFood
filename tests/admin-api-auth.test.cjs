const test = require("node:test"),
  assert = require("node:assert/strict");
const { loadTypescript } = require("./support/load-typescript.cjs");
const userId = "00000000-0000-4000-8000-000000000001";
let role = "student",
  status = "active",
  called = 0;
const client = {
  auth: { getUser: async () => ({ data: { user: { id: userId, email_confirmed_at: "2026-11-12" } } }) },
  from: (table) => ({
    select() {
      return this;
    },
    eq() {
      return this;
    },
    single: async () => ({ data: { id: userId, status }, error: null }),
    then(resolve) {
      resolve({
        data: table === "memberships" ? [{ role, vendor_id: role === "vendor" ? "stall" : null }] : [],
        error: null,
      });
    },
  }),
};
const { handleRequest } = loadTypescript("lib/backend/api.ts", {
  "./supabase": { requestClient: async () => client },
  "./admin-overview": {
    adminOverview: async () => {
      called++;
      return {};
    },
    parseAdminScope: () => ({ days: "7" }),
    adminVendorDetail: async () => {
      called++;
      return {};
    },
  },
  "./admin-fif": {
    adminInsights: async () => {
      called++;
      return {};
    },
    adminChat: async () => {
      called++;
      return {};
    },
  },
});
test("all new admin endpoints reject vendor/student access and suspended admin sessions before reading evidence", async () => {
  for (const access of ["student", "vendor", "suspended"]) {
    role = access === "suspended" ? "admin" : access;
    status = access === "suspended" ? "suspended" : "active";
    for (const [endpoint, method, input] of [
      ["admin/overview", "GET"],
      ["admin/vendors/stall/overview", "GET"],
      ["admin/ledger", "GET"],
      ["admin/audit-page", "GET"],
      ["fif/admin-insights", "POST", { days: "7" }],
      ["fif/admin-chat", "POST", { scope: { days: "7" }, message: "Summarize vendors", history: [] }],
    ]) {
      const response = await handleRequest(
        new Request("https://apfoods.test/api/" + endpoint, {
          method,
          ...(input ? { body: JSON.stringify(input), headers: { "content-type": "application/json" } } : {}),
        }),
        endpoint.split("/"),
      );
      assert.equal(response.status, 403, endpoint + " " + access);
    }
  }
  assert.equal(called, 0);
  role = "admin";
  status = "active";
  const response = await handleRequest(new Request("https://apfoods.test/api/admin/overview"), ["admin", "overview"]);
  assert.equal(response.status, 200);
  assert.equal(called, 1);
});
