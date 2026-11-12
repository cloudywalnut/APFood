"use client";

import { memo, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import { pickupPattern } from "../../lib/pickup-pattern";
import { niceAxisCeiling } from "../../lib/chart-scale";

export const VendorPickupSchedule = memo(function VendorPickupSchedule({ hours }: { hours: { hour: number; count: number }[] }) {
  const [showAll, setShowAll] = useState(false);
  const windows = useMemo(() => pickupPattern(hours), [hours]);
  const total = windows.reduce((sum, window) => sum + window.count, 0);
  const peak = Math.max(...windows.map((window) => window.count));
  const busiest = windows.filter((window) => window.count === peak);
  const scale = niceAxisCeiling(peak, 2, true);
  const visible = showAll ? windows : windows.filter((window) => window.count > 0);
  return (
    <section className="vendor-mini-chart vendor-pickup-schedule" aria-label="Scheduled pickup times">
      <header>
        <div><span className="vendor-section-label">PICKUP SCHEDULE · MYT</span><h2>Scheduled pickup times</h2></div>
        <strong>{total}<small>pickups in period</small></strong>
      </header>
      {total > 0 ? (
        <>
          <div className="pickup-schedule-peak">
            <Clock3 size={17} aria-hidden />
            <div><small>Busiest window{busiest.length > 1 ? "s" : ""}</small><strong>{busiest.map((window) => window.label).join(", ")}</strong></div>
            <span>{peak} pickups{busiest.length > 1 ? " each" : ""}</span>
          </div>
          <div className="pickup-schedule-axis" aria-hidden="true">
            <span>Pickup time</span><div><span>0</span><span>{scale.ticks[1]}</span><span>{scale.ceiling}</span></div><span>Orders</span>
          </div>
          <ol className="pickup-schedule-rows" aria-label="Pickup counts by two-hour Malaysia time window">
            {visible.map((window) => (
              <li key={window.start} data-peak={window.count === peak}>
                <span>{window.label}</span>
                <div className="pickup-schedule-track" aria-hidden="true"><i style={{ transform: `scaleX(${window.count / scale.ceiling})` }} /></div>
                <strong>{window.count}</strong>
              </li>
            ))}
          </ol>
          <div className="pickup-schedule-controls">
            <span>{showAll ? "All 24 hours" : "Windows with pickups"}</span>
            <button type="button" aria-pressed={showAll} onClick={() => setShowAll((value) => !value)}>{showAll ? "Hide empty windows" : "Show all hours"}</button>
          </div>
        </>
      ) : <p className="vendor-chart-placeholder">No scheduled pickups in this period yet.</p>}
      <footer>Two-hour windows · selected reporting period · excludes cancelled and rejected orders.</footer>
    </section>
  );
});
