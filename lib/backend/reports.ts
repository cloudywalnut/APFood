import { z } from "zod";
import { dayKey } from "../orders";
import { id, ledgerRow, orderLine, payment, status } from "./contracts";
import { BackendError, unwrap } from "./errors";
import type { RequestClient } from "./supabase";
import { operationalAnalytics } from "../operational-analytics";

const filters = z.object({
  days: z.enum(["1", "7", "14"]).transform(Number),
  vendorId: id.optional(),
  zoneId: id.optional(),
});
const reportOrder = z.object({
  vendor_id: id,
  zone_id: id,
  payment,
  status,
  total_sen: z.number().int(),
  lines: z.array(orderLine),
  pickup_at: z.string(),
  created_at: z.string(),
  ready_at: z.string().nullable(),
  collected_at: z.string().nullable(),
});
const active = new Set(["placed", "accepted", "preparing", "ready"]);

function totals(rows: z.infer<typeof ledgerRow>[]) {
  const values = { demo: 0, counter: 0, duitnow_qr: 0, refund: 0, expense: 0, reversal: 0 };
  for (const entry of rows) values[entry.kind] += entry.amount_sen;
  return {
    ...values,
    netSen: values.demo + values.counter + values.duitnow_qr - values.expense - values.refund + values.reversal,
  };
}

export async function adminReport(client: RequestClient, params: URLSearchParams) {
  const filter = filters.parse({
    days: params.get("days") ?? "7",
    vendorId: params.get("vendorId") ?? undefined,
    zoneId: params.get("zoneId") ?? undefined,
  });
  const since = new Date(dayKey(1 - filter.days) + "T00:00:00+08:00").toISOString();
  const asOf = new Date().toISOString();
  const vendors =
    unwrap(await client.from("vendors").select("id,name,zone_id,capacity,status,paused").order("name")) ?? [];
  const scopedVendors = vendors.filter(
    (v) => (!filter.zoneId || v.zone_id === filter.zoneId) && (!filter.vendorId || v.id === filter.vendorId),
  );
  const vendorIds = scopedVendors.map((v) => v.id);
  let ledgerQuery = client
    .from("cash_entries")
    .select("id,vendor_id,zone_id,order_id,kind,amount_sen,label,reverses_id,created_at", { count: "exact" })
    .gte("created_at", since)
    .lte("created_at", asOf)
    .order("created_at", { ascending: false });
  if (filter.vendorId) ledgerQuery = ledgerQuery.eq("vendor_id", filter.vendorId);
  if (filter.zoneId) ledgerQuery = ledgerQuery.eq("zone_id", filter.zoneId);
  let orderQuery = client
    .from("orders")
    .select("vendor_id,zone_id,payment,status,total_sen,lines,pickup_at,created_at,ready_at,collected_at", {
      count: "exact",
    })
    .or("created_at.gte." + since + ",collected_at.gte." + since)
    .lte("created_at", asOf);
  if (filter.vendorId) orderQuery = orderQuery.eq("vendor_id", filter.vendorId);
  if (filter.zoneId) orderQuery = orderQuery.eq("zone_id", filter.zoneId);
  const [entriesResult, ordersResult, menuResult] = await Promise.all([
    ledgerQuery,
    orderQuery,
    vendorIds.length
      ? client.from("menu_items").select("id,vendor_id,name,stock,active").in("vendor_id", vendorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const entries = z.array(ledgerRow).parse(unwrap(entriesResult));
  const records = z.array(reportOrder).parse(unwrap(ordersResult));
  if ((entriesResult.count ?? 0) > entries.length || (ordersResult.count ?? 0) > records.length) {
    throw new BackendError(400, "REPORT_RANGE_TOO_LARGE", "Choose a shorter period or filter by stall.");
  }
  const cutoff = Date.parse(since);
  const orders = records.filter((order) => Date.parse(order.created_at) >= cutoff);
  const products = new Map<string, { units: number; fulfilledValueSen: number }>();
  for (const order of records) {
    if (order.status !== "collected" || !order.collected_at || Date.parse(order.collected_at) < cutoff) continue;
    for (const line of order.lines) {
      const product = products.get(line.itemId) ?? { units: 0, fulfilledValueSen: 0 };
      product.units += line.quantity;
      product.fulfilledValueSen += line.unit * line.quantity;
      products.set(line.itemId, product);
    }
  }
  const menu = unwrap(menuResult) ?? [];
  const vendorReportIds = new Set([
    ...vendorIds,
    ...entries.map((entry) => entry.vendor_id),
    ...orders.map((order) => order.vendor_id),
  ]);
  return {
    asOf,
    source: "standard_demo",
    since,
    analytics: operationalAnalytics(orders, since, filter.days),
    finance: {
      ...totals(entries),
      orderedValueSen: orders
        .filter((o) => o.status !== "cancelled" && o.status !== "rejected")
        .reduce((sum, o) => sum + o.total_sen, 0),
      outstandingCounterSen: orders
        .filter((o) => o.payment === "counter" && active.has(o.status))
        .reduce((sum, o) => sum + o.total_sen, 0),
      sharedOverheadSen: -totals(entries.filter((e) => !e.vendor_id)).netSen,
    },
    ledger: entries,
    products: menu.map((item) => ({ ...item, ...(products.get(item.id) ?? { units: 0, fulfilledValueSen: 0 }) })),
    vendors: vendors
      .filter((vendor) => vendorReportIds.has(vendor.id))
      .map((vendor) => {
        const stall = orders.filter((o) => o.vendor_id === vendor.id);
        return {
          ...vendor,
          ...totals(entries.filter((e) => e.vendor_id === vendor.id)),
          orderCount: stall.length,
          activeCount: stall.filter((o) => active.has(o.status)).length,
          lateCount: stall.filter((o) => o.ready_at !== null && Date.parse(o.ready_at) > Date.parse(o.pickup_at))
            .length,
        };
      }),
  };
}
