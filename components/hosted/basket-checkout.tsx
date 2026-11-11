"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hostedData } from "../../lib/backend/client";
import { isRejectedCheckout, useHostedCart } from "../../lib/backend/hosted-cart";
import { money } from "../../lib/demo";
import { pickupWindow } from "../../lib/pickup-time";
import { ErrorMessage } from "../shared";
import { messageOf, useHostedData } from "./common";

type Store = ReturnType<typeof useHostedCart>;
type Quote = Awaited<ReturnType<typeof hostedData.quote>> & { vendorId: string; name: string; payment: "counter" | "duitnow_qr" };

export function BasketCheckout({ store }: { store: Store }) {
  const api = useHostedData();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [revision, setRevision] = useState<number>();
  const [slot, setSlot] = useState("");
  const [preferQr, setPreferQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const cart = store.cart;
  if (!cart?.items.length) return <section className="panel"><h1>Your cart is empty</h1><Link href="/app/vendors">Explore stalls</Link></section>;
  const slots = quotes[0]?.slots.filter(value => quotes.every(quote => quote.slots.some(other => Date.parse(other) === Date.parse(value)))) ?? [];
  const expired = quotes.some(quote => Date.parse(quote.expiresAt) <= now);
  const changed = revision !== undefined && revision !== store.revision;
  async function run(action: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try { await action(); } catch (problem) { setError(messageOf(problem)); }
    finally { working.current = false; setBusy(false); }
  }
  async function getQuotes() {
    if (!cart) return;
    setQuotes([]);
    const vendors = await api.vendors();
    const ids = [...new Set(cart.items.map(line => line.vendorId ?? cart.vendorId))];
    const next = await Promise.all(ids.map(async vendorId => {
      const details = preferQr ? await api.vendorPayment(vendorId) : null;
      const payment = details ? "duitnow_qr" as const : "counter" as const;
      const items = cart.items.filter(line => (line.vendorId ?? cart.vendorId) === vendorId).map(({ itemId, quantity, extra }) => ({ itemId, quantity, extra }));
      return { ...await api.quote({ vendorId, items, payment }), vendorId, payment, name: vendors.find(row => row.id === vendorId)?.name ?? vendorId };
    }));
    setRevision(store.revision); setQuotes(next);
    setSlot(next[0].slots.find(value => next.every(quote => quote.slots.includes(value))) ?? "");
  }
  async function place() {
    if (!cart) return;
    const attempt = cart.pending ?? (revision !== undefined ? { orders: quotes.map(quote => ({ vendorId: quote.vendorId, quoteId: quote.quoteId, pickupAt: slot, payment: quote.payment, idempotencyKey: crypto.randomUUID() })), idempotencyKey: crypto.randomUUID(), cartRevision: revision } : undefined);
    if (!attempt) return;
    if (!cart.pending) store.persistAttempt(attempt);
    try {
      const result = "orders" in attempt ? await api.placeBasket(attempt) : { orders: [await api.place(attempt)] };
      store.clearAttempt();
      router.replace(result.orders.length === 1 ? "/app/orders/" + result.orders[0].id : "/app/orders");
    } catch (problem) {
      if (isRejectedCheckout(problem)) { store.clearAttempt(); setQuotes([]); }
      throw problem;
    }
  }
  return <div className="stack"><Link className="quiet-link back-link" href="/app/cart">Back to cart</Link><div className="student-heading"><div><h1>Schedule pickup</h1><p>One shared pickup time. Each stall receives its own order and payment reference.</p></div></div>
    {cart.pending ? <section className="panel stack"><h2>Recover your checkout</h2><p>Retry the saved request to confirm the original orders safely.</p><button className="button primary" disabled={busy} onClick={() => void run(place)}>Retry the same checkout</button></section>
    : <div className="checkout-layout"><section className="panel stack"><h2>Payment preference</h2><fieldset className="choice-list"><legend className="sr-only">Payment method</legend><label><input type="radio" checked={!preferQr} onChange={() => { setPreferQr(false); setQuotes([]); }} />Pay at counter</label><label><input type="radio" checked={preferQr} onChange={() => { setPreferQr(true); setQuotes([]); }} />DuitNow QR</label></fieldset><p className="small muted">Stalls without a merchant QR use pay at counter.</p><h2>Pickup window</h2><button className="button secondary" disabled={busy || Boolean(store.conflict)} onClick={() => void run(getQuotes)}>{busy ? "Checking…" : quotes.length ? "Refresh quote" : "Find pickup times"}</button>
      {quotes.length > 0 && <fieldset className="slot-grid"><legend className="sr-only">Shared pickup time</legend>{slots.map(value => <label key={value} className="slot-option"><input type="radio" name="pickup" checked={slot === value} onChange={() => setSlot(value)} />{pickupWindow(value)}</label>)}</fieldset>}
      {quotes.length > 0 && !slots.length && <p className="error">No shared pickup window fits all stalls. Update your cart or try again later.</p>}
    </section><section className="panel stack"><h2>Order summary</h2>{quotes.map(quote => <div key={quote.vendorId}><h3>{quote.name}</h3>{quote.lines.map(line => <p className="line spread" key={line.itemId + line.extra}><span>{line.quantity} × {line.name}{line.extra && " + side"}</span><strong>{money(line.unit * line.quantity)}</strong></p>)}<p className="small muted">{quote.payment === "duitnow_qr" ? "DuitNow QR · Confirm payment after placing" : "Pay at counter"}</p></div>)}
      {quotes.length > 0 && <><div className="line spread cart-total"><strong>Total</strong><strong>{money(quotes.reduce((sum, quote) => sum + quote.totalSen, 0))}</strong></div>{(expired || changed) && <p className="error">{changed ? "Your cart changed." : "Your quote expired."} Refresh the quote before continuing.</p>}<button className="button primary" disabled={busy || !slot || expired || changed || Boolean(store.conflict)} onClick={() => void run(place)}>{busy ? "Placing…" : quotes.some(quote => quote.payment === "duitnow_qr") ? "Continue to payment" : "Place order"}</button></>}
    </section></div>}
    <ErrorMessage message={error} />
  </div>;
}
