"use client";

import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { available, isActive, loadFor, scenarioNames, slotLabel, slotTime, slots } from "../lib/demo";
import { useDemo } from "../lib/demo-store";
import { Empty, ScenarioSelect } from "./shared";

export function Traffic({ admin = false, zone = "", vendorId = "" }: { admin?: boolean; zone?: string; vendorId?: string }) {
  const state = useDemo();
  const vendors = state.vendors.filter(vendor => vendor.status === "approved" && (!zone || vendor.zone === zone) && (!vendorId || vendor.id === vendorId));
  const zones = [...new Set(vendors.map(vendor => vendor.zone))];
  const active = state.orders.filter(order => order.scenario === state.scenario && vendors.some(vendor => vendor.id === order.vendorId));
  const counts = { placed: active.length, collected: active.filter(order => order.status === "collected").length, cancelled: active.filter(order => order.status === "cancelled" || order.status === "rejected").length };
  return <>
    <div className={admin ? "page-heading" : "student-heading"}><div><h1>{admin ? "Traffic & scenarios" : "Food Court Activity"}</h1><p>Compare scheduled pickups and kitchen load by food court.</p></div>{admin && <ScenarioSelect />}</div>
    <div className="traffic-note"><strong>Physical crowd not verified</strong><p>Source · {scenarioNames[state.scenario]} browser fixtures and local demo orders.</p></div>
    {admin && <div className="panel run-summary"><div><small>Orders in this dataset</small><strong>{counts.placed}</strong></div><div><small>Collected</small><strong>{counts.collected}</strong></div><div><small>Cancelled or rejected</small><strong>{counts.cancelled}</strong></div><div><small>Active pickups</small><strong>{active.filter(order => isActive(order.status)).length}</strong></div></div>}
    {zones.length === 0 && <Empty title="No matching food courts" detail="Choose a different stall or zone." />}
    <div className="zone-grid">{zones.map(name => {
      const zoneVendors = vendors.filter(vendor => vendor.zone === name);
      const serving = zoneVendors.filter(vendor => !vendor.paused);
      const capacity = serving.reduce((sum, vendor) => sum + vendor.capacity, 0);
      const buckets = slots.map(slot => ({ slot, units: zoneVendors.reduce((sum, vendor) => sum + loadFor(state, vendor, slot).units, 0), count: zoneVendors.reduce((sum, vendor) => sum + loadFor(state, vendor, slot).count, 0) }));
      const peak = capacity ? Math.max(...buckets.map(bucket => bucket.units / capacity)) : 0;
      const next = buckets.find(bucket => serving.some(vendor => available(state, vendor, bucket.slot)));
      return <section className="panel zone-card" key={name}>
        <div className="line spread"><h2><MapPin size={18} aria-hidden /> {name}</h2><span className={"badge " + (peak >= .75 ? "warning" : "neutral")}>{!capacity || !buckets.some(bucket => bucket.count) ? "Limited data" : peak >= .75 ? "High load" : peak >= .4 ? "Moderate load" : "Low load"}</span></div>
        <p className="muted">{serving.length} accepting stall{serving.length === 1 ? "" : "s"} · {capacity} work units per window</p>
        <div className="bucket-chart">{buckets.map(bucket => <div key={bucket.slot}><span className="bucket-number">{bucket.count}</span><div className="bucket-track" aria-hidden><span style={{ height: Math.min(100, capacity ? bucket.units / capacity * 100 : 0) + "%" }} /></div><small>{slotTime(bucket.slot)}</small><span className="sr-only"> PM, {bucket.count} scheduled pickups</span></div>)}</div>
        <p className="small muted">Scheduled pickups by window · Malaysia time</p>
        <div className="zone-foot"><strong>{next ? "Next available · " + slotLabel(next.slot) : "No available pickup windows"}</strong>{!admin && <Link className="quiet-link" href="/app/vendors">Browse vendors <ArrowRight size={15} aria-hidden /></Link>}</div>
      </section>;
    })}</div>
    {admin && <p className="muted small">The frontend uses preset browser scenarios. Attempt and conflict counts require the order generator in the backend phase.</p>}
  </>;
}
