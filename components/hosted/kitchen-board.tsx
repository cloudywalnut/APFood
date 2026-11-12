"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, RefreshCw, Search } from "lucide-react";
import type { OrderRow } from "../../lib/backend/contracts";
import { money } from "../../lib/demo";
import { pickupWindow } from "../../lib/pickup-time";
import { ErrorMessage } from "../shared";
import { messageOf, useHostedData } from "./common";

const stages = [
  { status: "placed", label: "New orders", next: "accepted", action: "Accept order" },
  { status: "accepted", label: "Accepted", next: "preparing", action: "Start preparation" },
  { status: "preparing", label: "In preparation", next: "ready", action: "Mark ready" },
  { status: "ready", label: "Ready to collect", next: "collected", action: "Verify pickup" },
] as const;

export function KitchenBoard({ orders, refresh }: { orders: OrderRow[]; refresh: () => void }) {
  const api = useHostedData();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sort, setSort] = useState("pickup");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const active = orders.filter(order => stages.some(stage => stage.status === order.status) && (order.payment !== "duitnow_qr" || order.payment_record?.status === "paid"));
  const awaitingPayment = orders.filter(order => order.status === "placed" && order.payment_record?.status === "pending").length;
  const overdue = active.filter(order => Date.parse(order.pickup_at) < now).length;
  const dueSoon = active.filter(order => Date.parse(order.pickup_at) >= now && Date.parse(order.pickup_at) <= now + 15 * 60_000).length;
  const matching = active.filter(order => (order.id + " " + order.lines.map(line => line.name).join(" ")).toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "newest" ? Date.parse(b.created_at) - Date.parse(a.created_at) : Date.parse(a.pickup_at) - Date.parse(b.pickup_at) || Date.parse(a.created_at) - Date.parse(b.created_at));
  const visibleStages = stages.filter(stage => stageFilter === "all" || stage.status === stageFilter);
  async function advance(order: OrderRow, next: "accepted" | "preparing" | "ready") {
    if (busy) return;
    setBusy(order.id); setError("");
    try { await api.transition(order.id, next); }
    catch (problem) { setError(messageOf(problem)); }
    finally { refresh(); setBusy(""); }
  }
  return <section className="kitchen-workspace" aria-label="Kitchen operations">
    <div className="kitchen-summary">{[["Active orders", active.length], ["Due within 15 min", dueSoon], ["Past pickup time", overdue], ["Ready for collection", active.filter(order => order.status === "ready").length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="kitchen-toolbar"><label className="kitchen-search"><Search size={18} aria-hidden /><input type="search" aria-label="Search kitchen orders" placeholder="Search order reference or dish" value={query} onChange={event => setQuery(event.target.value)} /></label><label className="kitchen-sort">Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="pickup">Earliest pickup</option><option value="newest">Newest received</option></select></label><button className="button secondary" onClick={refresh}><RefreshCw size={16} aria-hidden />Refresh</button></div>
    <div className="kitchen-status-tabs" role="group" aria-label="Kitchen order status"><button aria-pressed={stageFilter === "all"} onClick={() => setStageFilter("all")}>All stages <span>{active.length}</span></button>{stages.map(stage => <button key={stage.status} aria-pressed={stageFilter === stage.status} onClick={() => setStageFilter(stage.status)}>{stage.label}<span>{active.filter(order => order.status === stage.status).length}</span></button>)}</div>
    <div className="kitchen-board-caption"><span aria-live="polite">{matching.filter(order => stageFilter === "all" || order.status === stageFilter).length} matching orders</span><span>Pickup times in MYT · Order updates sync automatically</span></div>
    {awaitingPayment > 0 && <p className="kitchen-payment-note">{awaitingPayment} awaiting payment. These orders enter the kitchen after payment is recorded.</p>}
    <ErrorMessage message={error} />
    <div className="kitchen-board-scroll" tabIndex={0} role="region" aria-label="Kitchen order lanes"><div className={"kitchen-board-grid" + (stageFilter !== "all" ? " is-filtered" : "")}>{visibleStages.map(stage => {
      const lane = matching.filter(order => order.status === stage.status);
      return <section className="kitchen-board-lane" key={stage.status}><header><h2>{stage.label}</h2><span>{lane.length}</span></header><div className="kitchen-lane-tickets">{lane.length ? lane.map(order => {
        const late = Date.parse(order.pickup_at) < now;
        const soon = !late && Date.parse(order.pickup_at) <= now + 15 * 60_000;
        return <article className={"kitchen-order-card" + (late ? " is-overdue" : "")} key={order.id}>
          <div className="kitchen-order-reference"><Link href={"/vendor/orders/" + order.id}>#{order.id.slice(0, 8).toUpperCase()}</Link>{(late || soon) && <span className={late ? "kitchen-urgency late" : "kitchen-urgency"}>{late ? "Past pickup" : "Due soon"}</span>}</div>
          <p className="kitchen-order-pickup">{pickupWindow(order.pickup_at)}</p><ul>{order.lines.map(line => <li key={line.itemId + String(line.extra)}><b>{line.quantity}×</b><span>{line.name}{line.extra && <small>With a side</small>}</span></li>)}</ul>
          <div className="kitchen-order-meta"><span>{order.payment === "counter" ? "Pay at counter" : "Payment recorded"}</span><strong>{money(order.total_sen)}</strong></div>
          <div className="kitchen-order-actions">{stage.next === "collected" ? <Link className="button primary" href={"/vendor/orders/" + order.id}>Verify pickup<ArrowRight size={15} aria-hidden /></Link> : <button className="button primary" disabled={Boolean(busy)} onClick={() => void advance(order, stage.next)}>{busy === order.id ? "Updating…" : stage.action}<ArrowRight size={15} aria-hidden /></button>}<Link className="kitchen-order-details" href={"/vendor/orders/" + order.id}>View order details</Link></div>
        </article>;
      }) : <div className="kitchen-lane-empty"><ClipboardList size={23} aria-hidden /><strong>{query ? "No matching orders" : "No orders in this stage"}</strong><p>{query ? "Try a different reference or dish." : "Orders will appear here as they progress."}</p></div>}</div></section>;
    })}</div></div>
  </section>;
}
