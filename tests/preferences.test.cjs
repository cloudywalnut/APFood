const test = require("node:test");
const assert = require("node:assert/strict");

test("preference cookies require a choice, survive reload, and stop persisting after opt-out", () => {
  const jar = new Map();
  const writes = [];
  global.document = { documentElement: { dataset: {} }, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(document, "cookie", {
    get: () => [...jar].map(([key, value]) => key + "=" + value).join("; "),
    set: (value) => {
      writes.push(value);
      const [pair] = value.split(";");
      const index = pair.indexOf("=");
      const name = pair.slice(0, index);
      if (/Max-Age=0(?:;|$)/.test(value)) jar.delete(name);
      else jar.set(name, pair.slice(index + 1));
    },
  });
  global.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
  global.location = { protocol: "https:" };
  global.localStorage = {
    getItem() {
      return null;
    },
    removeItem() {},
  };
  const load = () => {
    const path = require.resolve("../.test-build/lib/preferences");
    delete require.cache[path];
    return require(path);
  };
  let preferences = load();
  const chosen = { density: "compact", localTimezone: true, inAppUpdates: false };
  preferences.savePreferences(chosen);
  assert.equal(jar.has("ap_food_preferences"), false);
  preferences.choosePreferenceCookies(true);
  assert.equal(jar.has("ap_food_preferences"), true);
  assert.ok(
    writes.every((value) => value.includes("SameSite=Lax") && value.includes("Path=/") && value.includes("Secure")),
  );
  preferences = load();
  assert.deepEqual(preferences.readPreferences(), chosen);
  preferences.choosePreferenceCookies(false);
  assert.equal(jar.has("ap_food_preferences"), false);
  preferences = load();
  assert.deepEqual(preferences.readPreferences(), preferences.defaultPreferences);
  assert.deepEqual(preferences.readCookieChoice(), { preferences: false });
});
