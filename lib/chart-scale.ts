export type AxisScale = {
  ceiling: number;
  ticks: number[];
};

const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

export function niceAxisCeiling(rawMax: number, intervals = 2, integerOnly = false): AxisScale {
  const safeIntervals = Math.max(1, Math.floor(intervals));
  if (!Number.isFinite(rawMax) || rawMax <= 0) {
    const ceiling = safeIntervals;
    return {
      ceiling,
      ticks: Array.from({ length: safeIntervals + 1 }, (_, index) => index),
    };
  }

  const targetStep = rawMax / safeIntervals;
  const magnitude = Math.pow(10, Math.floor(Math.log10(targetStep)));
  let step = 10 * magnitude;

  for (const candidate of NICE_STEPS) {
    const scaled = candidate * magnitude;
    if (scaled >= targetStep) {
      if (integerOnly && scaled < 1) continue;
      if (integerOnly && !Number.isInteger(scaled)) continue;
      step = scaled;
      break;
    }
  }

  if (integerOnly && !Number.isInteger(step)) {
    step = Math.max(1, Math.ceil(targetStep));
  }

  const ceiling = step * safeIntervals;
  const ticks = Array.from({ length: safeIntervals + 1 }, (_, index) => Math.round(index * step * 1000) / 1000);
  return { ceiling, ticks };
}

export function barHeightPx(value: number, ceiling: number, maxHeightPx: number, minNonZeroPx = 3): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(ceiling) || ceiling <= 0) return 0;
  return Math.max(minNonZeroPx, Math.min(maxHeightPx, (value / ceiling) * maxHeightPx));
}

export function stackedBarHeightsPx(
  values: readonly number[],
  ceiling: number,
  maxHeightPx: number,
  minNonZeroPx = 2,
): number[] {
  const heights = values.map((value) => barHeightPx(value, ceiling, maxHeightPx, minNonZeroPx));
  const totalValue = values.reduce((sum, value) => sum + (Number.isFinite(value) && value > 0 ? value : 0), 0);
  const targetTotalPx = barHeightPx(totalValue, ceiling, maxHeightPx, minNonZeroPx);
  let excess = heights.reduce((sum, height) => sum + height, 0) - targetTotalPx;

  if (excess <= 0.001) return heights;

  const order = heights.map((height, index) => ({ height, index })).sort((a, b) => b.height - a.height);

  for (const item of order) {
    if (excess <= 0.001) break;
    const floorPx = values[item.index] > 0 ? minNonZeroPx : 0;
    const reducible = Math.max(0, heights[item.index] - floorPx);
    const cut = Math.min(reducible, excess);
    heights[item.index] -= cut;
    excess -= cut;
  }

  return heights;
}

export function formatAxisRM(rmValue: number): string {
  if (!Number.isFinite(rmValue) || rmValue <= 0) return "RM 0";
  if (rmValue >= 1000) {
    const compact = (rmValue / 1000).toFixed(1).replace(/\.0$/, "");
    return `RM ${compact}k`;
  }
  return Number.isInteger(rmValue) ? `RM ${rmValue}` : `RM ${rmValue.toFixed(1)}`;
}

export function cleanMenuName(name: string): string {
  return name.replace(/^\[Demo [^\]]+\]\s*/, "");
}

export function formatShortMytDate(dayStr: string): string {
  const parsed = Date.parse(dayStr.includes("T") ? dayStr : `${dayStr}T00:00:00+08:00`);
  if (!Number.isFinite(parsed)) return dayStr;
  return new Date(parsed).toLocaleDateString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
  });
}
