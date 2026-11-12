import { createHash } from "node:crypto";
import { adminScope, adminOverviewOutput, adminDetailOutput, type AdminScope } from "../admin-dashboard";
import type { RequestClient } from "./supabase";
import { unwrap } from "./errors";
export function parseAdminScope(params: URLSearchParams) {
  return adminScope.parse({
    days: params.get("days") ?? "7",
    vendorId: params.get("vendorId") || undefined,
    zoneId: params.get("zoneId") || undefined,
  });
}
export async function adminOverview(client: RequestClient, scope: AdminScope) {
  const data = adminOverviewOutput.parse(
    unwrap(
      await client.rpc("admin_overview", {
        p_days: Number(scope.days),
        p_vendor: scope.vendorId ?? null,
        p_zone: scope.zoneId ?? null,
      }),
    ),
  );
  const args = {
    p_since: data.since,
    p_until: data.asOf,
    p_vendor: scope.vendorId ?? null,
    p_zone: scope.zoneId ?? null,
  };
  const [paymentResult, intelligenceResult] = await Promise.all([
    client.rpc("admin_payment_summary", args),
    client.rpc("admin_intelligence_evidence", args),
  ]);
  const payments = adminOverviewOutput.shape.payments.parse(unwrap(paymentResult));
  const intelligence = adminOverviewOutput.shape.intelligence.parse(unwrap(intelligenceResult));
  const report = { ...data, payments, intelligence };
  return { ...report, fingerprint: overviewFingerprint(report) };
}
export async function adminVendorDetail(client: RequestClient, vendorId: string, days: string) {
  return adminDetailOutput.parse(
    unwrap(await client.rpc("admin_vendor_overview", { p_vendor: vendorId, p_days: Number(days) })),
  );
}
export function overviewFingerprint(value: unknown) {
  const data = value as Record<string, unknown>;
  // Snapshot timestamps change on every read; the source evidence determines staleness.
  const { asOf, previousAsOf, fingerprint, ...evidence } = data;
  void asOf;
  void previousAsOf;
  void fingerprint;
  return createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
}
