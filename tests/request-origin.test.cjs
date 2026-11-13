const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTypescript } = require("./support/load-typescript.cjs");
const { isAllowedRequestOrigin } = loadTypescript(path.join(__dirname, "../lib/backend/supabase.ts"), {
  "next/headers": {},
});

test("mutation origins stay exact in production and accept same-origin loopback development", () => {
  const oldMode = process.env.NODE_ENV;
  const oldOrigin = process.env.AP_FOOD_APP_ORIGIN;
  const allowed = (url, origin) =>
    isAllowedRequestOrigin(new Request(url, { method: "POST", headers: origin ? { origin } : {} }));
  try {
    process.env.AP_FOOD_APP_ORIGIN = "http://127.0.0.1:3000";
    process.env.NODE_ENV = "production";
    assert.equal(allowed("http://localhost:3000/api/auth/session", "http://localhost:3000"), false);
    assert.equal(allowed("http://127.0.0.1:3000/api/auth/session", "http://127.0.0.1:3000"), true);
    process.env.NODE_ENV = "development";
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
      assert.equal(allowed(origin + "/api/auth/session", origin), true);
    }
    assert.equal(allowed("http://localhost:3000/api/auth/session", "http://evil.test"), false);
    assert.equal(allowed("http://localhost:3000/api/auth/session", "http://localhost:4000"), false);
    assert.equal(allowed("http://localhost:3000/api/auth/session", null), false);
    assert.equal(allowed("http://evil.test/api/auth/session", "http://evil.test"), false);
    process.env.AP_FOOD_APP_ORIGIN = "https://ap-food.example";
    assert.equal(allowed("http://localhost:3000/api/auth/session", "http://localhost:3000"), false);
    assert.equal(allowed("https://ap-food.example/api/auth/session", "https://ap-food.example"), true);

    // Protocol-omitted domain normalisation
    process.env.AP_FOOD_APP_ORIGIN = "apfoods.vercel.app";
    assert.equal(allowed("https://apfoods.vercel.app/api/auth/session", "https://apfoods.vercel.app"), true);
    assert.equal(allowed("https://apfoods.vercel.app/api/auth/session", "https://other.vercel.app"), false);

    // Multiple comma-separated origins and wildcards
    process.env.AP_FOOD_APP_ORIGIN =
      "https://apfoods.vercel.app, https://conceptsquad.my, https://apfoods-*.vercel.app";
    assert.equal(allowed("https://apfoods.vercel.app/api/orders", "https://apfoods.vercel.app"), true);
    assert.equal(allowed("https://conceptsquad.my/api/orders", "https://conceptsquad.my"), true);
    assert.equal(
      allowed("https://apfoods.vercel.app/api/orders", "https://apfoods-preview-abc123.vercel.app"),
      true,
    );
    assert.equal(allowed("https://apfoods.vercel.app/api/orders", "https://attacker-apfoods.vercel.app"), false);
    assert.equal(allowed("https://apfoods.vercel.app/api/orders", "https://evil.test"), false);
  } finally {
    if (oldMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldMode;
    if (oldOrigin === undefined) delete process.env.AP_FOOD_APP_ORIGIN;
    else process.env.AP_FOOD_APP_ORIGIN = oldOrigin;
  }
});
