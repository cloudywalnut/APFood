"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Plus } from "lucide-react";
import { addonPrice, isActive, money } from "../../lib/demo";
import { hostedData } from "../../lib/backend/client";
import { isRejectedCheckout, useHostedCart } from "../../lib/backend/hosted-cart";
import { subscribeToOrders } from "../../lib/backend/realtime";
import { pickupWindow } from "../../lib/pickup-time";
import { Empty, ErrorMessage, Modal, Recommendation, StatusBadge, StudentShell } from "../shared";
import { PickupDialog } from "../student";
import { HostedVisitor, messageOf, RemoteStatus, useHostedData, useRemote } from "./common";
import { HostedTraffic } from "./traffic";
import { OrderPayment } from "./payments";
import { HostedFif } from "./fif";
import { BasketCheckout } from "./basket-checkout";
import { HostedDiscovery } from "./discovery";
import { sampleLayout } from "../../lib/cafeteria/layout";
import { HostedTracking } from "./tracking";
import { RoleHero } from "../apspace/role-hero";

type CartAccess = ReturnType<typeof useHostedCart>;
type MenuItem = Awaited<ReturnType<typeof hostedData.menu>>[number];

export function HostedStudent({ route, section, id, itemId }: { route: string; section: string; id?: string; itemId?: string }) {
  return <HostedVisitor>{session =>
    <StudentContent key={session?.userId ?? "guest"} route={route} section={section} id={id} itemId={itemId}
      userId={session?.profile.status === "active" && session.emailVerified ? session.userId : undefined} />
  }</HostedVisitor>;
}

function StudentContent({ route, section, id, userId, itemId }: { route: string; section: string; id?: string; userId?: string; itemId?: string }) {
  const cart = useHostedCart(userId);
  return <StudentShell route={route} cartCount={cart.cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0}>
    {cart.conflict && <CartImport store={cart} />}
    {cart.error && <div className="notice"><p role="alert">{cart.error}</p><button className="button secondary" onClick={() => void cart.reload()}>Reload saved cart</button></div>}
    {section === "home" && <Catalogue home signedIn={Boolean(userId)} />}
    {section === "area" && <HostedDiscovery areaId={id} />}
    {section === "vendors" && (id ? <Menu key={id} id={id} store={cart} itemId={itemId} /> : <HostedDiscovery />)}
    {section === "cart" && (cart.ready ? <Cart store={cart} /> : <p role="status">Loading your cart…</p>)}
    {section === "checkout" && (userId ? cart.ready ? <BasketCheckout store={cart} /> : <p role="status">Loading your cart…</p> : <SignInToOrder next="/app/checkout" />)}
    {section === "orders" && (userId ? (id ? <OrderDetail key={id} id={id} userId={userId} /> : <Orders userId={userId} />) : <SignInToOrder next={route} />)}
    {section === "traffic" && <HostedTraffic />}
  </StudentShell>;
}

function SignInToOrder({ next }: { next: string }) {
  return <Empty title="Make it yours." detail="Sign in to save your cart, place an order, and track your pickup."
    href={"/auth/login?next=" + encodeURIComponent(next)} action="Sign in to continue" />;
}

function CartImport({ store }: { store: CartAccess }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="panel stack"><h2>You have a saved cart</h2><p>Keep your account's cart or replace it with the items you selected before signing in.</p>
    <div className="line wrap">{[false, true].map(replace => <button key={String(replace)} className={"button " + (replace ? "primary" : "secondary")} disabled={busy}
      onClick={async () => { setBusy(true); try { await store.resolveImport(replace); } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); } }}>
      {replace ? "Replace with this cart" : "Keep saved cart"}</button>)}</div><ErrorMessage message={error} /></section>;
}

const foodImages = new Set(["noodles", "coffee", "bowl", "lunch"]);
function StallPhoto({ image, className = "stall-photo" }: { image: string; className?: string }) {
  return <div className={className}><Image src={"/food/" + (foodImages.has(image) ? image : "lunch") + ".webp"} alt="" fill sizes="(max-width: 650px) 100vw, 33vw" /></div>;
}

async function loadCatalogue() {
  const [vendors, zones] = await Promise.all([hostedData.vendors(), hostedData.zones()]);
  return { vendors, zones };
}

function Catalogue({ home = false, signedIn = false }: { home?: boolean; signedIn?: boolean }) {
  const result = useRemote(loadCatalogue);
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("");
  const vendors = result.value?.vendors.filter(vendor =>
    (!zone || vendor.zone_id === zone) && (vendor.name + " " + vendor.category).toLowerCase().includes(query.trim().toLowerCase()));
  return <>{home && <RoleHero role="student" />}<div className="student-heading"><div><h1>{home ? "Lunch between classes." : "Explore vendors"}</h1><p>Browse campus stalls and schedule a pickup.</p></div>{home && <Link className="button secondary" href="/account">Your account</Link>}</div>
    {!result.value ? <RemoteStatus error={result.error} reload={result.reload} /> : <>
      {home && (signedIn ? <HostedFif role="student" /> : <StudentPickup vendors={result.value.vendors} />)}
      {home && <LiveDeals />}
      <div className="filters"><label className="field grow">Find a stall<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label className="field">Food court<select value={zone} onChange={event => setZone(event.target.value)}><option value="">All zones</option>{result.value.zones.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></div>
      {vendors?.length ? <div className="stall-grid">{vendors.map(vendor => <Link className="stall-card" href={"/app/vendors/" + vendor.id} key={vendor.id}>
        <StallPhoto image={vendor.image} /><div className="stall-content"><h3>{vendor.name}</h3><p><MapPin size={14} aria-hidden /> {result.value?.zones.find(entry => entry.id === vendor.zone_id)?.name}</p><p>{vendor.category}{vendor.paused && " · Intake paused"}</p></div>
      </Link>)}</div> : <Empty title="No matching stalls" detail="Clear a filter to see more vendors." />}
    </>}
  </>;
}

function LiveDeals() {
  const deals = useRemote(hostedData.deals);
  if (!deals.value) return <RemoteStatus error={deals.error} reload={deals.reload} />;
  if (!deals.value.length) return null;
  return <section className="stack"><div className="section-head"><h2>Campus deals</h2><Link href="/app/vendors">Explore all stalls</Link></div><div className="stall-grid">{deals.value.map(item => <Link className="panel stack" key={item.id} href={"/app/vendors/" + item.vendor_id + "/item/" + item.id}><span className="badge deal-badge">Save {money(item.discount_sen)}</span><h3>{item.name}</h3><p>{item.description}</p><div><strong>{money(item.price_sen - item.discount_sen)}</strong> <del>{money(item.price_sen)}</del></div></Link>)}</div></section>;
}

function StudentPickup({ vendors }: { vendors: Awaited<ReturnType<typeof hostedData.vendors>> }) {
  const result = useRemote(hostedData.traffic);
  if (!result.value) return <div className="hosted-pick"><RemoteStatus error={result.error} reload={result.reload} /></div>;
  const accepting = new Map(vendors.filter(stall => stall.status === "approved" && !stall.paused).map(stall => [stall.id, stall]));
  const now = Date.now();
  const candidate = result.value.buckets.filter(bucket => {
    const stall = accepting.get(bucket.vendor_id);
    return stall && Date.parse(bucket.starts_at) >= now + stall.lead_minutes * 60_000 && bucket.reserved_units < bucket.total_units;
  })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.reserved_units / a.total_units - b.reserved_units / b.total_units)[0];
  return <div className="hosted-pick"><Recommendation label="FIF · Suggested pickup"
    title={candidate ? accepting.get(candidate.vendor_id)!.name : "Check upcoming pickup activity"}
    evidence={candidate ? pickupWindow(candidate.starts_at) + " · " + candidate.reserved_units + " of " + candidate.total_units + " work units booked. Checkout confirms availability for your cart." : "There is no open window in the current activity view. Check upcoming windows or try another stall."}
    href={candidate ? "/app/vendors/" + candidate.vendor_id : "/app/traffic"} action={candidate ? "View menu" : "View activity"} /></div>;
}

function Menu({ id, store, itemId }: { id: string; store: CartAccess; itemId?: string }) {
  const load = useCallback(async () => {
    const [vendors, items] = await Promise.all([hostedData.vendors(), hostedData.menu(id)]);
    return { vendor: vendors.find(vendor => vendor.id === id), items };
  }, [id]);
  const result = useRemote(load);
  const [item, setItem] = useState<MenuItem>();
  useEffect(() => { if (itemId && result.value) setItem(result.value.items.find(row => row.id === itemId)); }, [itemId, result.value]);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const { vendor, items } = result.value;
  if (!vendor) return <Empty title="Stall unavailable" detail="Choose another campus stall." href="/app/vendors" action="Explore vendors" />;
  return <>
    <Link className="quiet-link back-link" href="/app/vendors">Back to stalls</Link>
    <div className="menu-hero"><div className="menu-photo"><Image src={sampleLayout.locations.find(location => location.stallId === id)?.photo ?? "/food/" + vendor.image + ".webp"} alt={vendor.name + " storefront"} fill sizes="(max-width: 650px) 100vw, 33vw" /></div><div><h1>{vendor.name}</h1><p>{vendor.description}</p><p>{vendor.opens_at.slice(0, 5)}–{vendor.closes_at.slice(0, 5)} MYT</p></div></div>
    <div className="section-head"><h2>Menu</h2>{vendor.paused && <span className="badge neutral">Intake paused</span>}</div>
    {store.cart?.pending && <p className="notice">Checkout is awaiting confirmation. <Link href="/app/checkout">Resume checkout</Link></p>}
    <div className="menu-list">{items.map(entry => <article className="menu-item" key={entry.id} id={entry.id}><div><h3>{entry.name}</h3><p>{entry.description}</p>
      <div className="menu-price"><strong>{money(entry.price_sen - entry.discount_sen)}</strong>{entry.discount_sen > 0 && <><del>{money(entry.price_sen)}</del><span className="badge deal-badge">Demo deal</span></>}</div>
    </div><button className="button secondary" aria-label={"Add " + entry.name} disabled={vendor.paused || !entry.stock || Boolean(store.cart?.pending)} onClick={() => setItem(entry)}><Plus size={16} aria-hidden />{entry.stock ? "Add" : "Sold out"}</button></article>)}</div>
    {!items.length && <p className="muted">This stall has no published items.</p>}
    {store.cart && <div className="sticky-action"><Link className="button primary" href="/app/cart">View cart <ArrowRight size={17} aria-hidden /></Link></div>}
    {item && <MealOptions item={item} store={store} close={() => setItem(undefined)} added={() => { window.dispatchEvent(new CustomEvent("apfoods-notice", { detail: item.name + " added to cart." })); setItem(undefined); }} />}
  </>;
}

function MealOptions({ item, store, close, added }: { item: MenuItem; store: CartAccess; close: () => void; added: () => void }) {
  const [quantity, setQuantity] = useState(1);
  const [extra, setExtra] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const items = (store.cart?.items ?? []).map(line => ({ ...line, vendorId: line.vendorId ?? store.cart!.vendorId }));
  const maximum = Math.min(20, item.stock - items.filter(line => line.itemId === item.id).reduce((sum, line) => sum + line.quantity, 0));
  return <Modal title={item.name} close={() => { if (!busy) close(); }}><form className="stack" onSubmit={async event => {
    event.preventDefault();
    if (store.cart?.pending || !Number.isInteger(quantity) || quantity < 1 || quantity > maximum) return;
    const exists = items.some(line => line.itemId === item.id && line.extra === extra);
    const next = exists ? items.map(line => line.itemId === item.id && line.extra === extra ? { ...line, quantity: line.quantity + quantity } : line)
      : [...items, { itemId: item.id, vendorId: item.vendor_id, quantity, extra }];
    setBusy(true);
    try { await store.save({ vendorId: store.cart?.vendorId ?? item.vendor_id, items: next }); added(); }
    catch (problem) { setError(messageOf(problem)); }
    finally { setBusy(false); }
  }}>
    <label className="check"><input type="checkbox" checked={extra} onChange={event => setExtra(event.target.checked)} /> Add a side · {money(addonPrice)}</label>
    {maximum > 0 ? <label className="field">Quantity<input required type="number" min="1" max={maximum} value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label> : <p>All available portions are already in your cart.</p>}
    <ErrorMessage message={error} />
    <button className="button primary" disabled={maximum < 1 || busy || !store.ready}>{busy ? "Saving…" : "Add to cart"} · {money((item.price_sen - item.discount_sen + (extra ? addonPrice : 0)) * quantity)}</button>
  </form></Modal>;
}

function Cart({ store }: { store: CartAccess }) {
  const { cart } = store;
  const vendorIds = [...new Set(cart?.items.map(line => line.vendorId ?? cart.vendorId) ?? [])].sort().join(",");
  const load = useCallback(async () => vendorIds ? (await Promise.all(vendorIds.split(",").map(id => hostedData.menu(id)))).flat() : [], [vendorIds]);
  const menu = useRemote(load);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!cart?.items.length) return <Empty title="Your cart is empty" detail="Add a meal from a campus stall." href="/app/vendors" action="Explore vendors" />;
  const total = cart.items.reduce((sum, line) => {
    const item = menu.value?.find(row => row.id === line.itemId);
    return sum + (item ? (item.price_sen - item.discount_sen + (line.extra ? addonPrice : 0)) * line.quantity : 0);
  }, 0);
  const savings = cart.items.reduce((sum, line) => sum + (menu.value?.find(row => row.id === line.itemId)?.discount_sen ?? 0) * line.quantity, 0);
  const unavailable = menu.value && cart.items.some(line => {
    const item = menu.value?.find(row => row.id === line.itemId);
    return !item || cart.items.filter(row => row.itemId === line.itemId).reduce((sum, row) => sum + row.quantity, 0) > item.stock;
  });
  return <section className="panel cart-panel"><h1>Your cart</h1><div className="stack">
    {!menu.value && <RemoteStatus error={menu.error} reload={menu.reload} />}
    {menu.value && cart.items.map((line, index) => {
      const item = menu.value?.find(row => row.id === line.itemId);
      return <div className="cart-row" key={line.itemId + line.extra}><div><h3>{item?.name ?? line.itemId}</h3><p>{item ? money(item.price_sen - item.discount_sen + (line.extra ? addonPrice : 0)) + " each" : "Item unavailable"}{line.extra && " · With a side"}</p></div>
        <div className="stepper">{(["Decrease", "Increase", "Remove"] as const).map(action => <button key={action} className="icon-button" aria-label={action + " " + (item?.name ?? line.itemId)}
          disabled={saving || Boolean(cart.pending) || (action === "Increase" && (!item || line.quantity >= 20 || cart.items.filter(entry => entry.itemId === line.itemId).reduce((sum, entry) => sum + entry.quantity, 0) >= item.stock))}
          onClick={async () => {
            const quantity = action === "Remove" ? 0 : line.quantity + (action === "Increase" ? 1 : -1);
            const items = cart.items.flatMap((entry, i) => index !== i ? [entry] : quantity ? [{ ...entry, quantity }] : []);
            setSaving(true);
            try { await store.save(items.length ? { ...cart, items } : undefined); setError(""); } catch (problem) { setError(messageOf(problem)); }
            finally { setSaving(false); }
          }}>{action === "Increase" ? "+" : action === "Decrease" ? "−" : "Remove"}</button>)}
          <strong aria-label="Quantity">{line.quantity}</strong><strong>{item && money((item.price_sen - item.discount_sen + (line.extra ? addonPrice : 0)) * line.quantity)}</strong></div></div>;
    })}
    {menu.value && <><div className="line spread"><span>Subtotal</span><strong>{money(total + savings)}</strong></div>
      {savings > 0 && <div className="line spread"><span>Meal savings</span><strong>−{money(savings)}</strong></div>}
      <div className="line spread cart-total"><strong>Total</strong><strong>{money(total)}</strong></div></>}
    {unavailable && <p className="error" role="alert">Some items are unavailable or exceed current stock. Update the quantities before checkout.</p>}
    <ErrorMessage message={error} />
    {(cart.pending || (menu.value && !unavailable)) && <Link className="button primary" href="/app/checkout">{cart.pending ? "Resume checkout" : "Choose pickup time"}</Link>}
  </div></section>;
}


function Orders({ userId }: { userId: string }) {
  const api = useHostedData();
  const orders = useRemote(api.orders);
  useEffect(() => subscribeToOrders({ studentId: userId }, orders.reload), [userId, orders.reload]);
  return <><div className="student-heading"><h1>Orders</h1></div>{!orders.value ? <RemoteStatus error={orders.error} reload={orders.reload} /> :
    orders.value.length ? <div className="panel orders-list">{orders.value.map(order => <Link className="order-list-row" href={"/app/orders/" + order.id} key={order.id}><span><strong>{order.vendor_id}</strong><small>{pickupWindow(order.pickup_at)}</small></span><StatusBadge status={order.status} /><strong>{money(order.total_sen)}</strong></Link>)}</div>
    : <Empty title="No orders yet" detail="Your pickups appear after checkout." href="/app/vendors" action="Explore vendors" />}</>;
}

function OrderDetail({ id, userId }: { id: string; userId: string }) {
  const api = useHostedData();
  const load = useCallback(() => api.order(id), [id, api]);
  const result = useRemote(load);
  const [credential, setCredential] = useState<Awaited<ReturnType<typeof hostedData.issuePickup>>>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => subscribeToOrders({ studentId: userId }, result.reload), [userId, result.reload]);
  if (!result.value) return <RemoteStatus error={result.error} reload={result.reload} />;
  const order = result.value;
  const issue = async () => { setCredential(await api.issuePickup(id)); };
  return <><Link className="quiet-link back-link" href="/app/orders">Order history</Link>
    <div className="student-heading"><div><h1>{order.status === "ready" ? "Ready for pickup" : order.status === "collected" ? "Order collected" : "Track your order"}</h1><p>{order.vendor_id} · {pickupWindow(order.pickup_at)}</p></div><StatusBadge status={order.status} /></div>
    {order.payment === "duitnow_qr" && <OrderPayment customer id={id} total={order.total_sen} version={order.version} changed={result.reload} />}
    <HostedTracking order={order} />
    <section className="panel order-summary"><h2>Order summary</h2>{order.lines.map(line => <div className="line spread" key={line.itemId + line.extra}><span>{line.quantity} × {line.name}{line.extra && " + side"}</span><strong>{money(line.quantity * line.unit)}</strong></div>)}
      <div className="line spread cart-total"><strong>Total</strong><strong>{money(order.total_sen)}</strong></div>
      {order.status === "ready" && <button className="button primary" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await issue(); } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
      }}>Show pickup code</button>}
      {isActive(order.status) && ["placed","accepted"].includes(order.status) && <button className="button secondary" disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try { await api.cancel(id); result.reload(); } catch (problem) { setError(messageOf(problem)); } finally { setBusy(false); }
      }}>Cancel order</button>}
      <ErrorMessage message={error} />
    </section>
    {credential && order.status === "ready" && <PickupDialog code={credential.code} expiresAt={Date.parse(credential.expiresAt)} close={() => setCredential(undefined)} regenerate={issue} />}
  </>;
}
