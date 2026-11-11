"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { addonPrice, money } from "../../lib/demo";
import { hostedData } from "../../lib/backend/client";
import type { useHostedCart } from "../../lib/backend/hosted-cart";
import { Empty, ErrorMessage } from "../shared";
import { messageOf, RemoteStatus, useRemote } from "../hosted/common";
import { mealPhoto } from "./catalogue";

type CartAccess = ReturnType<typeof useHostedCart>;

export function StorefrontCart({ store, signedIn }: { store: CartAccess; signedIn: boolean }) {
  const catalogue = useRemote(hostedData.catalogue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { cart } = store;
  if (!cart?.items.length) return <Empty title="Your cart is empty" detail="Find something good from a campus stall. Your next meal starts here." href="/app/vendors" action="Explore the stalls" />;
  if (!catalogue.value) return <RemoteStatus error={catalogue.error} reload={catalogue.reload} />;
  const data = catalogue.value;
  const count = cart.items.reduce((sum, line) => sum + line.quantity, 0);
  const vendorIds = [...new Set(cart.items.map(line => line.vendorId ?? cart.vendorId))];
  const unitPrice = (line: typeof cart.items[number]) => {
    const item = data.items.find(item => item.id === line.itemId);
    return item ? item.price_sen - item.discount_sen + (line.extra ? addonPrice : 0) : 0;
  };
  const missing = cart.items.some(line => !data.items.some(item => item.id === line.itemId));
  const unavailable = missing || vendorIds.some(id => !data.vendors.some(stall => stall.id === id && !stall.paused)) || cart.items.some(line => {
    const item = data.items.find(item => item.id === line.itemId);
    return !item || cart.items.filter(row => row.itemId === line.itemId).reduce((sum, row) => sum + row.quantity, 0) > item.stock;
  });
  const total = cart.items.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  const savings = cart.items.reduce((sum, line) => sum + (data.items.find(item => item.id === line.itemId)?.discount_sen ?? 0) * line.quantity, 0);
  async function change(index: number, quantity: number) {
    if (!cart || saving || cart.pending) return;
    const items = cart.items.flatMap((line, i) => i !== index ? [line] : quantity > 0 ? [{ ...line, quantity }] : []);
    setSaving(true); setError("");
    try { await store.save(items.length ? { ...cart, items } : undefined); }
    catch (problem) { setError(messageOf(problem)); }
    finally { setSaving(false); }
  }
  return <div className="food-cart"><header className="food-cart-heading"><div><p className="caf-eyebrow">YOUR NEXT GOOD MEAL</p><h1>Your cart</h1><p>{count} {count === 1 ? "item" : "items"} from {vendorIds.length} {vendorIds.length === 1 ? "stall" : "stalls"}</p></div><Link href="/app/vendors">Keep exploring<ArrowRight size={16} aria-hidden /></Link></header>
    <div className="food-cart-layout"><section className="food-cart-items" aria-label="Cart items" aria-busy={saving}>
      {vendorIds.map(id => <section className="food-cart-stall" key={id}><header><Store size={19} aria-hidden /><h2>{data.vendors.find(stall => stall.id === id)?.name ?? "Unavailable stall"}</h2><Link href={"/app/vendors/" + id}>View menu</Link></header>
        {cart.items.map((line, index) => {
          if ((line.vendorId ?? cart.vendorId) !== id) return null;
          const item = data.items.find(item => item.id === line.itemId);
          const name = item?.name ?? "Unavailable item";
          const photo = item && mealPhoto(item);
          const allocated = cart.items.filter(entry => entry.itemId === line.itemId).reduce((sum, entry) => sum + entry.quantity, 0);
          return <article className="food-cart-item" key={line.itemId + String(line.extra)}>
            <div className="food-cart-photo">{photo ? <Image src={photo} alt="" width={84} height={84} /> : <ShoppingBag size={24} aria-hidden />}</div>
            <div className="food-cart-description"><h3>{name}</h3><p>{line.extra ? "With a side" : "Standard serving"}</p><span>{item ? money(unitPrice(line)) + " each" : "Remove this item to continue"}</span></div>
            <strong className="food-cart-line-total">{item ? money(unitPrice(line) * line.quantity) : "Unavailable"}</strong>
            <div className="food-cart-item-actions"><div className="food-cart-quantity" role="group" aria-label={name + " quantity"}><button type="button" aria-label={"Decrease " + name} disabled={saving || Boolean(cart.pending)} onClick={() => void change(index, line.quantity - 1)}><Minus size={16} aria-hidden /></button><output aria-label={"Quantity of " + name}>{line.quantity}</output><button type="button" aria-label={"Increase " + name} disabled={saving || Boolean(cart.pending) || !item || line.quantity >= 20 || allocated >= item.stock} onClick={() => void change(index, line.quantity + 1)}><Plus size={16} aria-hidden /></button></div><button type="button" className="food-cart-remove" disabled={saving || Boolean(cart.pending)} onClick={() => void change(index, 0)} aria-label={"Remove " + name}><Trash2 size={15} aria-hidden />Remove</button></div>
          </article>;
        })}</section>)}
      {unavailable && <p className="notice" role="alert">Some items are unavailable, exceed current stock, or belong to a paused stall. Update your cart before checkout.</p>}
      <ErrorMessage message={error} />
    </section><aside className="food-cart-summary" aria-label="Order summary"><h2>Order summary</h2><dl><div><dt>Subtotal</dt><dd>{missing ? "—" : money(total + savings)}</dd></div>{savings > 0 && <div className="food-cart-saving"><dt>Meal savings</dt><dd>−{money(savings)}</dd></div>}<div className="food-cart-total"><dt>Total</dt><dd>{missing ? "Review items" : money(total)}</dd></div></dl>
      <p>Campus pickup · No delivery fee.<br />Pickup availability and final prices are confirmed at checkout.</p>
      {saving ? <button className="button primary" disabled>Updating cart…</button> : cart.pending || !unavailable ? <Link className="button primary" href={signedIn ? "/app/checkout" : "/auth/login?next=%2Fapp%2Fcheckout"}>{cart.pending ? "Resume checkout" : signedIn ? "Proceed to checkout" : "Sign in to checkout"}<ArrowRight size={17} aria-hidden /></Link> : <button className="button primary" disabled>Update cart to continue</button>}
      <span className="food-cart-storage-note">{signedIn ? "Your cart is saved to your account." : "Your cart is saved in this browser. Sign in to save it to your account."}</span>
    </aside></div></div>;
}
