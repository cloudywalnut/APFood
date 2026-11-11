"use client";

import { HostedFif } from "./fif";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { money } from "../../lib/demo";
import { hostedData } from "../../lib/backend/client";
import type { OrderRow } from "../../lib/backend/contracts";
import { subscribeToOrders } from "../../lib/backend/realtime";
import { pickupWindow } from "../../lib/pickup-time";
import { Empty, ErrorMessage, Modal, OpsShell, StatusBadge, replaceFilters } from "../shared";
import { HostedAccess, RemoteStatus, SignOut, messageOf, useHostedData, useRemote, type Session } from "./common";
import { OrderPayment, VendorPaymentSettings } from "./payments";

type Stall = Awaited<ReturnType<typeof hostedData.assignedStalls>>[number];
type MenuItem = Awaited<ReturnType<typeof hostedData.vendorMenu>>[number];
const stages = [
  { status: "placed", label: "New", next: "accepted", action: "Accept order" },
  { status: "accepted", label: "Accepted", next: "preparing", action: "Start preparing" },
  { status: "preparing", label: "Preparing", next: "ready", action: "Mark ready" },
  { status: "ready", label: "Ready", next: "collected", action: "Verify pickup" },
] as const;

export function HostedVendor({ route, section, id }: { route: string; section: string; id?: string }) {
  return <HostedAccess role="vendor">{session =>
    <OpsShell hosted kind="vendor" route={route} title="Vendor workspace">
      <VendorContent session={session} section={section} id={id} />
    </OpsShell>
  }</HostedAccess>;
}

function VendorContent({ session, section, id }: { session: Session; section: string; id?: string }) {
  const selection = useSearchParams().get("stall");
  const api = useHostedData();
  const stalls = useRemote(api.assignedStalls);
  if (id) return <VendorOrder key={id} id={id} session={session} />;
  if (!stalls.value) return <RemoteStatus error={stalls.error} reload={stalls.reload} />;
  const stall = stalls.value.find(entry => entry.id === selection) ?? stalls.value[0];
  if (!stall) return <Empty title="No assigned stalls" detail="Ask an administrator to check your vendor membership." />;
  const titles: Record<string, string> = { home: "Shift dashboard", orders: "Kitchen board", menu: "Menu & stock", capacity: "Capacity & hours", payments: "Payment settings" };
  return <>
    <div className="page-heading"><div><h1>{titles[section]}</h1><p>{stall.name}</p></div><div className="line wrap">
      <label className="field compact">Stall<select value={stall.id} onChange={event => replaceFilters({ stall: event.target.value })}>
        {stalls.value.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select></label><SignOut />
    </div></div>
    {(section === "home" || section === "orders") && <Kitchen key={stall.id} stall={stall} summary={section === "home"} />}
    {section === "menu" && <VendorMenu key={stall.id} stall={stall} />}
    {section === "capacity" && <Settings key={stall.id} stall={stall} reload={stalls.reload} />}
    {section === "payments" && <VendorPaymentSettings key={stall.id} vendorId={stall.id} />}
  </>;
}

function Kitchen({ stall, summary }: { stall: Stall; summary: boolean }) {
  const api = useHostedData();
  const load = useCallback(() => api.kitchen(stall.id), [stall.id, api]);
  const orders = useRemote(load);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => subscribeToOrders({ vendorId: stall.id }, orders.reload), [stall.id, orders.reload]);
  if (!orders.value) return <RemoteStatus error={orders.error} reload={orders.reload} />;
  const active = orders.value.filter(order => stages.some(stage => stage.status === order.status) &&
    (order.payment !== "duitnow_qr" || order.payment_record?.status === "paid"));
  const awaitingPayment = orders.value.filter(order => order.status === "placed" && order.payment_record?.status === "pending").length;
  if (summary) return <ShiftSummary stall={stall} active={active} />;
  return <>{awaitingPayment > 0 && <p className="notice">{awaitingPayment} orders are awaiting payment and will enter the kitchen once paid.</p>}<ErrorMessage message={error} /><div className="kitchen-grid">{stages.map(stage => {
    const lane = active.filter(order => order.status === stage.status).sort((a, b) => Date.parse(a.pickup_at) - Date.parse(b.pickup_at));
    const next = stage.next;
    return <section className="kitchen-lane" key={stage.status}><h2>{stage.label} <span className="badge neutral">{lane.length}</span></h2>
      {lane.length ? lane.map(order => <article className="kitchen-ticket" key={order.id}>
        <div className="line spread"><Link href={"/vendor/orders/" + order.id}><strong>{order.id.slice(0, 8)}</strong></Link><small>{pickupWindow(order.pickup_at)}</small></div>
        <ul>{order.lines.map(line => <li key={line.itemId + line.extra}>{line.quantity} × {line.name}</li>)}</ul>
        {next === "collected" ? <Link className="button primary" href={"/vendor/orders/" + order.id}>{stage.action}</Link>
          : <button className="button primary" disabled={Boolean(busy)} onClick={async () => {
            setBusy(order.id); setError("");
            try { await api.transition(order.id, next); } catch (problem) { setError(messageOf(problem)); }
            finally { orders.reload(); setBusy(""); }
          }}>{busy === order.id ? "Updating…" : stage.action}</button>}
      </article>) : <p className="muted small">No {stage.label.toLowerCase()} orders.</p>}
    </section>;
  })}</div></>;
}

function ShiftSummary({ stall, active }: { stall: Stall; active: OrderRow[] }) {
  const api = useHostedData();
  const load = useCallback(() => api.vendorMenu(stall.id), [api, stall.id]);
  const menu = useRemote(load);
  const low = menu.value?.filter(item => item.active && item.stock <= 5).length;
  const placed = active.filter(order => order.status === "placed");
  const ready = active.filter(order => order.status === "ready").length;
  return <div className="stack">
    <HostedFif role="vendor" vendorId={stall.id} />
    <div className="metrics">{[
      ["Active orders", active.length], ["Awaiting acceptance", placed.length], ["Ready for pickup", ready],
      ["Low-stock items", low ?? "—"],
    ].map(([label, value]) => <section className="metric" key={label}><div><span>{label}</span><strong>{value}</strong></div></section>)}</div>
    {menu.error != null && <RemoteStatus error={menu.error} reload={menu.reload} />}
  </div>;
}

function VendorOrder({ id, session }: { id: string; session: Session }) {
  const api = useHostedData();
  const load = useCallback(() => api.order(id), [id, api]);
  const result = useRemote(load);
  const order = result.value;
  const stall = order && session.memberships.find(entry => entry.role === "vendor" && entry.vendor_id === order.vendor_id)?.vendor_id;
  useEffect(() => { if (stall) return subscribeToOrders({ vendorId: stall }, result.reload); }, [stall, result.reload]);
  if (!order) return <RemoteStatus error={result.error} reload={result.reload} />;
  if (!stall) return <Empty title="Order unavailable" detail="Choose an order from your assigned stall." href="/vendor/orders" action="Kitchen board" />;
  return <VendorOrderActions order={order} reload={result.reload} />;
}

function VendorOrderActions({ order, reload }: { order: OrderRow; reload: () => void }) {
  const api = useHostedData();
  const [mode, setMode] = useState<"collect" | "cancel" | "reject">();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stage = stages.find(entry => entry.status === order.status);
  const next = stage?.next;
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); setMode(undefined); }
    catch (problem) { setError(messageOf(problem)); }
    finally { reload(); setBusy(false); }
  }
  function open(value: NonNullable<typeof mode>) { setError(""); setMode(value); }
  const title = mode === "collect" ? "Verify pickup" : mode === "reject" ? "Reject order" : "Cancel order";
  return <>
    <Link className="quiet-link back-link" href={"/vendor/orders?stall=" + encodeURIComponent(order.vendor_id)}>Back to kitchen</Link>
    <div className="page-heading"><div><h1>Order {order.id.slice(0, 8)}</h1><p>{pickupWindow(order.pickup_at)}</p></div><StatusBadge status={order.status} /></div>
    {order.payment === "duitnow_qr" && <OrderPayment id={order.id} total={order.total_sen} version={order.version} changed={reload} />}
    <section className="panel order-summary"><h2>Order details</h2>
      {order.lines.map(line => <div className="line spread" key={line.itemId + line.extra}><span>{line.quantity} × {line.name}{line.extra && " + side"}</span><strong>{money(line.quantity * line.unit)}</strong></div>)}
      <div className="line spread cart-total"><strong>{order.payment === "counter" ? "Pay at counter" : order.payment === "duitnow_qr" ? "DuitNow QR" : "Payment"}</strong><strong>{money(order.total_sen)}</strong></div>
      <div className="line wrap">
        {next && <button className="button primary" disabled={busy || (order.payment === "duitnow_qr" && order.payment_record?.status !== "paid")} onClick={() => next === "collected" ? open("collect") : void act(() => api.transition(order.id, next))}>{stage.action}</button>}
        {order.status === "placed" && <button className="button secondary" disabled={busy} onClick={() => open("reject")}>Reject order</button>}
        {["accepted","preparing"].includes(order.status) && <button className="button secondary" disabled={busy} onClick={() => open("cancel")}>Cancel order</button>}
      </div>{!mode && <ErrorMessage message={error} />}
    </section>
    {mode && <Modal title={title} close={() => { if (!busy) setMode(undefined); }}>
      <form className="stack" onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const reason = String(data.get("reason") ?? "");
        void act(() => mode === "collect" ? api.collect(order.id, String(data.get("code")), data.get("counter") === "on")
          : mode === "reject" ? api.transition(order.id, "rejected", reason) : api.cancel(order.id, reason));
      }}>
        {mode === "collect" ? <>
          <label className="field">Pickup code<input name="code" required autoComplete="off" /></label>
          {order.payment === "counter" && <label className="check"><input name="counter" type="checkbox" required /> Confirm counter payment · {money(order.total_sen)}</label>}
        </> : <label className="field">Reason<textarea name="reason" required maxLength={250} /></label>}
        <ErrorMessage message={error} /><button className="button primary" disabled={busy}>{busy ? "Updating…" : mode === "collect" ? "Mark collected" : title}</button>
      </form>
    </Modal>}
  </>;
}

function VendorMenu({ stall }: { stall: Stall }) {
  const api = useHostedData();
  const load = useCallback(() => api.vendorMenu(stall.id), [stall.id, api]);
  const result = useRemote(load);
  const [edit, setEdit] = useState<MenuItem | null>();
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  return <section className="panel"><div className="line spread"><h2>Menu items</h2><button className="button primary" onClick={() => setEdit(null)}>Add item</button></div>
    <div className="table-wrap"><table><thead><tr><th>Item</th><th>Regular price</th><th>Stock</th><th>Visibility</th><th>Action</th></tr></thead><tbody>
      {result.value.map(item => <tr key={item.id}><th scope="row">{item.name}</th><td>{money(item.price_sen)}</td><td>{item.stock}</td><td>{item.active ? "Published" : "Hidden"}</td><td><button className="button secondary" onClick={() => setEdit(item)}>Edit</button></td></tr>)}
    </tbody></table></div>
    {edit !== undefined && <EditItem item={edit} stall={stall} close={() => setEdit(undefined)} saved={() => { setEdit(undefined); result.reload(); }} />}
  </section>;
}

function EditItem({ item, stall, close, saved }: { item: MenuItem | null; stall: Stall; close: () => void; saved: () => void }) {
  const api = useHostedData();
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <Modal title={item ? "Edit menu item" : "Add menu item"} close={() => { if (!busy) close(); }}>
    <form className="stack" onSubmit={async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      setBusy(true); setError("");
      try {
        await api.saveMenu({ id, vendorId: stall.id, name: String(data.get("name")), description: String(data.get("description")),
          priceSen: Math.round(Number(data.get("price")) * 100), stock: Number(data.get("stock")), expectedStock: item?.stock ?? null,
          active: data.get("active") === "on", workUnits: Number(data.get("units")) });
        saved();
      } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
    }}>
      <label className="field">Name<input name="name" required maxLength={70} defaultValue={item?.name} /></label>
      <label className="field">Description<textarea name="description" maxLength={140} defaultValue={item?.description} /></label>
      <label className="field">Regular price (RM)<input name="price" type="number" min=".01" max="1000" step=".01" required defaultValue={item ? item.price_sen / 100 : undefined} /></label>
      <label className="field">Stock<input name="stock" type="number" min="0" max="1000000" required defaultValue={item?.stock ?? 0} /></label>
      <label className="field">Prep work units<input name="units" type="number" min="1" max="300" required defaultValue={item?.work_units ?? 1} /></label>
      <label className="check"><input name="active" type="checkbox" defaultChecked={item?.active ?? true} /> Publish item</label>
      <ErrorMessage message={error} /><button className="button primary" disabled={busy}>Save item</button>
    </form>
  </Modal>;
}

function Settings({ stall, reload }: { stall: Stall; reload: () => void }) {
  const api = useHostedData();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  return <section className="panel"><h2>Pickup settings</h2><form className="stack" onSubmit={async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      await api.settings(stall.id, { capacity: Number(data.get("capacity")), leadMinutes: Number(data.get("lead")),
        opensAt: String(data.get("opens")), closesAt: String(data.get("closes")), paused: data.get("paused") === "on" });
      reload(); setNotice("Pickup settings saved.");
    } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
  }}>
    <label className="field">Opens (MYT)<input name="opens" required pattern="[0-9]{2}:[0-9]{2}" defaultValue={stall.opens_at.slice(0, 5)} /></label>
    <label className="field">Closes (MYT)<input name="closes" required pattern="[0-9]{2}:[0-9]{2}" defaultValue={stall.closes_at.slice(0, 5)} /></label>
    <label className="field">Work units per 15 minutes<input name="capacity" type="number" min="1" max="300" required defaultValue={stall.capacity} /></label>
    <label className="field">Prep lead time (minutes)<input name="lead" type="number" min="1" max="120" required defaultValue={stall.lead_minutes} /></label>
    <label className="check"><input name="paused" type="checkbox" defaultChecked={stall.paused} /> Pause intake</label>
    <ErrorMessage message={error} />{notice && <p className="success" role="status">{notice}</p>}
    <button className="button primary" disabled={busy}>Save pickup settings</button>
  </form></section>;
}
