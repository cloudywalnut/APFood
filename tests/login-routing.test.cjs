const test = require("node:test");
const assert = require("node:assert/strict");
const { loginDestination, canUseWorkspace } = require("../.test-build/lib/login-routing");
const account = (...roles) => ({
  email: "fixture@example.test",
  emailVerified: true,
  memberships: roles.map((role) => ({ role })),
});

test("credentials determine the workspace while authorized return paths survive", () => {
  for (const [role, destination] of [
    ["student", "/app"],
    ["vendor", "/vendor"],
    ["admin", "/admin"],
  ])
    assert.equal(loginDestination(account(role)), destination);
  assert.equal(loginDestination(account("student"), "/app/checkout"), "/app/checkout");
  assert.equal(loginDestination(account("vendor"), "/vendor/orders/123"), "/vendor/orders/123");
  assert.equal(loginDestination(account("student"), "/admin"), "/app");
  assert.equal(loginDestination(account("admin"), "/app/checkout"), "/admin");
  assert.equal(loginDestination(account("student", "vendor", "admin")), "/admin");
  assert.equal(loginDestination(account("student", "vendor"), "/app/checkout"), "/vendor");
  assert.equal(loginDestination(account()), "/account");
});

test("unverified accounts and unsafe destinations cannot bypass account routing", () => {
  assert.equal(
    loginDestination({ ...account("student"), emailVerified: false }, "/app/checkout"),
    "/auth/verify-email?email=fixture%40example.test",
  );
  for (const path of [
    "https://example.test",
    "//example.test",
    "/app/../admin",
    "/app/%2e%2e/admin",
    "/\\example.test",
    "/app\r\n",
  ])
    assert.equal(loginDestination(account("student"), path), "/app");
});

test('vendor memberships do not grant student workspace access', () => {
  assert.equal(canUseWorkspace(account('student','vendor'), 'student'), false);
  assert.equal(canUseWorkspace(account('student','vendor'), 'vendor'), true);
  assert.equal(canUseWorkspace(account('student'), 'student'), true);
});
