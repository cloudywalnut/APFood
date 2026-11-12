const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTypescript } = require("./support/load-typescript.cjs");

const { niceAxisCeiling, barHeightPx, stackedBarHeightsPx, formatAxisRM, cleanMenuName, formatShortMytDate } =
  loadTypescript("lib/chart-scale.ts");

test("niceAxisCeiling produces clean ticks for zero, small integers and large values", () => {
  assert.deepEqual(niceAxisCeiling(0, 3, false), { ceiling: 3, ticks: [0, 1, 2, 3] });
  assert.deepEqual(niceAxisCeiling(-10, 2, true), { ceiling: 2, ticks: [0, 1, 2] });
  assert.deepEqual(niceAxisCeiling(Number.NaN, 2, true), { ceiling: 2, ticks: [0, 1, 2] });

  const integerSmall = niceAxisCeiling(3, 2, true);
  assert.equal(integerSmall.ceiling >= 3, true);
  assert.equal(integerSmall.ticks.every(Number.isInteger), true);
  assert.deepEqual(integerSmall.ticks, [0, 2, 4]);

  const integerOne = niceAxisCeiling(1, 2, true);
  assert.deepEqual(integerOne, { ceiling: 2, ticks: [0, 1, 2] });

  const rmScale = niceAxisCeiling(125.5, 3, false);
  assert.deepEqual(rmScale, { ceiling: 150, ticks: [0, 50, 100, 150] });
});

test("barHeightPx clamps non-zero bars to visible minimum and ceiling maximum", () => {
  assert.equal(barHeightPx(0, 100, 140), 0);
  assert.equal(barHeightPx(-5, 100, 140), 0);
  assert.equal(barHeightPx(10, 0, 140), 0);
  assert.equal(barHeightPx(1, 1000, 140, 3), 3);
  assert.equal(barHeightPx(50, 100, 140), 70);
  assert.equal(barHeightPx(150, 100, 140), 140);
});

test("formatAxisRM, cleanMenuName and formatShortMytDate format values clearly", () => {
  assert.equal(formatAxisRM(0), "RM 0");
  assert.equal(formatAxisRM(50), "RM 50");
  assert.equal(formatAxisRM(12.5), "RM 12.5");
  assert.equal(formatAxisRM(1000), "RM 1k");
  assert.equal(formatAxisRM(1250), "RM 1.3k");

  assert.equal(cleanMenuName("[Demo Stall] Nasi Lemak Ayam"), "Nasi Lemak Ayam");
  assert.equal(cleanMenuName("Teh Tarik"), "Teh Tarik");

  assert.equal(formatShortMytDate("2026-11-06"), "6 Nov");
  assert.equal(formatShortMytDate("invalid-date"), "invalid-date");
});

test("stackedBarHeightsPx keeps total stack height within ceiling while preserving non-zero floors", () => {
  const heights = stackedBarHeightsPx([100, 100, 9800], 10000, 140, 2);
  const sum = heights.reduce((acc, h) => acc + h, 0);
  assert.equal(heights[0], 2);
  assert.equal(heights[1], 2);
  assert.equal(Math.round(sum * 1000) / 1000 <= 140, true);
  assert.deepEqual(stackedBarHeightsPx([0, 0, 0], 100, 140, 2), [0, 0, 0]);
});
