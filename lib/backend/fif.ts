import { createHash } from "node:crypto";
import type { RequestClient } from "./supabase";
import { privilegedClient } from "./auth";
import { unwrap } from "./errors";
import { pickupWindow } from "../pickup-time";
import { rankActions, type Candidate } from "./fif-ranking";

const cache = new Map<string, { expires: number; id: string; source: "rules" | "gemini" }>();

export async function recommendations(client: RequestClient, scope: { role: "student" | "vendor" | "admin"; vendorId?: string; zoneId?: string }, userId: string) {
  const candidates: Candidate[] = [];
  const stalls = unwrap(await client.from("vendors").select("id,name,zone_id,status,paused,lead_minutes,opens_at,closes_at")) ?? [];
  const selected = stalls.filter(stall => (!scope.vendorId || stall.id === scope.vendorId) && (!scope.zoneId || stall.zone_id === scope.zoneId));
  const ids = selected.map(stall => stall.id);
  const add = (entry: Omit<Candidate, "id">) => candidates.push({ ...entry, id: "action-" + candidates.length });
  if (scope.role === "student" || scope.role === "admin") {
    const buckets = unwrap(await client.rpc("pickup_activity")) ?? [];
    const now = Date.now();
    for (const bucket of buckets) {
      const stall = selected.find(stall => stall.id === bucket.vendor_id && stall.status === "approved" && !stall.paused);
      if (!stall || Date.parse(bucket.starts_at) < now + stall.lead_minutes * 60_000 || bucket.total_units <= 0) continue;
      const full = bucket.reserved_units >= bucket.total_units;
      if (scope.role === "student" && full) continue;
      const suffix = scope.role === "student" ? "/app/vendors/" + stall.id : "/admin/traffic?vendorId=" + stall.id;
      add({ title: scope.role === "student" ? stall.name : full ? stall.name + " has a full pickup window" : "Review pickup activity at " + stall.name,
        evidence: pickupWindow(bucket.starts_at) + " · " + bucket.reserved_units + " of " + bucket.total_units + " work units booked." + (scope.role === "student" ? " Checkout confirms availability for your cart." : ""),
        href: suffix, action: scope.role === "student" ? "View menu" : "View traffic", priority: full ? 100 : 10,
        signals: { minutesUntilPickup: Math.round((Date.parse(bucket.starts_at) - now) / 60000), loadPercent: Math.round(bucket.reserved_units * 100 / bucket.total_units) } });
    }
  }
  if (scope.role !== "student" && ids.length) {
    const low = unwrap(await client.from("menu_items").select("id,vendor_id,name,stock").in("vendor_id", ids).eq("active", true).lte("stock", 5)) ?? [];
    for (const item of low) add({ title: "Review stock for " + item.name, evidence: item.stock + " portions remain at " + selected.find(stall => stall.id === item.vendor_id)?.name + ".",
      href: scope.role === "vendor" ? "/vendor/menu?stall=" + item.vendor_id : "/admin/products?vendorId=" + item.vendor_id,
      action: "Review products", priority: item.stock === 0 ? 90 : 50, signals: { portionsRemaining: item.stock } });
  }
  if (scope.role === "vendor" && scope.vendorId) {
    const orders = unwrap(await client.from("orders").select("id,status,pickup_at,payment,payment_record:order_payments(status)").eq("vendor_id", scope.vendorId).in("status", ["placed", "accepted", "preparing", "ready"]).order("pickup_at")) ?? [];
    for (const order of orders) {
      if (order.payment === "duitnow_qr" && (order.payment_record as unknown as { status: string } | null)?.status !== "paid") continue;
      add({ title: order.status === "ready" ? "Prepare for collection" : "Prioritise the next pickup", evidence: "Order " + order.id.slice(0, 8) + " · " + order.status + " · " + pickupWindow(order.pickup_at),
        href: "/vendor/orders/" + order.id, action: "Open order", priority: Date.parse(order.pickup_at) < Date.now() ? 110 : 100,
        signals: { minutesUntilPickup: Math.round((Date.parse(order.pickup_at) - Date.now()) / 60000), ready: Number(order.status === "ready") } });
    }
  }
  if (!candidates.length) add({ title: "Check upcoming activity", evidence: "No urgent action in the current app activity. Physical crowd conditions are unverified.",
    href: scope.role === "vendor" ? "/vendor/orders" : scope.role === "admin" ? "/admin/traffic" : "/app/vendors", action: "View activity", priority: 0, signals: {} });
  candidates.sort((a, b) => b.priority - a.priority || (a.signals.minutesUntilPickup ?? Infinity) - (b.signals.minutesUntilPickup ?? Infinity) || (a.signals.loadPercent ?? 0) - (b.signals.loadPercent ?? 0));
  const cacheKey = createHash("sha256").update(JSON.stringify([userId, scope, candidates])).digest("hex");
  const cached = cache.get(cacheKey);
  const selectedFromCache = cached && cached.expires > Date.now() ? candidates.find(item => item.id === cached.id) : undefined;
  const key = process.env.GEMINI_API_KEY;
  let allowed = false;
  if (!selectedFromCache && key && candidates.length > 1 && candidates[0].priority === candidates[1].priority) {
    const hash = createHash("sha256").update("fif:" + userId).digest("hex");
    const limit = await privilegedClient().rpc("consume_auth_request", { p_key: hash, p_limit: 12, p_seconds: 3600 });
    allowed = !limit.error && limit.data === true;
  }
  const ranked = selectedFromCache ? { recommendation: selectedFromCache, source: cached!.source }
    : await rankActions(candidates.slice(0, 20), { key: allowed ? key : undefined, model: process.env.GEMINI_MODEL });
  if (cache.size >= 200) cache.clear();
  if (!selectedFromCache) cache.set(cacheKey, { id: ranked.recommendation.id, source: ranked.source, expires: Date.now() + 30_000 });
  const { priority: _, signals: __, ...recommendation } = ranked.recommendation;
  return { recommendation, source: ranked.source, generatedAt: new Date().toISOString(), dataSource: "standard_demo" };
}
