"use client";

import Link from "next/link";
import { addonPrice, money } from "../../lib/demo";
import { hostedData } from "../../lib/backend/client";
import type { useHostedCart } from "../../lib/backend/hosted-cart";
import { RemoteStatus, useRemote } from "../hosted/common";

export function CheckoutBasketPreview({ cart }: { cart: NonNullable<ReturnType<typeof useHostedCart>["cart"]> }) {
  const catalogue = useRemote(hostedData.catalogue);
  if (!catalogue.value) return <RemoteStatus error={catalogue.error} reload={catalogue.reload} />;
  const data = catalogue.value;
  const lines = cart.items.map(line => ({ ...line, item: data.items.find(item => item.id === line.itemId) }));
  const missing = lines.some(line => !line.item);
  const price = (line: typeof lines[number]) => line.item ? (line.item.price_sen - line.item.discount_sen + (line.extra ? addonPrice : 0)) * line.quantity : 0;
  return <div className="checkout-basket-preview"><div className="checkout-preview-lines">{lines.map(line => <div key={line.itemId + String(line.extra)}><span><strong>{line.quantity} × {line.item?.name ?? "Unavailable item"}</strong><small>{data.vendors.find(stall => stall.id === (line.vendorId ?? cart.vendorId))?.name}{line.extra && " · With a side"}</small></span><b>{line.item ? money(price(line)) : "—"}</b></div>)}</div><div className="line spread cart-total"><strong>Estimated total</strong><strong>{missing ? "Review cart" : money(lines.reduce((sum, line) => sum + price(line), 0))}</strong></div><p className="small muted">Find pickup times to confirm prices and availability before placing your order.</p><Link className="quiet-link" href="/app/cart">Edit your cart</Link></div>;
}
