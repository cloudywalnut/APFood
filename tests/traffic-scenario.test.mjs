import assert from "node:assert/strict";
import test from "node:test";
import { runTrafficScenario } from "../scripts/traffic-scenario.mjs";

test("local traffic scenarios produce isolated pickup load, reroutes and demo receipts", async () => {
  for (const [scenario, requests, accepted, conflicts, reroutes] of [
    ["light", 1, 1, 0, 0],
    ["medium", 3, 3, 0, 0],
    ["heavy", 12, 5, 7, 3],
  ]) {
    const report = await runTrafficScenario(scenario);
    assert.equal(report.source, "local_simulated_orders");
    assert.equal(report.initialAttempts, requests);
    assert.equal(report.acceptedAtTarget, accepted);
    assert.equal(report.slotConflicts, conflicts);
    assert.equal(report.reroutedOrders, reroutes);
    assert.equal(report.unresolvedConflicts, conflicts - reroutes);
    assert.equal(report.totalPlaced, accepted + reroutes + 1);
    assert.deepEqual(report.targetBucketsBeforeCollection.find(bucket => bucket.vendor_id === "campus-noodle-bar"), {
      vendor_id: "campus-noodle-bar",
      pickup_count: accepted,
      reserved_units: accepted,
      total_units: 5,
    });
    const nearby = report.targetBucketsBeforeCollection.find(bucket => bucket.vendor_id === "brew-and-bites");
    assert.equal(nearby.reserved_units, 1);
    const shift = Date.parse(report.nextNoodlePickupAfterInitialDemand) - Date.parse(report.pickupWindow);
    assert.equal(shift, conflicts ? 15 * 60_000 : 0);
    assert.equal(report.collectedOrders, 1);
    assert.deepEqual(report.demoReceipts, [{ kind: "counter", amount_sen: 900 }]);
  }
});
