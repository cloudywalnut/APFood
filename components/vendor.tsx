"use client";
import { InfoTip } from "./apspace/info-tip";

import { usePreviewSession } from "../lib/preview-auth";
import { WarmIllustration } from "./apspace/illustration";
import { RoleHero } from "./apspace/role-hero";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Package, Plus, QrCode } from "lucide-react";
import { dayKey, isActive, loadFor, money, slotLabel, stages, type Item, type Order, type Status, type Vendor } from "../lib/demo";
import { itemStock, saveItem, saveVendor, transition, useDemo } from "../lib/demo-store";
import { Empty, ErrorMessage, Modal, OpsShell, Recommendation, replaceFilters, StatusBadge } from "./shared";

export function VendorPage({ route, section, id }: { route: string; section: string; id?: string }) {
  const state = useDemo();
  const session = usePreviewSession();
  const order = state.orders.find(candidate => candidate.id === id);
  const vendor = state.vendors.find(candidate => candidate.id === session?.vendorId) ?? state.vendors[0];
  const title = { home: "Shift dashboard", orders: id ? "Order detail" : "Kitchen board", menu: "Menu & stock", capacity: "Capacity & hours" }[section] ?? "Vendor";
  const orders = state.orders.filter(candidate => candidate.vendorId === vendor.id && candidate.scenario === state.scenario && candidate.day === dayKey());
  return <OpsShell kind="vendor" route={route} title={title}>
    <div className="page-heading"><div><h1>{title}</h1><p>{vendor.name} · {vendor.zone}</p></div></div>
    {section === "home" && <><RoleHero role="vendor"/><Shift vendor={vendor} orders={orders} /></>}
    {section === "orders" && (id ? order && order.vendorId===vendor.id ? <VendorOrder order={order} /> : <Empty title="Order unavailable" detail="Return to the kitchen board." href="/vendor/orders" action="Kitchen board" /> : <Kitchen orders={orders} />)}
    {section === "menu" && <Menu key={vendor.id} vendor={vendor} />}
    {section === "capacity" && <Capacity key={vendor.id} vendor={vendor} />}
  </OpsShell>;
}

function Shift({ vendor, orders }: { vendor: Vendor; orders: Order[] }) {
  const state = useDemo();
  const active = orders.filter(order => isActive(order.status));
  const low = state.items.filter(item => item.vendorId === vendor.id && item.active && itemStock(state, item) <= 5);
  const first = loadFor(state, vendor, 0);
  const stallFilter = "?stall=" + encodeURIComponent(vendor.id);
  const title = first.units >= vendor.capacity ? "First pickup window is full" : low.length ? "Review stock before the next rush" : "Check the next pickup window";
  return <><Recommendation label="Shift priorities" title={title} evidence={first.units + " of " + vendor.capacity + " work units booked for " + slotLabel(0) + ". " + low.length + " menu item" + (low.length === 1 ? "" : "s") + " low on stock."} href={(first.units >= vendor.capacity || !low.length ? "/vendor/orders" : "/vendor/menu") + stallFilter} action={first.units >= vendor.capacity || !low.length ? "Open kitchen" : "Review menu"} />
    <div className="metrics vendor-metrics">{[[active.length, "Active pickups", Clock3], [orders.filter(order => order.status === "ready").length, "Ready to collect", QrCode], [low.length, "Low-stock items", Package]].map(([value, label, Icon]) => {
      const MetricIcon = Icon as typeof Clock3;
      return <section className="metric" key={String(label)}><div><span>{String(label)}{label==="Low-stock items"&&<InfoTip label="Low-stock items" text="Published meals with five portions or fewer."/>}</span><strong>{String(value)}</strong></div><span className="metric-icon"><MetricIcon size={19} aria-hidden /></span></section>;
    })}</div>
    <section className="panel"><div className="line spread"><h2>Upcoming pickups</h2><Link className="quiet-link" href={"/vendor/orders" + stallFilter}>Kitchen board <ArrowRight size={16} aria-hidden /></Link></div>
    {active.length ? <div className="simple-list">{active.map(order => <Link href={"/vendor/orders/" + order.id} key={order.id}><span><strong>{order.id}</strong><small>{slotLabel(order.slot)}</small></span><StatusBadge status={order.status} /></Link>)}</div> : <div className="ops-empty-note"><WarmIllustration name="no_orders"/><p className="muted">You’re all caught up. New orders appear here when students schedule pickup.</p></div>}</section></>;
}

const kitchenStages = ["placed", "accepted", "preparing", "ready"] as const;
const stageTitle = { placed: "New", accepted: "Accepted", preparing: "Preparing", ready: "Ready" };
const nextAction = { placed: "Accept order", accepted: "Start preparing", preparing: "Mark ready", ready: "Verify pickup" };

function Kitchen({ orders }: { orders: Order[] }) {
  const [error, setError] = useState("");
  return <><ErrorMessage message={error} />{!orders.some(o=>isActive(o.status))&&<section className="panel ops-empty-note"><WarmIllustration name="no_orders"/><div><h2>Your kitchen is all caught up.</h2><p>New orders will appear below when students schedule a pickup.</p></div></section>}<div className="kitchen-grid">{kitchenStages.map((stage, index) => {
    const lane = orders.filter(order => order.status === stage).sort((a, b) => a.slot - b.slot);
    return <section className="kitchen-lane" key={stage}><h2>{stageTitle[stage]} <span className="badge neutral">{lane.length}</span></h2>{lane.length ? lane.map(order => <article className="kitchen-ticket" key={order.id}><div className="line spread"><Link href={"/vendor/orders/" + order.id}><strong>{order.id}</strong></Link><small>{slotLabel(order.slot)}</small></div><ul>{order.lines.map(line => <li key={line.itemId + line.extra}>{line.quantity} × {line.name}</li>)}</ul>{stage === "ready" ? <Link className="button primary" href={"/vendor/orders/" + order.id}>{nextAction[stage]}</Link> : <button className="button primary" onClick={() => { try { transition(order.id, stages[index + 1], "Vendor"); setError(""); } catch (problem) { setError((problem as Error).message); } }}>{nextAction[stage]}</button>}</article>) : <p className="muted small">No {stageTitle[stage].toLowerCase()} orders.</p>}</section>;
  })}</div></>;
}

function VendorOrder({ order }: { order: Order }) {
  const [mode, setMode] = useState<"collect" | "cancel" | "reject">();
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const state = useDemo();
  const next = stages[stages.findIndex(stage => stage === order.status) + 1];
  function act(status: Status) {
    try { transition(order.id, status, "Vendor", { code, reason, confirmed }); setMode(undefined); setError(""); }
    catch (problem) { setError((problem as Error).message); }
  }
  return <><Link className="quiet-link back-link" href="/vendor/orders"><ArrowLeft size={16} aria-hidden /> Kitchen board</Link><div className="checkout-layout"><section className="panel order-summary"><div className="line spread"><h2>{order.id}</h2><StatusBadge status={order.status} /></div><p>{slotLabel(order.slot)} · {order.payment === "counter" ? "Pay at counter" : "Online payment"}</p>{order.lines.map(line => <div className="line spread" key={line.itemId + line.extra}><span>{line.quantity} × {line.name}{line.extra && " + side"}</span><strong>{money(line.unit * line.quantity)}</strong></div>)}<div className="line spread cart-total"><strong>Total</strong><strong>{money(order.total)}</strong></div>
    <div className="line wrap">{isActive(order.status) && next && <button className="button primary" onClick={() => { if (next === "collected") { setError(""); setMode("collect"); } else act(next); }}>{nextAction[order.status as keyof typeof nextAction]}</button>}
      {order.status === "placed" && <button className="button secondary" onClick={() => { setError(""); setMode("reject"); }}>Reject order</button>}
      {["accepted", "preparing"].includes(order.status) && <button className="button secondary" onClick={() => { setError(""); setMode("cancel"); }}>Cancel order</button>}</div>{!mode && <ErrorMessage message={error} />}</section>
    <section className="panel"><h2>Recent updates</h2><div className="simple-list">{state.audit.filter(event => event.target === order.id).map(event => <div key={event.id}><span>{event.action}<small>{event.actor}</small></span></div>)}</div>{!state.audit.some(event => event.target === order.id) && <p className="muted">No updates have been recorded for this order.</p>}</section></div>
    {mode && <Modal title={mode === "collect" ? "Verify pickup" : mode === "reject" ? "Reject this order" : "Cancel this order"} close={() => setMode(undefined)}><form className="stack" onSubmit={event => { event.preventDefault(); act(mode === "collect" ? "collected" : mode === "reject" ? "rejected" : "cancelled"); }}>
      {mode === "collect" ? <><label className="field">Pickup code<input value={code} onChange={event => setCode(event.target.value)} required autoComplete="off" /></label>{order.payment === "counter" && <label className="check"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirm counter payment · {money(order.total)}</label>}</> : <label className="field">Reason<textarea maxLength={160} value={reason} onChange={event => setReason(event.target.value)} required /></label>}
      <ErrorMessage message={error} /><button className={"button " + (mode === "collect" ? "primary" : "danger")}>{mode === "collect" ? "Mark collected" : mode === "reject" ? "Reject order" : "Cancel order"}</button></form></Modal>}
  </>;
}

function Menu({ vendor }: { vendor: Vendor }) {
  const state = useDemo();
  const [query, setQuery] = useState("");
  const [item, setItem] = useState<Item>();
  const items = state.items.filter(candidate => candidate.vendorId === vendor.id && candidate.name.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel"><div className="filters"><label className="field grow">Find an item<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><button className="button primary" onClick={() => setItem({ id: crypto.randomUUID(), vendorId: vendor.id, name: "", description: "", price: 0, stock: 0, work: 1, active: true })}><Plus size={17} aria-hidden /> Add item</button></div>
    <div className="table-wrap"><table><thead><tr><th>Item</th><th>Price</th><th>Available stock</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(candidate => <tr key={candidate.id}><th scope="row">{candidate.name}</th><td>{money(candidate.price)}</td><td>{itemStock(state, candidate)}</td><td><span className={"badge " + (candidate.active ? "good" : "neutral")}>{candidate.active ? "Published" : "Hidden"}</span></td><td><button className="button secondary" onClick={() => setItem(candidate)}>Edit</button></td></tr>)}</tbody></table></div>
    {!items.length && <p className="muted">No menu items match your search.</p>}
    {item && <ItemEditor item={item} close={() => setItem(undefined)} />}
  </section>;
}

function ItemEditor({ item, close }: { item: Item; close: () => void }) {
  const [draft, setDraft] = useState(item);
  const [price, setPrice] = useState((item.price / 100).toFixed(2));
  return <Modal title={item.name ? "Edit menu item" : "Add menu item"} close={close}><form className="stack" onSubmit={event => { event.preventDefault(); if (!draft.name.trim()) return; saveItem({ ...draft, name: draft.name.trim(), price: Math.round(Number(price) * 100) }); close(); }}>
    <label className="field">Name<input required maxLength={70} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
    <label className="field">Description<textarea value={draft.description} maxLength={140} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
    <div className="form-grid"><label className="field">Price (RM)<input required type="number" min="0.01" max="1000" step="0.01" value={price} onChange={event => setPrice(event.target.value)} /></label><label className="field">Stock allocation<input required type="number" min="0" max="1000" value={draft.stock} onChange={event => setDraft({ ...draft, stock: Number(event.target.value) })} /></label><label className="field">Prep work units<input required type="number" min="1" max="30" value={draft.work} onChange={event => setDraft({ ...draft, work: Number(event.target.value) })} /></label></div>
    <label className="check"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} /> Publish item</label><button className="button primary">Save item</button>
  </form></Modal>;
}

function Capacity({ vendor }: { vendor: Vendor }) {
  const state = useDemo();
  const [capacity, setCapacity] = useState(vendor.capacity);
  const [lead, setLead] = useState(vendor.lead);
  const [hours, setHours] = useState(vendor.hours);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  return <div className="checkout-layout"><section className="panel"><h2>Pickup settings</h2><form className="stack" onSubmit={event => {
    event.preventDefault();
    if ([0, 1, 2, 3, 4, 5].some(slot => loadFor(state, vendor, slot).units > capacity)) { setError("Capacity cannot be lower than current commitments."); return; }
    saveVendor(vendor.id, { capacity, lead, hours }, "Vendor", "Pickup settings"); setNotice("Pickup settings saved."); setError("");
  }}>
    <label className="field">Hours shown on the menu<input required maxLength={50} value={hours} onChange={event => setHours(event.target.value)} /></label><label className="field"><span>Work units per 15 minutes<InfoTip label="Work units" text="Meal workload per pickup window; larger meals use more units."/></span><input required type="number" min="1" max="50" value={capacity} onChange={event => setCapacity(Number(event.target.value))} /></label><label className="field"><span>Prep lead time (minutes)<InfoTip label="Prep lead time" text="Minimum time needed before a pickup can be booked."/></span><input required type="number" min="1" max="90" value={lead} onChange={event => setLead(Number(event.target.value))} /></label><ErrorMessage message={error} /><button className="button primary">Save pickup settings</button>
    </form>{notice && <p className="success" role="status">{notice}</p>}</section>
    <section className="panel"><h2>Order intake</h2><p className="muted">{vendor.paused ? "New orders are paused. Existing orders stay in your kitchen." : "Students can place new orders in available windows."}</p><button className="button secondary" onClick={() => saveVendor(vendor.id, { paused: !vendor.paused }, "Vendor", vendor.paused ? "Resumed intake" : "Paused intake")}>{vendor.paused ? "Resume intake" : "Pause intake"}</button><p className="small muted">Current first window · {loadFor(state, vendor, 0).units} / {vendor.capacity} units</p></section></div>;
}
