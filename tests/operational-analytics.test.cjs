const { test } = require("node:test");
const assert = require("node:assert/strict");
const { operationalAnalytics } = require("../.test-build/lib/operational-analytics");
test("analytics uses Malaysia dates, keeps status counts consistent and excludes cancelled pickup demand", () => {
  const data = operationalAnalytics(
    [
      { created_at: "2026-11-11T16:30:00Z", pickup_at: "2026-11-12T01:45:00Z", status: "collected" },
      { created_at: "2026-11-11T17:00:00Z", pickup_at: "2026-11-12T01:45:00Z", status: "cancelled" },
      { created_at: "2026-11-11T15:59:00Z", pickup_at: "2026-11-12T01:45:00Z", status: "placed" },
    ],
    "2026-11-12T00:00:00+08:00",
    1,
  );
  assert.deepEqual(data.daily, [{ day: "2026-11-12", count: 2 }]);
  assert.equal(
    data.statuses.reduce((sum, row) => sum + row.count, 0),
    2,
  );
  assert.equal(data.hours[9].count, 1);
  assert.equal(
    data.hours.reduce((sum, row) => sum + row.count, 0),
    1,
  );
});
