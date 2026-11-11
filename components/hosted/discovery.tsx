"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CafeteriaMap } from "../cafeteria/map";
import { sampleLayout } from "../../lib/cafeteria/layout";
import type { Selection, SelectionAction } from "../../lib/cafeteria/selection";
import { select } from "../../lib/cafeteria/selection";
import { hostedData } from "../../lib/backend/client";
import { RemoteStatus, useRemote } from "./common";

export function HostedDiscovery({ areaId }: { areaId?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("dish") ?? "");
  const [selection, setSelection] = useState<Selection>({ areaId });
  const load = useCallback(async () => {
    const [vendors, zones] = await Promise.all([hostedData.vendors(), hostedData.zones()]);
    const menus = await Promise.all(vendors.map(stall => hostedData.menu(stall.id)));
    return { vendors, zones, items: menus.flat() };
  }, []);
  const result = useRemote(load);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const { vendors, zones, items } = result.value;
  const needle = query.trim().toLowerCase();
  const matching = vendors.filter(stall => (!areaId || sampleLayout.locations.some(location => location.stallId === stall.id && location.areaId === areaId)) &&
    (!needle || [stall.name, stall.category, ...items.filter(item => item.vendor_id === stall.id).map(item => item.name)].join(" ").toLowerCase().includes(needle)));
  const displayed = matching.map(stall => ({ ...stall, zone: zones.find(zone => zone.id === stall.zone_id)?.name ?? stall.zone_id,
    lead: stall.lead_minutes, hours: stall.opens_at.slice(0, 5) + "–" + stall.closes_at.slice(0, 5) + " MYT" }));
  function dispatch(action: SelectionAction) {
    if (action.type === "stall") router.push("/app/vendors/" + action.id);
    else if (action.type === "area") router.push("/app/vendors/area/" + action.id);
    else setSelection(previous => select(previous, action, sampleLayout));
  }
  return <div className="journey-page"><header className="journey-heading"><div><p className="caf-eyebrow">EXPLORE · CHOOSE · COLLECT</p><h1>Find your next favourite.</h1><p>Choose a counter to open its live menu.</p></div>{areaId && <Link className="button secondary" href="/app/vendors">All areas</Link>}</header>
    <label className="field">Find a stall or meal<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <CafeteriaMap layout={sampleLayout} vendors={displayed} selection={selection} dispatch={dispatch} areaId={areaId} matchingStalls={matching.map(stall => stall.id)} />
    <section className="panel"><h2>Campus counters</h2><div className="caf-stall-options">{matching.map(stall => <Link className="button secondary" href={"/app/vendors/" + stall.id} key={stall.id}>{stall.name} · {stall.paused ? "Intake paused" : "View menu"}</Link>)}</div>{!matching.length && <p>No matching stalls. Clear your search or choose another area.</p>}</section>
  </div>;
}
