const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

function sessions() {
  const actor = (userId, role, vendor_id = null) => ({
    userId,
    emailVerified: true,
    profile: { status: "active" },
    memberships: [{ role, vendor_id }],
  });
  return [
    actor("student", "student"),
    actor("other", "student"),
    actor("vendor", "vendor", "campus-noodle-bar"),
    actor("coffee", "vendor", "brew-and-bites"),
    actor("admin", "admin"),
  ];
}
test("hosted smoke fixture has a distinct second student and preflight rejects vendor buyers", async () => {
  const { verifySmokeSessions } = await import("../scripts/hosted-smoke-preflight.mjs");
  const fixture = JSON.parse(await readFile(join(__dirname, "../supabase/fixtures/demo-accounts.json"), "utf8"));
  assert.equal(fixture.accounts.find((account) => account.email === "student-two@apfoods.local")?.role, "student");
  verifySmokeSessions(sessions());
  const actors = sessions();
  actors[1].memberships.push({ role: "vendor", vendor_id: "green-bowl-kitchen" });
  assert.throws(() => verifySmokeSessions(actors), /Vendors cannot/);
});
test("hosted smoke preflight rejects stale sessions and incorrect stall assignments", async () => {
  const { verifySmokeSessions } = await import("../scripts/hosted-smoke-preflight.mjs");
  for (const change of [
    (actors) => {
      actors[0].emailVerified = false;
    },
    (actors) => {
      actors[1].profile.status = "suspended";
    },
    (actors) => {
      actors[1].userId = actors[0].userId;
    },
    (actors) => {
      actors[2].memberships[0].vendor_id = "other-stall";
    },
    (actors) => {
      actors[4].memberships = [];
    },
  ]) {
    const actors = sessions();
    change(actors);
    assert.throws(() => verifySmokeSessions(actors));
  }
});
test("hosted smoke catalogue preflight checks current fixture counts, item ownership and zones", async () => {
  const { verifySmokeCatalogue } = await import("../scripts/hosted-smoke-preflight.mjs");
  const fixture = { vendors: [{ id: "stall" }], items: [{ id: "dish", vendorId: "stall" }] };
  const catalogue = {
    vendors: [{ id: "stall", zone_id: "zone" }],
    items: [{ id: "dish", vendor_id: "stall" }],
    zones: [{ id: "zone" }],
  };
  verifySmokeCatalogue(catalogue, fixture);
  assert.throws(() => verifySmokeCatalogue({ ...catalogue, items: [] }, fixture), /menu count/);
  assert.throws(
    () => verifySmokeCatalogue({ ...catalogue, items: [{ id: "dish", vendor_id: "other" }] }, fixture),
    /Missing fixture menu/,
  );
  assert.throws(() => verifySmokeCatalogue({ ...catalogue, zones: [] }, fixture), /food court/);
});
