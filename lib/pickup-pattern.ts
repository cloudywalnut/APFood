const hourLabel = (hour: number) => `${hour % 12 || 12}${hour < 12 || hour === 24 ? "am" : "pm"}`;

export function pickupPattern(hours: { hour: number; count: number }[]) {
  const counts = new Map<number, number>();
  for (const row of hours) {
    if (!Number.isInteger(row.hour) || row.hour < 0 || row.hour > 23 || !Number.isInteger(row.count) || row.count < 0) continue;
    counts.set(row.hour, (counts.get(row.hour) ?? 0) + row.count);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const start = index * 2;
    return { start, label: `${hourLabel(start)}–${hourLabel(start + 2)}`, count: (counts.get(start) ?? 0) + (counts.get(start + 1) ?? 0) };
  });
}
