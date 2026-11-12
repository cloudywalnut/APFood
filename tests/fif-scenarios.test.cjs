const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectScenario, scenarioInput, scenarioOutput, analyzeSalesPatterns, computeVendorBenchmark } = require('../.test-build/lib/fif-scenarios');
const baseline = [{ id:'noodles', name:'Noodles', units:10, revenueSen:10000, currentPriceSen:1000, workUnits:20 }];
const action = (extra = {}) => ({ id:'a',kind:'preparation',title:'Trial',detail:'Trial',evidence:[],assumptions:[],volumeChangePct:0,workSavingPct:0,...extra });
test('scenario changes prices and demand once, then applies preparation savings to the changed volume', () => {
  const result = projectScenario(baseline,[action({kind:'price',itemId:'noodles',proposedPriceSen:1100,volumeChangePct:-2}),action({kind:'weather',itemId:'noodles',volumeChangePct:8}),action({workSavingPct:8})]);
  assert.deepEqual(result,{ revenueSen:11660,workUnits:19.5,units:10.6 });
  assert.deepEqual(projectScenario(baseline,[]),{revenueSen:10000,workUnits:20,units:10});
});
test('overlapping effects are bounded and workload may honestly increase when volume outpaces efficiency', () => {
  const result=projectScenario(baseline,[action({volumeChangePct:15,workSavingPct:15}),action({volumeChangePct:15,workSavingPct:15})]);
  assert.deepEqual(result,{revenueSen:12000,workUnits:20.4,units:12});
  assert.equal(projectScenario(baseline,[action({itemId:'other',volumeChangePct:10})]).revenueSen,10000);
  assert.deepEqual(projectScenario([], [action({volumeChangePct:15})]), {revenueSen:0,workUnits:0,units:0});
});
test('generation accepts explicit context assumptions and rejects hidden client-supplied forecasts', () => {
  const input={vendorId:'campus-noodle-bar',days:'7',weather:'rainy',audience:'students'};
  assert.equal(scenarioInput.safeParse(input).success,true);
  assert.equal(scenarioInput.safeParse({...input,forecastRevenue:999999}).success,false);
});
test('sales pattern analysis identifies what is selling, what should sell, peak hours and day patterns', () => {
  const menu = [
    { id: 'laksa', name: 'Hot Curry Laksa', price_sen: 1250, discount_sen: 0, stock: 20, active: true, work_units: 2 },
    { id: 'dumplings', name: 'Steamed Dumplings', price_sen: 750, discount_sen: 0, stock: 25, active: true, work_units: 1 },
  ];
  const products = [
    { id: 'laksa', name: 'Hot Curry Laksa', units: 12, revenueSen: 15000, workUnits: 24, currentPriceSen: 1250 },
    { id: 'dumplings', name: 'Steamed Dumplings', units: 0, revenueSen: 0, workUnits: 0, currentPriceSen: 750 },
  ];
  const orders = [
    { status: 'collected', total_sen: 2500, pickup_at: '2026-11-09T12:15:00+08:00', created_at: '2026-11-09T11:30:00+08:00', lines: [{ itemId: 'laksa', name: 'Hot Curry Laksa', quantity: 2, unit: 1250 }] },
    { status: 'collected', total_sen: 1250, pickup_at: '2026-11-09T12:45:00+08:00', created_at: '2026-11-09T12:00:00+08:00', lines: [{ itemId: 'laksa', name: 'Hot Curry Laksa', quantity: 1, unit: 1250 }] },
    { status: 'cancelled', total_sen: 1250, pickup_at: '2026-11-10T15:00:00+08:00', created_at: '2026-11-10T14:00:00+08:00', lines: [{ itemId: 'laksa', quantity: 1, unit: 1250 }] },
  ];
  const patterns = analyzeSalesPatterns(orders, products, menu, 'rainy');
  assert.equal(patterns.topSellers[0].itemId, 'laksa');
  assert.equal(patterns.topSellers[0].sharePct, 100);
  assert.equal(patterns.underperformers[0].itemId, 'dumplings');
  assert.equal(patterns.peakHours[0].hour, 12);
  assert.equal(patterns.peakHours[0].orders, 2);
  assert.equal(patterns.peakHours[0].topItemName, 'Hot Curry Laksa');
  const mon = patterns.dayPatterns.find(d => d.dayName === 'Mon');
  assert.equal(mon.orders, 2);
  assert.equal(mon.revenueSen, 3750);
  assert.equal(patterns.dayPatterns.find(d => d.dayName === 'Tue').orders, 0);

  const empty = analyzeSalesPatterns([], [], [], 'hot');
  assert.deepEqual(empty.topSellers, []);
  assert.deepEqual(empty.peakHours, []);
});
test('peer vendor benchmark ranks stalls and computes campus averages', () => {
  const benchmark = computeVendorBenchmark('brew-and-bites', [
    { vendorId: 'campus-noodle-bar', revenueSen: 20000, orders: 20, collectedOrders: 20, totalOrders: 20 },
    { vendorId: 'brew-and-bites', revenueSen: 10000, orders: 10, collectedOrders: 9, totalOrders: 10 },
    { vendorId: 'western', revenueSen: 5000, orders: 5, collectedOrders: 4, totalOrders: 5 },
  ]);
  assert.equal(benchmark.vendorRank, 2);
  assert.equal(benchmark.totalVendors, 3);
  assert.equal(benchmark.percentile, 50);
  assert.equal(benchmark.metrics.fulfilmentRatePct, 90);
  assert.equal(benchmark.metrics.peerAvgRevenueSen, 12500);
  assert.equal(computeVendorBenchmark('unknown', []), undefined);

  const zeroOrder = computeVendorBenchmark('new-stall', [
    { vendorId: 'campus-noodle-bar', revenueSen: 20000, orders: 20, collectedOrders: 20, totalOrders: 20 },
    { vendorId: 'new-stall', revenueSen: 0, orders: 0, collectedOrders: 0, totalOrders: 0 },
  ]);
  assert.equal(zeroOrder.vendorRank, 2);
  assert.equal(zeroOrder.score, 0);
  assert.equal(zeroOrder.ratingLabel, 'Needs Boost');
  assert.equal(zeroOrder.metrics.fulfilmentRatePct, 0);
  assert.equal(zeroOrder.metrics.avgOrderValueSen, 0);
});
test('timing and merchandising actions project uplift and pass scenarioOutput validation', () => {
  const result = projectScenario(baseline, [
    action({ kind: 'merchandising', itemId: 'noodles', volumeChangePct: 10 }),
    action({ kind: 'timing', itemId: 'noodles', volumeChangePct: 6, workSavingPct: 5 }),
  ]);
  assert.deepEqual(result, { revenueSen: 11600, workUnits: 22, units: 11.6 });
  const parsed = scenarioOutput.safeParse({
    generatedAt: new Date().toISOString(),
    dataAsOf: new Date().toISOString(),
    days: '7',
    weather: 'hot',
    audience: 'students',
    source: 'rules',
    cached: false,
    products: baseline,
    actions: [
      action({ id: 'a1', kind: 'merchandising', itemId: 'noodles', volumeChangePct: 10 }),
      action({ id: 'a2', kind: 'timing', itemId: 'noodles', volumeChangePct: 6, workSavingPct: 5 }),
    ],
    notes: [],
  });
  assert.equal(parsed.success, true);
});
