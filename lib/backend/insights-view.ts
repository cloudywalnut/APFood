import type { OrderRow } from "./contracts";
import type { hostedData } from "./client";

// Presentation adapter for Dalia's read-only charts; all values originate in the API.
export function insightsView(report: Awaited<ReturnType<typeof hostedData.report>>, records: OrderRow[]) {
  return {
    vendors: report.vendors.map(({id,name}) => ({id,name})),
    orders: records.map(row => ({vendorId:row.vendor_id,status:row.status})),
    entries: report.ledger.map(row => ({vendorId:row.vendor_id ?? "",type:row.kind,amount:row.amount_sen})),
  };
}
