"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Copy, MapPin, Minus, Plus, QrCode, Search, ShoppingBag, Timer, Trash2 } from "lucide-react";
import { addonPrice, available, cartDetails, dayKey, isActive, loadFor, money, slotLabel, slots, stages, statusNames, type Item, type Payment, type Vendor } from "../lib/demo";
import { addToCart, changeQuantity, issueCode, itemStock, placeOrder, transition, useDemo } from "../lib/demo-store";
import { itemSavings, offerPrice } from "../lib/promotions";
import { Promotions } from "./promotions";
import { Empty, ErrorMessage, Modal, Recommendation, StatusBadge, StudentShell } from "./shared";
import { Traffic } from "./traffic";

type State = ReturnType<typeof useDemo>;

export function StudentPage({ route, section, id }: { route: string; section: string; id?: string }) {
  return <StudentShell route={route}>
    {section === "home" && <Home />}
    {section === "vendors" && (id ? <Menu id={id} /> : <Explore />)}
    {section === "cart" && <Cart />}
    {section === "checkout" && <Checkout />}
    {section === "orders" && (id ? <OrderDetail id={id} /> : <Orders />)}
    {section === "traffic" && <Traffic />}
  </StudentShell>;
}

function Photo({ vendor, className = "stall-photo" }: { vendor: Vendor; className?: string }) {
  return <div className={className}><Image src={"/food/" + vendor.image + ".webp"} fill sizes="(max-width: 600px) 100vw, (max-width: 950px) 50vw, 33vw" alt={vendor.category + " from " + vendor.name} /></div>;
}

function VendorCard({ vendor, state }: { vendor: Vendor; state: State }) {
  const first = slots.find(slot => available(state, vendor, slot));
  const menu = state.items.filter(item => item.vendorId === vendor.id && item.active);
  const price = menu.length ? Math.min(...menu.map(offerPrice)) : null;
  return <Link href={"/app/vendors/" + vendor.id} className="stall-card">
    <Photo vendor={vendor} />
    <div className="stall-content"><div className="line spread"><h3>{vendor.name}</h3><ChevronRight size={18} aria-hidden /></div>
      <p><MapPin size={14} aria-hidden /> {vendor.zone}</p>
      <div className="stall-foot"><span>{price === null ? "Menu unavailable" : "From " + money(price)}</span><span className={"badge " + (first === undefined ? "neutral" : "good")}>{first === undefined ? "Unavailable" : slotLabel(first).split("–")[0] + " PM pickup"}</span></div>
    </div>
  </Link>;
}

function Home() {
  const state = useDemo();
  const [preference, setPreference] = useState("Soonest");
  const vendors = state.vendors.filter(vendor => vendor.status === "approved");
  const options = vendors.flatMap(vendor => slots.filter(slot => available(state, vendor, slot)).map(slot => ({ vendor, slot, load: loadFor(state, vendor, slot).units / vendor.capacity })));
  options.sort((a, b) => preference === "Soonest" ? a.slot - b.slot : a.load - b.load || a.slot - b.slot || b.vendor.capacity - a.vendor.capacity);
  const recommendation = options[0];
  const active = state.orders.find(order => order.scenario === state.scenario && order.id.startsWith("AP-D") && isActive(order.status));
  return <>
    <div className="student-heading"><div><h1>Lunch between classes.</h1><p>Find a campus stall and pick up at a time that works for you.</p></div><Link className="button secondary" href="/app/vendors"><Search size={17} aria-hidden /> Browse menus</Link></div>
    <div className="home-feature"><div className="home-photo"><Image src="/food/lunch.webp" fill sizes="(max-width: 680px) 100vw, 52vw" alt="Chicken rice and noodles on a sunlit table" preload /></div>
      <div className="home-pick"><div className="line spread"><span className="section-label">Best pickup option</span><span className="badge neutral">Demo recommendation</span></div>
        <div className="segmented" aria-label="Pickup preference">{["Soonest", "Lower load"].map(value => <button aria-pressed={value === preference} key={value} onClick={() => setPreference(value)}>{value}</button>)}</div>
        {recommendation ? <><h2>{recommendation.vendor.name}</h2><p><Clock3 size={16} aria-hidden /> {slotLabel(recommendation.slot)} <span aria-hidden>·</span> {Math.round(recommendation.load * 100)}% kitchen load</p><Link href={"/app/vendors/" + recommendation.vendor.id} className="button primary">View menu <ArrowRight size={17} aria-hidden /></Link></> : <><h2>Pickup is full</h2><p>Check another stall or wait for a later window.</p><Link href="/app/traffic" className="button secondary">View food court activity</Link></>}
      </div>
    </div>
    {active && <Link className="active-order" href={"/app/orders/" + active.id}><div><strong>Track your order</strong><small>{active.id} · {slotLabel(active.slot)}</small></div><StatusBadge status={active.status} /><ChevronRight size={19} aria-hidden /></Link>}
    <Promotions />
    <div className="section-head"><h2>Campus stalls</h2><Link className="quiet-link" href="/app/vendors">View all <ArrowRight size={16} aria-hidden /></Link></div>
    <div className="stall-grid">{vendors.map(vendor => <VendorCard key={vendor.id} vendor={vendor} state={state} />)}</div>
  </>;
}

function Explore() {
  const state = useDemo();
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("");
  const [open, setOpen] = useState(false);
  const zones = [...new Set(state.vendors.map(vendor => vendor.zone))];
  const vendors = state.vendors.filter(vendor => vendor.status === "approved" && (!zone || vendor.zone === zone) && (!open || slots.some(slot => available(state, vendor, slot))) && [vendor.name, vendor.category, ...state.items.filter(item => item.vendorId === vendor.id && item.active).map(item => item.name)].some(value => value.toLowerCase().includes(query.toLowerCase().trim())));
  return <><div className="student-heading"><div><h1>Explore vendors</h1><p>Find your next meal by stall, dish, or food court.</p></div></div>
    <div className="filters"><label className="field grow">Search stalls or dishes<input type="search" placeholder="Try chicken noodles" value={query} onChange={event => setQuery(event.target.value)} /></label><label className="field">Food court<select value={zone} onChange={event => setZone(event.target.value)}><option value="">All zones</option>{zones.map(value => <option key={value}>{value}</option>)}</select></label><label className="check"><input type="checkbox" checked={open} onChange={event => setOpen(event.target.checked)} /> Pickup available</label></div>
    {vendors.length ? <div className="stall-grid">{vendors.map(vendor => <VendorCard key={vendor.id} vendor={vendor} state={state} />)}</div> : <Empty title="No matching stalls" detail="Clear a filter or try a different dish." />}
  </>;
}

function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="quiet-link back-link" href={href}><ArrowLeft size={16} aria-hidden /> {children}</Link>;
}

function Menu({ id }: { id: string }) {
  const state = useDemo();
  const [item, setItem] = useState<Item>();
  const [added, setAdded] = useState("");
  const vendor = state.vendors.find(candidate => candidate.id === id);
  if (!vendor || vendor.status === "suspended") return <Empty title="This stall is unavailable" detail="Pick another campus stall." href="/app/vendors" action="Explore vendors" />;
  const menu = state.items.filter(candidate => candidate.vendorId === id && candidate.active);
  return <><Back href="/app/vendors">Explore vendors</Back><div className="menu-hero"><Photo vendor={vendor} className="menu-photo" /><div><h1>{vendor.name}</h1><p>{vendor.description}</p><div className="line wrap"><span className="badge neutral">{vendor.zone}</span><span className="line muted"><Clock3 size={16} aria-hidden /> {vendor.hours}</span></div></div></div>
    <div className="section-head"><h2>Menu</h2><span className={"badge " + (vendor.paused ? "neutral" : "good")}>{vendor.paused ? "Intake paused" : "Accepting pickup orders"}</span></div>
    {menu.length === 0 && <Empty title="The menu is being updated" detail="Try another stall while this menu is unavailable." />}
    <div className="menu-list">{menu.map(candidate => <article className="menu-item" key={candidate.id} id={candidate.id}><div><h3>{candidate.name}</h3><p>{candidate.description}</p><div className="menu-price">
      <strong>{money(offerPrice(candidate))}</strong>
      {itemSavings(candidate) > 0 && <><del><span className="sr-only">Regular price </span>{money(candidate.price)}</del><span className="badge deal-badge">Demo deal</span></>}
    </div></div><button aria-label={"Add " + candidate.name} className="button secondary" disabled={vendor.paused || itemStock(state, candidate) < 1} onClick={() => { setItem(candidate); setAdded(""); }}>{itemStock(state, candidate) < 1 ? "Sold out" : <><Plus size={16} aria-hidden /> Add</>}</button></article>)}</div>
    {added && <p className="success" role="status">{added} added to cart.</p>}
    {state.cart.length > 0 && <div className="sticky-action"><Link className="button primary" href="/app/cart"><ShoppingBag size={17} aria-hidden /> View cart <ArrowRight size={17} aria-hidden /></Link></div>}
    {item && <MealEditor item={item} close={() => setItem(undefined)} added={() => { setAdded(item.name); setItem(undefined); }} />}
  </>;
}

function MealEditor({ item, close, added }: { item: Item; close: () => void; added: () => void }) {
  const state = useDemo();
  const [quantity, setQuantity] = useState(1);
  const [extra, setExtra] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const cartVendor = cartDetails(state)[0]?.item.vendorId;
  const stock = itemStock(state, item);
  return <Modal title={confirm ? "Replace your cart?" : item.name} close={close}>
    {confirm ? <p>Start a new cart for this stall. The items from your current stall will be removed.</p> : <><p>{item.description}</p><label className="check"><input type="checkbox" checked={extra} onChange={event => setExtra(event.target.checked)} /> Add a side · {money(addonPrice)}</label><label className="field">Quantity<input type="number" min="1" max={stock} value={quantity} onChange={event => setQuantity(Number(event.target.value))} /></label></>}
    <ErrorMessage message={error} />
    <div className="line dialog-actions"><button className="button secondary" onClick={confirm ? () => setConfirm(false) : close}>{confirm ? "Keep current cart" : "Cancel"}</button><button className="button primary" disabled={!Number.isInteger(quantity) || quantity < 1 || quantity > stock} onClick={() => {
      if (cartVendor && cartVendor !== item.vendorId && !confirm) { setConfirm(true); return; }
      try { addToCart({ itemId: item.id, quantity, extra }, confirm); added(); } catch (problem) { setError((problem as Error).message); }
    }}>{confirm ? "Replace cart" : "Add · " + money(quantity * (offerPrice(item) + (extra ? addonPrice : 0)))}</button></div>
  </Modal>;
}

function Cart() {
  const state = useDemo();
  const lines = cartDetails(state);
  const vendor = state.vendors.find(candidate => candidate.id === lines[0]?.item.vendorId);
  if (!vendor) return <Empty title="Your cart is empty" detail="Pick something from a campus stall to get started." href="/app/vendors" action="Explore vendors" />;
  return <><Back href={"/app/vendors/" + vendor.id}>Back to menu</Back><div className="student-heading"><div><h1>Your cart</h1><p>{vendor.name}</p></div></div><div className="panel cart-panel">
    {lines.map((line, index) => <div className="cart-row" key={line.itemId + line.extra}><div><h3>{line.item.name}</h3><p>{line.extra ? "With a side" : "Regular"} · {money(line.unit)} each</p></div><div className="stepper"><button className="icon-button" aria-label={"Decrease " + line.item.name} onClick={() => changeQuantity(index, line.quantity - 1)}><Minus size={16} aria-hidden /></button><strong>{line.quantity}</strong><button className="icon-button" aria-label={"Increase " + line.item.name} disabled={lines.filter(candidate => candidate.itemId === line.itemId).reduce((count, candidate) => count + candidate.quantity, 0) >= itemStock(state, line.item)} onClick={() => changeQuantity(index, line.quantity + 1)}><Plus size={16} aria-hidden /></button><button className="icon-button" aria-label={"Remove " + line.item.name} onClick={() => changeQuantity(index, 0)}><Trash2 size={16} aria-hidden /></button></div></div>)}
    <div className="line spread cart-total"><strong>Subtotal</strong><strong>{money(lines.reduce((sum, line) => sum + line.unit * line.quantity, 0))}</strong></div></div><div className="sticky-action"><Link href="/app/checkout" className="button primary">Choose pickup time <ArrowRight size={17} aria-hidden /></Link></div></>;
}

function Checkout() {
  const state = useDemo();
  const router = useRouter();
  const [selected, setSelected] = useState<number>();
  const [payment, setPayment] = useState<Payment>("demo");
  const [error, setError] = useState("");
  const lines = cartDetails(state);
  const vendor = state.vendors.find(candidate => candidate.id === lines[0]?.item.vendorId);
  if (!vendor) return <Empty title="Your cart is empty" detail="Add an item before choosing a pickup time." href="/app/vendors" action="Explore vendors" />;
  const units = lines.reduce((sum, line) => sum + line.quantity * line.item.work, 0);
  const first = slots.find(slot => available(state, vendor, slot, units));
  const selection = selected ?? first;
  const canPlace = selection !== undefined && available(state, vendor, selection, units);
  const total = lines.reduce((sum, line) => sum + line.unit * line.quantity, 0);
  return <><Back href="/app/cart">Back to cart</Back><div className="student-heading"><div><h1>Schedule pickup</h1><p>{vendor.name} · {vendor.zone}</p></div></div><form className="checkout-layout" onSubmit={event => {
    event.preventDefault();
    if (selection === undefined) return;
    try { const id = placeOrder(selection, payment); router.push("/app/orders/" + id); } catch (problem) { setError((problem as Error).message); }
  }}><div className="stack"><section className="panel"><h2>Pickup window</h2><p className="muted">Choose a 15-minute window in Malaysia time.</p>
    {first === undefined ? <p className="error">No pickup windows fit this cart. Try a smaller order or another stall.</p> : <fieldset className="slot-grid"><legend className="sr-only">Pickup window</legend>{slots.map(slot => {
      const allowed = available(state, vendor, slot, units);
      return <label className="slot-option" key={slot}><input type="radio" name="pickup" disabled={!allowed} checked={slot === selection && allowed} onChange={() => { setSelected(slot); setError(""); }} /><span><strong>{slotLabel(slot)}</strong><small>{!allowed ? "Unavailable" : slot === first ? "Best pickup option" : "Available"}</small></span></label>;
    })}</fieldset>}
    {first !== undefined && <p className="small muted"><span className="badge neutral">Demo recommendation</span> {slotLabel(first)} is the earliest window that fits your order.</p>}</section>
    <section className="panel"><h2>Payment</h2><fieldset className="choice-list"><legend className="sr-only">Payment method</legend><label><input type="radio" name="payment" checked={payment === "demo"} onChange={() => setPayment("demo")} /><span><strong>Demo payment</strong><small>No money charged</small></span></label><label><input type="radio" name="payment" checked={payment === "counter"} onChange={() => setPayment("counter")} /><span><strong>Pay at counter</strong><small>The vendor confirms payment during demo collection</small></span></label></fieldset></section></div>
    <section className="panel order-summary"><h2>Order summary</h2>{lines.map(line => <div className="line spread" key={line.itemId + line.extra}><span>{line.quantity} × {line.item.name}</span><strong>{money(line.unit * line.quantity)}</strong></div>)}<div className="line spread cart-total"><strong>Total</strong><strong>{money(total)}</strong></div><ErrorMessage message={error || (selected !== undefined && !canPlace ? "This pickup window is unavailable. Choose another." : "")} /><button className="button primary" disabled={!canPlace}>Place demo order <ArrowRight size={17} aria-hidden /></button></section></form></>;
}

function Orders() {
  const state = useDemo();
  const orders = state.orders.filter(order => order.scenario === state.scenario).sort((a, b) => Number(isActive(b.status)) - Number(isActive(a.status)));
  return <><div className="student-heading"><div><h1>Orders</h1><p>Track active pickups and find previous demo orders.</p></div></div>{orders.length ? <div className="orders-list panel">{orders.map(order => <Link href={"/app/orders/" + order.id} className="order-list-row" key={order.id}><span><strong>{state.vendors.find(vendor => vendor.id === order.vendorId)?.name}</strong><small>{order.id} · {order.day === dayKey() ? "Today" : order.day} · {slotLabel(order.slot)}</small></span><StatusBadge status={order.status} /><strong>{money(order.total)}</strong><ChevronRight size={16} aria-hidden /></Link>)}</div> : <Empty title="No orders here yet" detail="Your pickups appear after you place an order." href="/app/vendors" action="Explore vendors" />}</>;
}

export function PickupDialog({ code, expiresAt, close, regenerate }: { code: string; expiresAt?: number; close: () => void; regenerate: () => void | Promise<void> }) {
  const [image, setImage] = useState<{ code: string; src: string }>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    import("qrcode").then(module => module.toDataURL(code, { margin: 2, width: 216 })).then(src => { if (current) setImage({ code, src }); }).catch(() => { if (current) setMessage("The QR could not load. Use the text code."); });
    return () => { current = false; };
  }, [code]);
  return <Modal title="Pickup code" close={close}>
    <p>Show this code to the stall when you collect your order. The code is valid for five minutes.</p>
    {image?.code === code && <Image className="pickup-qr" src={image.src} width={216} height={216} unoptimized alt="Scannable pickup QR" />}
    <div className="pickup-code">{code}</div><p className="small muted">{expiresAt ? "Expires " + new Date(expiresAt).toLocaleTimeString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour: "numeric", minute: "2-digit" }) : ""}</p>
    <div className="line wrap"><button className="button secondary" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setMessage("Code copied."); } catch { setMessage("Select and copy the text code above."); }
    }}><Copy size={16} aria-hidden /> Copy code</button><button className="button secondary" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await regenerate(); setMessage("New code generated."); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Could not generate a new code."); }
      finally { setBusy(false); }
    }}>Generate new code</button></div>
    <p className="small" role="status">{message}</p>
  </Modal>;
}

function OrderDetail({ id }: { id: string }) {
  const state = useDemo();
  const [dialog, setDialog] = useState<"code" | "cancel">();
  const [error, setError] = useState("");
  const order = state.orders.find(candidate => candidate.id === id);
  if (!order) return <Empty title="Order unavailable" detail="Open your order history to find another order." href="/app/orders" action="Order history" />;
  const active = stages.findIndex(status => order.status === status);
  const vendor = state.vendors.find(candidate => candidate.id === order.vendorId);
  return <><Back href="/app/orders">Order history</Back><div className="student-heading"><div><h1>{order.status === "ready" ? "Ready for pickup" : order.status === "collected" ? "Order collected" : "Track your order"}</h1><p>{order.id} · {vendor?.name}</p></div><StatusBadge status={order.status} /></div>
    <div className="checkout-layout"><section className="panel"><div className="line"><Timer size={19} aria-hidden /><strong>Scheduled pickup · {slotLabel(order.slot)}</strong></div><p className="muted">{order.day === dayKey() ? "Today" : order.day} · {vendor?.zone}</p>
      {active >= 0 && <ol className="timeline">{stages.map((stage, index) => <li className={index <= active ? "done" : ""} key={stage} aria-current={index === active ? "step" : undefined}><span>{index <= active ? <Check size={15} aria-hidden /> : index + 1}</span>{statusNames[stage]}</li>)}</ol>}
      <div className="line wrap">{order.status === "ready" && <button className="button primary" onClick={() => { issueCode(id); setDialog("code"); }}><QrCode size={18} aria-hidden /> Show pickup code</button>}{["placed", "accepted"].includes(order.status) && <button className="button secondary" onClick={() => { setError(""); setDialog("cancel"); }}>Cancel order</button>}</div>
      <p className="small muted">Demo status syncs with other tabs in this browser.</p>
    </section><section className="panel order-summary"><h2>Order summary</h2>{order.lines.map(line => <div className="line spread" key={line.itemId + line.extra}><span>{line.quantity} × {line.name}{line.extra && " + side"}</span><strong>{money(line.unit * line.quantity)}</strong></div>)}<div className="line spread cart-total"><strong>Total</strong><strong>{money(order.total)}</strong></div><p className="small muted">{order.payment === "demo" ? "Demo payment — no money charged" : "Pay at counter · Demo"}</p></section></div>
    {dialog === "code" && order.status === "ready" && <PickupDialog code={order.code} expiresAt={order.codeExpiresAt} close={() => setDialog(undefined)} regenerate={() => issueCode(id, true)} />}
    {dialog === "cancel" && <Modal title="Cancel this order?" close={() => setDialog(undefined)}><p>The vendor will see the cancellation in the kitchen board.</p><ErrorMessage message={error} /><div className="line dialog-actions"><button className="button secondary" onClick={() => setDialog(undefined)}>Keep order</button><button className="button danger" onClick={() => { try { transition(id, "cancelled", "Student"); setDialog(undefined); } catch (problem) { setError((problem as Error).message); } }}>Cancel order</button></div></Modal>}
  </>;
}
