import assert from "node:assert/strict";
import test from "node:test";
import { parseDemoOptions, runDemo } from "../scripts/demo-run.mjs";

test("demo defaults to a credential-free dry run and validates hosted opt-in", async () => {
  const report = await runDemo(parseDemoOptions(["--run-id", "test-plan"]));
  assert.equal(report.dryRun, true);
  assert.equal(report.source, "FICTIONAL_DEMO_TRAFFIC");
  assert.equal(report.menuItems, 10);
  assert.equal(report.requests, 4);
  assert.throws(() => parseDemoOptions(["--hosted", "--execute"]), /requires/);
  assert.throws(() => parseDemoOptions(["--run-id", "../unsafe"]), /Run ID/);
  assert.throws(() => parseDemoOptions(["--interval-ms", "NaN"]), /integer/);
  assert.throws(() => parseDemoOptions(["--scenario", "unknown"]), /Choose/);
  assert.throws(() => parseDemoOptions(["--orders", "101"]), /1 to 100/);
  assert.throws(() => parseDemoOptions(["--orders", "0"]), /1 to 100/);
  assert.equal((await runDemo(parseDemoOptions(["--orders", "48"]))).requests, 48);
  assert.throws(() => parseDemoOptions(["--payment", "bank"]), /payment/);
});

test("explicit simulated prepaid tender supports a larger single run without merchant QR setup", async () => {
  const report = await runDemo(parseDemoOptions(["--execute", "--payment", "demo", "--orders", "48",
    "--run-id", "larger-prepaid", "--scenario", "heavy", "--interval-ms", "0", "--stage-ms", "0"]), () => {});
  assert.equal(report.collected, 48);
  assert.equal(report.exactlyOnceReceipts, 48);
  assert.equal(report.menuItems, 10);
  assert.match(report.payment, /simulated prepaid/);
});

test("isolated scenarios complete payment, real pickup and exactly one receipt per order", async () => {
  for (const [scenario, count] of [["light", 4], ["medium", 12], ["heavy", 24]]) {
    const report = await runDemo(parseDemoOptions(["--execute", "--scenario", scenario,
      "--run-id", "test-" + scenario, "--interval-ms", "0", "--stage-ms", "0"]), () => {});
    assert.equal(report.project, "isolated-memory");
    assert.equal(report.placed, count);
    assert.equal(report.collected, count);
    assert.equal(report.exactlyOnceReceipts, count);
    assert.equal(new Set(report.orderIds).size, count);
    assert.ok(report.totalSen > 0);
    assert.ok(report.pickupBuckets.every(bucket => bucket.reserved_units <= bucket.total_units));
    if (scenario === "heavy") {
      assert.ok(report.pickupWindows.length > 1, "overflow must use later feasible buckets");
      assert.ok(report.pickupBuckets.some(bucket => bucket.reserved_units === bucket.total_units));
    }
  }
});
