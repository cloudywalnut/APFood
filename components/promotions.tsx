"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { money } from "../lib/demo";
import { itemStock, useDemo } from "../lib/demo-store";
import { itemSavings, offerPrice, promotions } from "../lib/promotions";

function useAvailablePromotions() {
  const state = useDemo();
  return promotions.flatMap(promotion => {
    const item = state.items.find(candidate => candidate.id === promotion.itemId);
    if (!item || !item.active || !itemSavings(item) || itemStock(state, item) < 1) return [];
    const vendor = state.vendors.find(candidate => candidate.id === item.vendorId);
    if (!vendor || vendor.status !== "approved" || vendor.paused) return [];
    return [{ ...promotion, item, vendor, href: "/app/vendors?dish=" + encodeURIComponent(item.name) }];
  });
}

export function HeroDeal() {
  const featured = useAvailablePromotions()[0];
  if (!featured) return null;
  return <Link className="hero-deal" href={featured.href}>
    <span><small>Featured deal</small><strong>{featured.item.name}</strong></span>
    <span className="hero-deal-price">{money(offerPrice(featured.item))}<ArrowUpRight size={16} aria-hidden /></span>
  </Link>;
}

export function Promotions() {
  const offers = useAvailablePromotions();
  if (!offers.length) return null;
  return <section className="promotions" aria-labelledby="campus-deals">
    <div className="section-head"><div><h2 id="campus-deals">Campus deals</h2><p>Discounts are applied automatically at checkout.</p></div><Link className="quiet-link" href="/app/vendors">Explore all stalls <ArrowUpRight size={16} aria-hidden /></Link></div>
    <div className="promo-grid">{offers.map(({ item, vendor, title, tone, href }) => <Link href={href} className={"promo-card promo-" + tone} key={item.id}>
      <div className="promo-image"><Image src={"/food/" + vendor.image + ".webp"} fill sizes="(max-width: 650px) 100vw, 33vw" alt="" /><span className="promo-savings">Save {money(itemSavings(item))}</span></div>
      <div className="promo-content">
        <div><h3>{title}</h3><p>{item.name}</p></div>
        <div className="promo-price"><del><span className="sr-only">Regular price </span>{money(item.price)}</del><strong>{money(offerPrice(item))}</strong></div>
        <ArrowUpRight size={18} aria-hidden />
      </div>
    </Link>)}</div>
  </section>;
}
