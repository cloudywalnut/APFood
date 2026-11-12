const { test } = require("node:test");
const assert = require("node:assert/strict");
const { canCancelOrder, isActive } = require("../.test-build/lib/orders");
const { canStudentCancel } = require("../.test-build/lib/tracking");

test("orders are cancelable across all active stages and not cancelable when terminal", () => {
  assert.equal(canCancelOrder("placed"), true);
  assert.equal(canCancelOrder("accepted"), true);
  assert.equal(canCancelOrder("preparing"), true);
  assert.equal(canCancelOrder("ready"), true);
  assert.equal(canCancelOrder("collected"), false);
  assert.equal(canCancelOrder("cancelled"), false);
  assert.equal(canCancelOrder("rejected"), false);

  for (const stage of ["placed", "accepted", "preparing", "ready"]) {
    assert.equal(canCancelOrder(stage), true);
    assert.equal(canStudentCancel(stage), true);
    assert.equal(isActive(stage), true);
  }

  for (const terminal of ["collected", "cancelled", "rejected"]) {
    assert.equal(canStudentCancel(terminal), false);
  }
});
