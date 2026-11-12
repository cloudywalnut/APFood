import type { OrderRow } from "./contracts";
import type { apiClient } from "./client";

// Shapes API report data for the admin insight charts; all values come from the API.
export function insightsView(report: Awaited<ReturnType<typeof apiClient.report>>, records: OrderRow[]) {
  return {
    vendors: report.vendors.map(({ id, name }) => ({ id, name })),
    orders: records.map((row) => ({ vendorId: row.vendor_id, status: row.status })),
    entries: report.ledger.map((row) => ({ vendorId: row.vendor_id ?? "", type: row.kind, amount: row.amount_sen })),
  };
}
