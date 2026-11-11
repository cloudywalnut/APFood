"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TrafficMap } from "../storefront/traffic-map";
import { hostedData } from "../../lib/backend/client";
import { pickupWindow } from "../../lib/pickup-time";
import { Empty, replaceFilters } from "../shared";
import { RemoteStatus, useRemote } from "./common";

async function loadTraffic() {
  const [traffic, stalls, zones] = await Promise.all([hostedData.traffic(), hostedData.vendors(), hostedData.zones()]);
  return { ...traffic, stalls, zones };
}

export function HostedTraffic({ admin = false }: { admin?: boolean }) {
  const params = useSearchParams();
  const zoneId = params.get("zoneId") ?? "";
  const vendorId = params.get("vendorId") ?? "";
  const result = useRemote(loadTraffic);
  const [asOf, setAsOf] = useState(() => Date.now());
  useEffect(() => { if (result.value) setAsOf(Date.now()); }, [result.value]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") result.reload(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [result.reload]);
  const data = result.value;
  const stalls = data?.stalls.filter(stall => !zoneId || stall.zone_id === zoneId) ?? [];
  const names = new Map(stalls.map(stall => [stall.id, stall.name]));
  const buckets = data?.buckets.filter(row => names.has(row.vendor_id) && (!vendorId || row.vendor_id === vendorId));

  return <div className="stack">
    <div className={admin ? "page-heading" : "student-heading"}><div><h1>{admin ? "Pickup traffic" : "Current Traffic"}</h1><p>App pickup load over the next 30 minutes · Physical queues are not measured</p><p className="small muted">Demo orders and simulated traffic included{data && " · Updated " + new Date(asOf).toLocaleTimeString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour: "numeric", minute: "2-digit" }) + " MYT"}</p></div>
      {data && <button className="button secondary" onClick={result.reload}>Refresh activity</button>}</div>
    {!data ? <RemoteStatus error={result.error} reload={result.reload} /> : <>
      <div className="filters ops-filters">
        <label className="field compact">Food court<select value={zoneId} onChange={event => replaceFilters({ zoneId: event.target.value, vendorId: "" })}><option value="">All zones</option>{data.zones.map(zone => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
        <label className="field compact">Stall<select value={vendorId} onChange={event => replaceFilters({ vendorId: event.target.value })}><option value="">All stalls</option>{stalls.map(stall => <option key={stall.id} value={stall.id}>{stall.name}</option>)}</select></label>
      </div>
      <TrafficMap stalls={stalls} buckets={data.buckets} now={asOf} vendorId={vendorId} showWindows={admin} showDetails={admin} onSelect={id => replaceFilters({ vendorId: id })} />
      {admin && (buckets?.length ? <details className="panel traffic-windows"><summary>Scheduled pickup windows ({buckets.length})</summary><div className="table-wrap"><table><thead><tr><th>Stall</th><th>Window</th><th>Pickups</th><th>Committed capacity</th></tr></thead><tbody>{buckets.map(row =>
        <tr key={row.vendor_id + row.starts_at}><th scope="row">{names.get(row.vendor_id)}</th><td>{pickupWindow(row.starts_at)}</td><td>{row.pickup_count}</td><td>{row.reserved_units} / {row.total_units}{row.reserved_units >= row.total_units && <> <span className="badge warning">Full</span></>}</td></tr>,
      )}</tbody></table></div></details> : <Empty title="No pickup windows match" detail="Try another food court or stall." />)}
    </>}
  </div>;
}
