import { dayKey, totals, type DemoState, type Entry } from "./demo";

export function scopeData(state: DemoState, days: number, zone: string, vendorId: string) {
  const start = dayKey(1 - days);
  const vendors = state.vendors.filter(vendor => (!zone || vendor.zone === zone) && (!vendorId || vendor.id === vendorId));
  const ids = new Set(vendors.map(vendor => vendor.id));
  const orders = state.orders.filter(order => order.scenario === state.scenario && order.day >= start && ids.has(order.vendorId));
  const entries = state.entries.filter(entry => entry.scenario === state.scenario && entry.day >= start && (entry.vendorId ? ids.has(entry.vendorId) : !vendorId && !zone));
  return { vendors, orders, entries, finance: totals(entries) };
}

export type FinanceEntry = Pick<Entry, "day" | "amount"> & { type: Entry["type"] | "duitnow_qr" | "refund" };

export function financeSeries(entries: FinanceEntry[], days: number, asOf = Date.now()) {
  return Array.from({ length: Math.min(days, 14) }, (_, index) => {
    const day = dayKey(index + 1 - Math.min(days, 14), asOf);
    return { day, ...totals(entries.filter(entry => entry.day === day)) };
  });
}
