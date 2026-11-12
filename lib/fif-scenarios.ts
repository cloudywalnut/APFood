import { z } from "zod";

export const scenarioInput = z
  .object({
    vendorId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,95}$/),
    days: z.enum(["1", "7", "14"]),
    weather: z.enum(["unknown", "rainy", "hot"]).optional(),
    audience: z.enum(["unknown", "students", "staff", "mixed"]).optional(),
  })
  .strict();
export const scenarioContext = z.object({
  location: z.string(),
  weatherLabel: z.string(),
  temperatureC: z.number().optional(),
  audienceLabel: z.string(),
  fetchedLive: z.boolean(),
});
export const scenarioProduct = z.object({
  id: z.string(),
  name: z.string(),
  units: z.number().nonnegative(),
  revenueSen: z.number().int().nonnegative(),
  workUnits: z.number().nonnegative(),
  currentPriceSen: z.number().int().nonnegative(),
});
export const scenarioAction = z.object({
  id: z.string(),
  itemId: z.string().optional(),
  kind: z.enum(["price", "weather", "preparation", "timing", "merchandising"]),
  title: z.string(),
  detail: z.string(),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  proposedPriceSen: z.number().int().positive().optional(),
  volumeChangePct: z.number().min(-15).max(15),
  workSavingPct: z.number().min(0).max(15),
});
export const scenarioPatterns = z.object({
  topSellers: z.array(
    z.object({
      itemId: z.string(),
      name: z.string(),
      units: z.number().int().nonnegative(),
      revenueSen: z.number().int().nonnegative(),
      sharePct: z.number().nonnegative(),
    }),
  ),
  underperformers: z.array(
    z.object({
      itemId: z.string(),
      name: z.string(),
      units: z.number().int().nonnegative(),
      stock: z.number().int().nonnegative(),
      reason: z.string(),
    }),
  ),
  peakHours: z.array(
    z.object({
      hour: z.number().int().min(0).max(23),
      label: z.string(),
      orders: z.number().int().nonnegative(),
      topItemName: z.string().optional(),
    }),
  ),
  dayPatterns: z.array(
    z.object({
      dayIndex: z.number().int().min(0).max(6),
      dayName: z.string(),
      orders: z.number().int().nonnegative(),
      revenueSen: z.number().int().nonnegative(),
      topItemName: z.string().optional(),
    }),
  ),
});
export const scenarioBenchmark = z.object({
  vendorRank: z.number().int().positive(),
  totalVendors: z.number().int().positive(),
  percentile: z.number().min(0).max(100),
  score: z.number().min(0).max(100),
  ratingLabel: z.string(),
  summary: z.string(),
  metrics: z.object({
    revenueSen: z.number().int().nonnegative(),
    peerAvgRevenueSen: z.number().int().nonnegative(),
    orders: z.number().int().nonnegative(),
    peerAvgOrders: z.number().nonnegative(),
    avgOrderValueSen: z.number().int().nonnegative(),
    peerAvgOrderValueSen: z.number().int().nonnegative(),
    fulfilmentRatePct: z.number().min(0).max(100),
    peerAvgFulfilmentRatePct: z.number().min(0).max(100),
  }),
});
export const scenarioOutput = z.object({
  generatedAt: z.string(),
  dataAsOf: z.string(),
  days: z.enum(["1", "7", "14"]),
  weather: z.enum(["unknown", "rainy", "hot"]),
  audience: z.enum(["unknown", "students", "staff", "mixed"]),
  source: z.enum(["gemini", "rules"]),
  cached: z.boolean(),
  context: scenarioContext.optional(),
  products: z.array(scenarioProduct),
  actions: z.array(scenarioAction).max(4),
  notes: z.array(z.string()),
  patterns: scenarioPatterns.optional(),
  benchmark: scenarioBenchmark.optional(),
  signals: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        summary: z.string(),
        source: z.enum(["sales", "operations", "campus", "weather"]),
        available: z.boolean(),
      }),
    )
    .optional(),
});
export type ScenarioAction = z.infer<typeof scenarioAction>;
export type ScenarioProduct = z.infer<typeof scenarioProduct>;
export type ScenarioPatterns = z.infer<typeof scenarioPatterns>;
export type ScenarioBenchmark = z.infer<typeof scenarioBenchmark>;
export type ScenarioResult = z.infer<typeof scenarioOutput>;

// Counterfactual replay of the same sales mix. No uplift is measured or guaranteed.
// Clamp combined effects so overlapping recommendations cannot compound unchecked.
export function projectScenario(
  products: ScenarioProduct[],
  actions: ScenarioAction[],
  demandScale = 1,
  effortScale = 1,
) {
  let revenueSen = 0,
    workUnits = 0,
    units = 0;
  for (const product of products) {
    const relevant = actions.filter((action) => !action.itemId || action.itemId === product.id);
    const price = relevant.find((action) => action.kind === "price" && action.proposedPriceSen !== undefined);
    const priceDelta = price ? price.proposedPriceSen! - product.currentPriceSen : 0;
    const volumeChange = Math.max(
      -20,
      Math.min(
        20,
        relevant.reduce((sum, action) => sum + action.volumeChangePct, 0) * Math.max(0, Math.min(1.5, demandScale)),
      ),
    );
    const effortSaving = Math.max(
      0,
      Math.min(
        15,
        relevant.reduce((sum, action) => sum + action.workSavingPct, 0) * Math.max(0, Math.min(1.5, effortScale)),
      ),
    );
    const volume = 1 + volumeChange / 100;
    revenueSen += Math.max(0, product.revenueSen + product.units * priceDelta) * volume;
    workUnits += product.workUnits * volume * (1 - effortSaving / 100);
    units += product.units * volume;
  }
  return {
    revenueSen: Math.round(revenueSen),
    workUnits: Math.round(workUnits * 10) / 10,
    units: Math.round(units * 10) / 10,
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const cleanProductName = (value: string) => value.replace(/^\[Demo [^\]]+\]\s*/, "");

export type PatternOrder = {
  status: string;
  total_sen: number;
  pickup_at: string;
  created_at: string;
  lines: Array<{ itemId: string; name?: string; quantity: number; unit: number }>;
};

export type PatternMenuRow = {
  id: string;
  name: string;
  price_sen: number;
  discount_sen: number;
  stock: number;
  active: boolean;
  work_units: number;
};

function klParts(iso: string) {
  const date = new Date(iso);
  const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kuala_Lumpur", weekday: "short" }).format(date);
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  const dayIndex = Math.max(0, DAY_NAMES.indexOf(weekdayStr as (typeof DAY_NAMES)[number]));
  const hour = Number(hourStr) % 24;
  return { dayIndex, hour };
}

export function analyzeSalesPatterns(
  orders: PatternOrder[],
  products: ScenarioProduct[],
  menu: PatternMenuRow[],
  effectiveWeather: "rainy" | "hot",
): ScenarioPatterns {
  const totalUnits = products.reduce((sum, p) => sum + p.units, 0);
  const topSellers = products
    .filter((p) => p.units > 0)
    .slice()
    .sort((a, b) => b.units - a.units || b.revenueSen - a.revenueSen)
    .slice(0, 4)
    .map((p) => ({
      itemId: p.id,
      name: cleanProductName(p.name),
      units: p.units,
      revenueSen: p.revenueSen,
      sharePct: totalUnits > 0 ? Math.round((p.units / totalUnits) * 1000) / 10 : 0,
    }));

  const activeMenu = menu.filter((item) => item.active && item.stock > 0);
  const avgUnits = activeMenu.length > 0 ? totalUnits / activeMenu.length : 0;
  const underperformers = activeMenu
    .map((item) => {
      const soldUnits = products.find((p) => p.id === item.id)?.units ?? 0;
      const clean = cleanProductName(item.name);
      const weatherFit =
        effectiveWeather === "rainy"
          ? /soup|noodle|mee|rice|hot|tea|coffee|kopi|curry/i.test(clean) && !/iced|cold|chilled|ice\b/i.test(clean)
          : /iced|cold|juice|salad|fruit|drink|teh|kopi/i.test(clean);
      const reason =
        soldUnits === 0
          ? weatherFit
            ? `0 sold; suitable for the ${effectiveWeather} scenario, with ${item.stock} in stock`
            : `0 sold with ${item.stock} portions ready to move`
          : `Low velocity (${soldUnits} sold vs ${Math.round(avgUnits)} avg) · ${item.stock} in stock`;
      return { itemId: item.id, name: clean, units: soldUnits, stock: item.stock, reason };
    })
    .filter((item) => item.units === 0 || (avgUnits >= 2 && item.units < avgUnits * 0.45))
    .sort((a, b) => a.units - b.units || b.stock - a.stock)
    .slice(0, 4);

  const validOrders = orders.filter((o) => !["cancelled", "rejected"].includes(o.status));
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orders: 0,
    items: new Map<string, number>(),
  }));
  const dayBuckets = Array.from({ length: 7 }, (_, dayIndex) => ({
    dayIndex,
    dayName: DAY_NAMES[dayIndex],
    orders: 0,
    revenueSen: 0,
    items: new Map<string, number>(),
  }));

  const nameById = new Map(menu.map((item) => [item.id, cleanProductName(item.name)]));
  for (const order of validOrders) {
    const { dayIndex, hour } = klParts(order.pickup_at || order.created_at);
    const hb = hourBuckets[hour];
    const db = dayBuckets[dayIndex];
    if (hb) hb.orders += 1;
    if (db) {
      db.orders += 1;
      if (order.status === "collected") db.revenueSen += order.total_sen;
    }
    for (const line of order.lines) {
      const label = cleanProductName(line.name || nameById.get(line.itemId) || line.itemId);
      if (hb) hb.items.set(label, (hb.items.get(label) ?? 0) + line.quantity);
      if (db) db.items.set(label, (db.items.get(label) ?? 0) + line.quantity);
    }
  }

  const topFromMap = (map: Map<string, number>) => {
    let bestName: string | undefined;
    let bestQty = 0;
    for (const [name, qty] of map.entries()) {
      if (qty > bestQty) {
        bestQty = qty;
        bestName = name;
      }
    }
    return bestName;
  };

  const peakHours = hourBuckets
    .filter((b) => b.orders > 0)
    .sort((a, b) => b.orders - a.orders || a.hour - b.hour)
    .slice(0, 4)
    .map((b) => ({
      hour: b.hour,
      label: `${String(b.hour).padStart(2, "0")}:00–${String((b.hour + 1) % 24).padStart(2, "0")}:00`,
      orders: b.orders,
      topItemName: topFromMap(b.items),
    }));

  const monFirstOrder = [1, 2, 3, 4, 5, 6, 0];
  const dayPatterns = monFirstOrder.map((idx) => {
    const b = dayBuckets[idx];
    return {
      dayIndex: b.dayIndex,
      dayName: b.dayName,
      orders: b.orders,
      revenueSen: b.revenueSen,
      topItemName: topFromMap(b.items),
    };
  });

  return { topSellers, underperformers, peakHours, dayPatterns };
}

export type PeerVendorStat = {
  vendorId: string;
  revenueSen: number;
  orders: number;
  collectedOrders: number;
  totalOrders: number;
};

export function computeVendorBenchmark(vendorId: string, stats: PeerVendorStat[]): ScenarioBenchmark | undefined {
  if (!stats.length) return undefined;
  const maxRev = Math.max(1, ...stats.map((s) => s.revenueSen));
  const maxOrders = Math.max(1, ...stats.map((s) => s.orders));
  const scored = stats
    .map((s) => {
      const fulfilmentRatePct = s.totalOrders > 0 ? Math.round((s.collectedOrders / s.totalOrders) * 1000) / 10 : 0;
      const avgOrderValueSen = s.collectedOrders > 0 ? Math.round(s.revenueSen / s.collectedOrders) : 0;
      const score =
        Math.round(((s.revenueSen / maxRev) * 50 + (s.orders / maxOrders) * 30 + (fulfilmentRatePct / 100) * 20) * 10) /
        10;
      return { ...s, fulfilmentRatePct, avgOrderValueSen, score };
    })
    .sort((a, b) => b.score - a.score || b.revenueSen - a.revenueSen);

  const idx = scored.findIndex((s) => s.vendorId === vendorId);
  if (idx === -1) return undefined;
  const current = scored[idx];
  const peers = scored.filter((s) => s.vendorId !== vendorId);
  const peerPool = peers.length ? peers : scored;
  const peerAvgRevenueSen = Math.round(peerPool.reduce((sum, s) => sum + s.revenueSen, 0) / peerPool.length);
  const peerAvgOrders = Math.round((peerPool.reduce((sum, s) => sum + s.orders, 0) / peerPool.length) * 10) / 10;
  const peerAvgOrderValueSen = Math.round(peerPool.reduce((sum, s) => sum + s.avgOrderValueSen, 0) / peerPool.length);
  const peerAvgFulfilmentRatePct =
    Math.round((peerPool.reduce((sum, s) => sum + s.fulfilmentRatePct, 0) / peerPool.length) * 10) / 10;
  const totalVendors = scored.length;
  const vendorRank = idx + 1;
  const percentile = totalVendors > 1 ? Math.round(((totalVendors - vendorRank) / (totalVendors - 1)) * 100) : 100;
  const ratingLabel =
    current.score >= 80
      ? "Top Performer"
      : current.score >= 60
        ? "Above Average"
        : current.score >= 40
          ? "Competitive"
          : current.score >= 20
            ? "Growing"
            : "Needs Boost";
  const revDiffPct =
    peerAvgRevenueSen > 0 ? Math.round(((current.revenueSen - peerAvgRevenueSen) / peerAvgRevenueSen) * 100) : 0;
  const summary = `Ranked #${vendorRank} of ${totalVendors} active campus stalls (${ratingLabel}). Revenue is ${revDiffPct >= 0 ? "+" : ""}${revDiffPct}% vs campus average.`;

  return {
    vendorRank,
    totalVendors,
    percentile,
    score: current.score,
    ratingLabel,
    summary,
    metrics: {
      revenueSen: current.revenueSen,
      peerAvgRevenueSen,
      orders: current.orders,
      peerAvgOrders,
      avgOrderValueSen: current.avgOrderValueSen,
      peerAvgOrderValueSen,
      fulfilmentRatePct: current.fulfilmentRatePct,
      peerAvgFulfilmentRatePct,
    },
  };
}
