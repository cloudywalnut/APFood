export type TrafficBucket = { vendor_id: string; starts_at: string; pickup_count: number; reserved_units: number; total_units: number };
export type TrafficLoad = { level: "low" | "moderate" | "busy" | "unknown"; label: string; pickups: number; peakPercent?: number };

// Work units account for meal complexity. Use the busiest overlapping 15-minute
// bucket so a quiet adjacent window cannot conceal a short, heavy rush.
export function trafficLoad(buckets: TrafficBucket[], vendorId: string, now: number, horizonMinutes = 30): TrafficLoad {
  const horizon = now + horizonMinutes * 60_000;
  const relevant = buckets.filter(bucket => {
    const start = Date.parse(bucket.starts_at);
    return bucket.vendor_id === vendorId && Number.isFinite(start) && start < horizon && start + 15 * 60_000 > now;
  });
  const pickups = relevant.reduce((sum, bucket) => sum + Math.max(0, bucket.pickup_count), 0);
  const usable = relevant.filter(bucket => bucket.total_units > 0 || bucket.reserved_units > 0);
  if (!usable.length) return { level: "unknown", label: "No capacity data", pickups };
  const peakPercent = Math.ceil(Math.max(...usable.map(bucket => bucket.total_units > 0 ? Math.max(0, bucket.reserved_units) / bucket.total_units * 100 : 100)));
  const level = peakPercent >= 80 ? "busy" : peakPercent >= 50 ? "moderate" : "low";
  return { level, label: level === "busy" ? "Busy" : level === "moderate" ? "Moderate" : "Low load", pickups, peakPercent };
}
