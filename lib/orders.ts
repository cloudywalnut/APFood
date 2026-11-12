// Order, date and money helpers shared by the UI.

export type Status = "placed" | "accepted" | "preparing" | "ready" | "collected" | "cancelled" | "rejected";
export type LedgerKind = "demo" | "counter" | "expense" | "reversal" | "duitnow_qr" | "refund";

export const statusNames: Record<Status, string> = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  collected: "Collected",
  cancelled: "Cancelled",
  rejected: "Rejected",
};
export const stages = ["placed", "accepted", "preparing", "ready", "collected"] as const;
export const isActive = (status: Status) => ["placed", "accepted", "preparing", "ready"].includes(status);

/** Price of the optional add-on, in sen. */
export const addonPrice = 200;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Malaysia calendar day as YYYY-MM-DD, offset by whole days. */
export function dayKey(offset = 0, now = Date.now()) {
  return dateFormatter.format(new Date(now + offset * 86_400_000));
}

export function dayLabel(day: string) {
  return new Intl.DateTimeFormat("en-MY", { month: "short", day: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(
    new Date(day + "T12:00:00+08:00"),
  );
}

export function money(sen: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(sen / 100);
}

export function totals(entries: { type: LedgerKind; amount: number }[]) {
  const amount = (type: LedgerKind) =>
    entries.filter((entry) => entry.type === type).reduce((sum, entry) => sum + entry.amount, 0);
  const demo = amount("demo");
  const counter = amount("counter");
  const expense = amount("expense");
  const reversal = amount("reversal");
  const duitnow = amount("duitnow_qr");
  const refund = amount("refund");
  return {
    demo,
    counter,
    expense: expense + refund,
    reversal,
    inflow: demo + counter + duitnow,
    net: demo + counter + duitnow - expense - refund + reversal,
  };
}

export type FinanceEntry = { day: string; amount: number; type: LedgerKind };

/** Daily totals for the last `days` days (at most 14). */
export function financeSeries(entries: FinanceEntry[], days: number, asOf = Date.now()) {
  return Array.from({ length: Math.min(days, 14) }, (_, index) => {
    const day = dayKey(index + 1 - Math.min(days, 14), asOf);
    return { day, ...totals(entries.filter((entry) => entry.day === day)) };
  });
}
