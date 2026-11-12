type AnalyticsOrder = { created_at: string; pickup_at: string; status: string };
const day = (value: string | number) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

export function operationalAnalytics(orders: AnalyticsOrder[], since: string, days: number) {
  const daily = Array.from({ length: days }, (_, index) => ({
    day: day(Date.parse(since) + index * 86400_000),
    count: 0,
  }));
  const counts = new Map(daily.map((row) => [row.day, row]));
  const statuses = new Map<string, number>();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const order of orders) {
    const bucket = counts.get(day(order.created_at));
    if (!bucket) continue;
    bucket.count++;
    statuses.set(order.status, (statuses.get(order.status) ?? 0) + 1);
    if (!["cancelled", "rejected"].includes(order.status)) {
      const hour = Number(
        new Date(order.pickup_at).toLocaleTimeString("en-GB", {
          timeZone: "Asia/Kuala_Lumpur",
          hour: "2-digit",
          hour12: false,
        }),
      );
      if (Number.isInteger(hour) && hours[hour]) hours[hour].count++;
    }
  }
  return { daily, statuses: [...statuses].map(([status, count]) => ({ status, count })), hours };
}
