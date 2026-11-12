import assert from "node:assert/strict";

export function verifySmokeSessions(sessions) {
  const [student, other, vendor, coffee, admin] = sessions;
  for (const actor of sessions) {
    assert.equal(actor.emailVerified, true, "Smoke accounts must have confirmed email addresses.");
    assert.equal(actor.profile?.status, "active", "Smoke accounts must be active.");
    assert.ok(actor.userId && Array.isArray(actor.memberships), "Session response is incomplete.");
  }
  for (const buyer of [student, other]) {
    assert.ok(
      buyer.memberships.some((entry) => entry.role === "student"),
      "Both buyers require a student membership.",
    );
    assert.ok(
      !buyer.memberships.some((entry) => entry.role === "vendor"),
      "Vendors cannot serve as smoke-test buyers.",
    );
  }
  assert.notEqual(student.userId, other.userId, "The smoke test requires two distinct student accounts.");
  for (const [actor, stall] of [
    [vendor, "campus-noodle-bar"],
    [coffee, "brew-and-bites"],
  ]) {
    assert.ok(
      actor.memberships.some((entry) => entry.role === "vendor" && entry.vendor_id === stall),
      "Vendor fixture is not assigned to " + stall,
    );
  }
  assert.ok(
    admin.memberships.some((entry) => entry.role === "admin"),
    "Administrator membership is required.",
  );
}

export function verifySmokeCatalogue(catalogue, fixture) {
  assert.ok(
    Array.isArray(catalogue.vendors) && Array.isArray(catalogue.items) && Array.isArray(catalogue.zones),
    "Catalogue schema is incomplete.",
  );
  assert.ok(
    catalogue.vendors.length >= fixture.vendors.length,
    "Published stall count is below the current fixture catalogue.",
  );
  assert.ok(
    catalogue.items.length >= fixture.items.length,
    "Published menu count is below the current fixture catalogue.",
  );
  for (const vendor of fixture.vendors)
    assert.ok(
      catalogue.vendors.some((row) => row.id === vendor.id),
      "Missing fixture stall: " + vendor.id,
    );
  for (const item of fixture.items)
    assert.ok(
      catalogue.items.some((row) => row.id === item.id && row.vendor_id === item.vendorId),
      "Missing fixture menu item: " + item.id,
    );
  for (const vendor of catalogue.vendors)
    assert.ok(
      catalogue.zones.some((zone) => zone.id === vendor.zone_id),
      "Stall references an unavailable food court.",
    );
}
