const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trafficLoad } = require('../.test-build/lib/traffic-load');
const now = Date.parse('2026-11-11T12:05:00+08:00');
const bucket = (minutes, used, capacity = 10, vendor = 'a') => ({ vendor_id: vendor, starts_at: new Date(now + minutes * 60000).toISOString(), reserved_units: used, total_units: capacity, pickup_count: 2 });
test('traffic uses overlapping windows and busiest capacity ratio, excluding other stalls and distant bookings', () => {
  const load = trafficLoad([bucket(-5, 9), bucket(10, 1), bucket(40, 10), bucket(0, 10, 10, 'b'), bucket(-20, 10)], 'a', now);
  assert.deepEqual(load, { level:'busy', label:'Busy', pickups:4, peakPercent:90 });
});
test('load thresholds, unavailable capacity and empty windows are distinct', () => {
  assert.equal(trafficLoad([bucket(0, 0)], 'a', now).level, 'low');
  assert.equal(trafficLoad([bucket(0, 5)], 'a', now).level, 'moderate');
  assert.equal(trafficLoad([bucket(0, 8)], 'a', now).level, 'busy');
  assert.equal(trafficLoad([bucket(0, 12)], 'a', now).peakPercent, 120);
  assert.equal(trafficLoad([bucket(0, 0, 0)], 'a', now).level, 'unknown');
  assert.equal(trafficLoad([], 'a', now).level, 'unknown');
  assert.equal(trafficLoad([bucket(0, 1, 0)], 'a', now).level, 'busy');
});
