"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { sampleLayout } from "../../lib/cafeteria/layout";
import { select, type Selection } from "../../lib/cafeteria/selection";
import { trafficLoad, type TrafficBucket } from "../../lib/traffic-load";
import { CafeteriaMap } from "../cafeteria/map";
import type { Stall } from "./catalogue";

export function TrafficMap({ stalls, buckets, now, vendorId, showWindows = false, showDetails = false, onSelect }: { stalls: Stall[]; buckets: TrafficBucket[]; now: number; vendorId: string; showWindows?: boolean; showDetails?: boolean; onSelect: (id: string) => void }) {
  const [selection, setSelection] = useState<Selection>({});
  const loads = Object.fromEntries(stalls.map(stall => [stall.id, trafficLoad(buckets, stall.id, now)]));
  const chosen = stalls.find(stall => stall.id === vendorId);
  return <section className="current-traffic-map">
    <p className="caf-map-scroll-hint">Swipe the map sideways to see every counter.</p>
    <CafeteriaMap layout={sampleLayout} vendors={stalls.map(stall => ({ ...stall, zone: stall.zone_id, lead: stall.lead_minutes, hours: stall.opens_at.slice(0, 5) + "–" + stall.closes_at.slice(0, 5) + " MYT" }))} matchingStalls={stalls.map(stall => stall.id)} traffic={loads} selection={{ ...selection, stallId: vendorId || undefined }} dispatch={action => { if (action.type === "stall") onSelect(action.id); else setSelection(previous => select(previous, action, sampleLayout)); }} />
    <div className="traffic-colour-key" aria-label="Pickup load legend">{[["low", "Low · below 50%"], ["moderate", "Moderate · 50–79%"], ["busy", "Busy · 80%+"], ["unknown", "No capacity data"]].map(([level, label]) => <span key={level}><i className={"traffic-dot load-" + level} />{label}</span>)}</div>
    {chosen && <div className="traffic-selected"><span>{showWindows ? "Showing windows for " : "Selected stall: "}<strong>{chosen.name}</strong>.</span><Link href={"/app/vendors/" + chosen.id}>View menu<ArrowRight size={16} aria-hidden /></Link><button type="button" onClick={() => onSelect("")}>Show all stalls</button></div>}
    {showDetails && <>
      <div className="traffic-stall-list" aria-label="Stall pickup loads">{stalls.map(stall => { const load = loads[stall.id]; return <button type="button" key={stall.id} className={"traffic-stall-load load-" + load.level} aria-pressed={vendorId === stall.id} onClick={() => onSelect(vendorId === stall.id ? "" : stall.id)}><span className="traffic-stall-title"><i className={"traffic-dot load-" + load.level} /><strong>{stall.name}</strong><b>{load.label}</b></span><span>{load.peakPercent === undefined ? "No capacity windows in the next 30 minutes" : load.pickups + " booked pickups · " + load.peakPercent + "% peak capacity"}{stall.paused && " · Intake paused"}</span></button>; })}</div>
      <details className="traffic-method"><summary>How is traffic estimated?</summary><p>We compare booked meal work units with each kitchen’s capacity in overlapping 15-minute pickup windows over the next 30 minutes. The busiest window sets the colour, so a short rush stays visible. More complex meals consume more capacity than simple items. Counts show booked pickups in those windows, rather than a headcount or a wait-time guarantee. Grey means capacity data is unavailable. Refreshes every 30 seconds while this tab is visible. Demonstration orders and simulated traffic affect these figures.</p></details>
    </>}
  </section>;
}
