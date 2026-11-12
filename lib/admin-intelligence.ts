import type { AdminOverview, AdminVendor, AdminInsights } from "./admin-dashboard";
import { money } from "./orders";
export type AdminAssessmentFact = {
  id: "expansion" | "variety" | "performance";
  label: string;
  verdict: string;
  evidence: string[];
  limitations: string[];
};
export function adminStrategicFacts(data: AdminOverview): AdminAssessmentFact[] {
  const operating = data.vendors.filter((v) => v.status === "approved" && !v.paused);
  const strained = operating.filter(
    (v) =>
      v.overdueCount > 0 ||
      (v.readyCount >= 30 && v.onTimeCount / v.readyCount < 0.85 && v.closed > 0 && v.cancelled / v.closed >= 0.12),
  );
  const operatingIds = new Set(operating.map((v) => v.id));
  const published = data.products.filter((p) => p.active && operatingIds.has(p.vendorId)),
    thin = operating.filter((v) => published.filter((p) => p.vendorId === v.id).length < 3);
  const poor = data.vendors.filter(
    (v) =>
      v.netSen < 0 ||
      (v.closed >= 30 && v.collected / v.closed < 0.9) ||
      (v.previousReceiptsSen > 0 && v.receiptsSen < v.previousReceiptsSen * 0.85),
  );
  const receipts = data.vendors.map((v) => v.receiptsSen).sort((a, b) => a - b),
    median = receipts.length ? receipts[Math.floor(receipts.length / 2)] : 0;
  const lower = data.vendors.filter((v) => median > 0 && v.receiptsSen < median * 0.75);
  const closedOrders = data.vendors.reduce((n, v) => n + v.closed, 0);
  return [
    {
      id: "expansion",
      label: "Do we need more vendors?",
      verdict:
        data.summary.orders < 100
          ? "Insufficient history"
          : strained.length >= 2
            ? "Investigate peak coverage"
            : "Expansion not established",
      evidence: [
        `${operating.length} approved, unpaused stalls; ${data.summary.orders} orders created in this period.`,
        `${strained.length} stalls meet the operational-pressure screen: current overdue preparation, or recorded readiness below 85% plus unsuccessful orders at or above 12% with sufficient history.`,
        `${data.summary.active} current active orders; ${data.vendors.reduce((n, v) => n + v.overdueCount, 0)} overdue preparation orders.`,
      ],
      limitations: [
        "Unmet searches, abandoned checkouts and walk-away demand are not tracked.",
        "Current queues are one snapshot, not a sustained utilisation measurement. More vendors cannot be justified from enrolment or weather alone.",
      ],
    },
    {
      id: "variety",
      label: "Are there enough food options?",
      verdict: thin.length ? "Review menu breadth" : "Validate student preferences",
      evidence: [
        `${published.length} published products across ${operating.length} operating stalls.`,
        `${thin.length} operating stalls publish fewer than 3 products${thin.length ? ": " + thin.map((v) => v.name).join(", ") : ""}.`,
        `${published.filter((p) => p.stock === 0).length} published products are sold out; ${published.filter((p) => p.stock > 0 && p.units === 0).length} available products have no collected units in this period.`,
        ...lower
          .slice(0, 2)
          .map(
            (v) =>
              `${v.name} has ${money(v.receiptsSen)} receipts, below the campus median ${money(median)}; different menus and prices can explain this.`,
          ),
      ],
      limitations: [
        "Menu breadth does not measure dietary coverage or student preferences; ingredient/allergen and unmet-demand surveys are not connected.",
        "Adding a cuisine or stall may redistribute existing sales; no automatic campus revenue uplift is assigned.",
      ],
    },
    {
      id: "performance",
      label: "Which vendors need support?",
      verdict: poor.length
        ? `${poor.length} stalls warrant review`
        : closedOrders < 30
          ? "Insufficient performance history"
          : "No broad deterioration observed",
      evidence: poor.length
        ? poor.map(
            (v) =>
              `${v.name}: ${money(v.netSen)} net cashflow; ${v.closed ? ((v.collected / v.closed) * 100).toFixed(1) : "unavailable"}% closed-order collection; ${money(v.receiptsSen)} receipts vs ${money(v.previousReceiptsSen)} in the comparable previous period.`,
          )
        : closedOrders < 30
          ? [
              `Only ${closedOrders} closed orders are available; this does not establish vendor stability or deterioration.`,
            ]
          : [
              "No vendor meets the negative cashflow, sub-90% closed-order collection, or greater-than-15% comparable receipt-decline screen.",
            ],
      limitations: [
        "Cashflow is not accounting profit. Low average ticket size or low revenue alone does not prove poor management.",
      ],
    },
  ];
}
export function recoveryOpportunity(data: AdminOverview, v: AdminVendor) {
  const evidence = data.intelligence?.vendors.find((row) => row.vendorId === v.id);
  if (!evidence || v.cancelled <= 0 || evidence.unsuccessfulValueSen <= 0 || v.receiptsSen <= 0 || v.netSen <= 0)
    return undefined;
  return {
    orders: v.cancelled,
    valueSen: evidence.unsuccessfulValueSen,
    netRatio: Math.max(0, Math.min(1, v.netSen / v.receiptsSen)),
  };
}
export function recoveryEffect(data: AdminOverview, vendorId: string, capturePct: number) {
  if (!Number.isInteger(capturePct) || capturePct < 5 || capturePct > 40)
    throw Error("Recovery assumption outside supported bounds.");
  const v = data.vendors.find((v) => v.id === vendorId),
    opportunity = v && recoveryOpportunity(data, v);
  if (!opportunity) return undefined;
  const recoveredOrders = Math.floor((opportunity.orders * capturePct) / 100);
  const receiptsSen = Math.round((opportunity.valueSen * recoveredOrders) / opportunity.orders);
  return { recoveredOrders, receiptsSen, netSen: Math.round(receiptsSen * opportunity.netRatio), capturePct };
}
export type AdminOptimization = {
  fingerprint: string;
  netSen: number;
  receiptsSen: number;
  recoveredOrders: number;
  byVendor: Record<string, { netSen: number; receiptsSen: number; recoveredOrders: number }>;
  priorityVendorIds: string[];
  recommendations: number;
};
export function adminOptimization(
  data: AdminOverview,
  insights: AdminInsights | undefined,
  selected: string[],
  stale = false,
): AdminOptimization | undefined {
  if (insights?.source !== "gemini" || stale) return undefined;
  const byVendor: AdminOptimization["byVendor"] = {},
    priorities = new Set<string>();
  let recommendations = 0;
  for (const rec of insights.recommendations) {
    if (!selected.includes(rec.id)) continue;
    recommendations++;
    for (const vendorId of rec.vendorIds ?? [rec.vendorId]) priorities.add(vendorId);
    const effect = rec.effect;
    for (const row of effect?.byVendor ?? (effect ? [{ vendorId: rec.vendorId, ...effect }] : [])) {
      if (!data.vendors.some((v) => v.id === row.vendorId)) continue;
      if (!byVendor[row.vendorId] || row.netSen > byVendor[row.vendorId].netSen) byVendor[row.vendorId] = row;
    }
  }
  if (!recommendations) return undefined;
  return {
    fingerprint: insights.fingerprint,
    byVendor,
    netSen: Object.values(byVendor).reduce((n, v) => n + v.netSen, 0),
    receiptsSen: Object.values(byVendor).reduce((n, v) => n + v.receiptsSen, 0),
    recoveredOrders: Object.values(byVendor).reduce((n, v) => n + v.recoveredOrders, 0),
    priorityVendorIds: [...priorities],
    recommendations,
  };
}

export function adminDailyPreview(data: AdminOverview, optimization?: AdminOptimization) {
  const allocate = (total: number, weights: number[]) => {
    const sum = weights.reduce((n, v) => n + Math.max(0, v), 0);
    if (!sum) return weights.map(() => 0);
    const exact = weights.map((w) => (total * Math.max(0, w)) / sum),
      values = exact.map(Math.floor);
    let remaining = total - values.reduce((n, v) => n + v, 0);
    const order = exact
      .map((v, i) => ({ i, fraction: v - values[i] }))
      .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (const row of order) {
      if (!remaining) break;
      values[row.i]++;
      remaining--;
    }
    return values;
  };
  const receipts = allocate(
    optimization?.receiptsSen ?? 0,
    data.daily.map((d) => d.receiptsSen),
  );
  const net = allocate(
    optimization?.netSen ?? 0,
    data.daily.map((d) => d.receiptsSen),
  );
  return data.daily.map((d, i) => ({
    ...d,
    optimizedReceiptsSen: d.receiptsSen + receipts[i],
    optimizedNetSen: d.netSen + net[i],
    optimizedCostsSen: d.costsSen + receipts[i] - net[i],
  }));
}
