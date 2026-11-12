import { z } from "zod";
const integer = z.number().int();
export const adminScope = z
  .object({
    days: z.enum(["1", "7", "14", "30", "90"]).default("7"),
    vendorId: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,95}$/)
      .optional(),
    zoneId: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{0,95}$/)
      .optional(),
  })
  .strict();
export type AdminScope = z.infer<typeof adminScope>;
export const adminVendor = z.object({
  id: z.string(),
  name: z.string(),
  zone_id: z.string(),
  status: z.enum(["approved", "suspended"]),
  paused: z.boolean(),
  receiptsSen: integer,
  netSen: integer,
  expenseSen: integer,
  refundSen: integer,
  orders: integer,
  collected: integer,
  cancelled: integer,
  closed: integer,
  readyCount: integer,
  onTimeCount: integer,
  activeCount: integer,
  readyWaiting: integer,
  overdueCount: integer,
  lowStockCount: integer,
  soldOutCount: integer,
  previousOrders: integer,
  previousCollected: integer,
  previousClosed: integer,
  previousNetSen: integer,
  previousReceiptsSen: integer,
});
export const adminOverviewOutput = z.object({
  intelligence: z
    .object({
      vendors: z.array(
        z.object({
          vendorId: z.string(),
          unsuccessfulValueSen: integer.nonnegative(),
          receiptedOrders: integer.nonnegative(),
          averageReceiptSen: integer.nonnegative(),
        }),
      ),
    })
    .optional(),
  payments: z
    .object({ counterSen: integer, duitnowSen: integer, demoSen: integer, outstandingCounterSen: integer })
    .optional(),
  asOf: z.string(),
  since: z.string(),
  previousSince: z.string(),
  previousAsOf: z.string(),
  days: integer,
  source: z.literal("demo"),
  fingerprint: z.string().optional(),
  summary: z.object({
    netSen: integer,
    receiptsSen: integer,
    expenseSen: integer,
    refundSen: integer,
    reversalSen: integer,
    sharedNetSen: integer,
    orders: integer,
    collected: integer,
    closed: integer,
    active: integer,
    attention: integer,
  }),
  previous: z.object({
    available: z.boolean(),
    netSen: integer,
    receiptsSen: integer,
    orders: integer,
    collected: integer,
    closed: integer,
  }),
  vendors: z.array(adminVendor),
  daily: z.array(
    z.object({ day: z.string(), receiptsSen: integer, costsSen: integer, netSen: integer, orders: integer }),
  ),
  demand: z.array(z.object({ weekday: integer, hour: integer, orders: integer })),
  statuses: z.array(z.object({ status: z.string(), count: integer })),
  products: z.array(
    z.object({
      id: z.string(),
      vendorId: z.string(),
      name: z.string(),
      stock: integer,
      active: z.boolean(),
      priceSen: integer,
      units: integer,
      revenueSen: integer,
    }),
  ),
});
export type AdminOverview = z.infer<typeof adminOverviewOutput>;
export type AdminVendor = z.infer<typeof adminVendor>;
export const adminDetailOutput = adminOverviewOutput.extend({
  staff: z.array(z.object({ id: z.string(), name: z.string(), status: z.string() })),
  events: z.array(
    z.object({
      id: z.string(),
      actor_role: z.string(),
      action: z.string(),
      target: z.string(),
      reason: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});
export const adminInsightsOutput = z.object({
  assessments: z
    .array(
      z.object({
        id: z.enum(["expansion", "variety", "performance"]),
        label: z.string(),
        verdict: z.string(),
        summary: z.string(),
        evidence: z.array(z.string()),
        limitations: z.array(z.string()),
      }),
    )
    .default([]),
  source: z.enum(["gemini", "unavailable"]),
  asOf: z.string(),
  generatedAt: z.string(),
  fingerprint: z.string(),
  cached: z.boolean(),
  context: z.object({ weatherLabel: z.string(), fetchedLive: z.boolean() }),
  notes: z.array(z.string()),
  recommendations: z
    .array(
      z.object({
        id: z.string(),
        vendorId: z.string(),
        vendorIds: z.array(z.string()).optional(),
        title: z.string(),
        detail: z.string(),
        evidence: z.array(z.string()),
        assumptions: z.array(z.string()),
        href: z.string(),
        impactSen: integer.optional(),
        effect: z
          .object({
            receiptsSen: integer.nonnegative(),
            netSen: integer.nonnegative(),
            recoveredOrders: integer.nonnegative(),
            capturePct: z.number().min(0).max(40),
            byVendor: z
              .array(
                z.object({
                  vendorId: z.string(),
                  receiptsSen: integer.nonnegative(),
                  netSen: integer.nonnegative(),
                  recoveredOrders: integer.nonnegative(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .max(4),
});
export type AdminInsights = z.infer<typeof adminInsightsOutput>;
export function selectedAdminImpact(insights: AdminInsights | undefined, selected: string[], stale = false) {
  const byVendor = new Map<string, number>();
  if (insights?.source !== "gemini" || stale) return undefined;
  for (const rec of insights.recommendations) {
    if (!selected.includes(rec.id)) continue;
    for (const effect of rec.effect?.byVendor ??
      (rec.impactSen !== undefined ? [{ vendorId: rec.vendorId, netSen: rec.impactSen }] : []))
      byVendor.set(effect.vendorId, Math.max(byVendor.get(effect.vendorId) ?? 0, effect.netSen));
  }
  return byVendor.size ? [...byVendor.values()].reduce((sum, value) => sum + value, 0) : undefined;
}
export const adminChatInput = z
  .object({
    scope: adminScope,
    message: z.string().trim().min(1).max(1000),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(3000) }))
      .max(10)
      .default([]),
  })
  .strict();
export const adminChatOutput = z.object({
  reply: z.string(),
  ok: z.boolean(),
  links: z.array(z.object({ label: z.string(), href: z.string() })),
  asOf: z.string(),
});
export function adminLink(page: string, scope: AdminScope, vendorId?: string) {
  const params = new URLSearchParams({ days: scope.days });
  if (scope.zoneId) params.set("zoneId", scope.zoneId);
  if (vendorId ?? scope.vendorId) params.set("vendorId", (vendorId ?? scope.vendorId)!);
  return `/admin${page ? "/" + page : ""}?${params}`;
}
export const collectionRate = (collected: number, closed: number) => (closed ? (collected / closed) * 100 : null);
export function adminAttention(v: AdminVendor) {
  return [
    v.overdueCount ? `${v.overdueCount} overdue preparation` : "",
    v.readyWaiting ? `${v.readyWaiting} ready for pickup` : "",
    v.soldOutCount ? `${v.soldOutCount} sold-out products` : "",
    v.lowStockCount ? `${v.lowStockCount} low-stock products` : "",
    v.status !== "approved" ? "Stall suspended" : v.paused ? "Order intake paused" : "",
  ].filter(Boolean);
}
export function adminOutlook(data: AdminOverview, horizon: number, impactSen = 0) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(data.asOf));
  const completed = data.daily.filter((row) => row.day < today);
  const mean = completed.length ? completed.reduce((sum, row) => sum + row.netSen, 0) / completed.length : 0;
  const perDay = impactSen / Math.max(1, data.days);
  return Array.from({ length: horizon + 1 }, (_, i) => ({
    day: i,
    baselineSen: Math.round(mean * i),
    optimizedSen: Math.round((mean + perDay) * i),
  }));
}
