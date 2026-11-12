"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clock3, MapPin, Plus, Search, ShoppingBag, Tag } from "lucide-react";
import { money, addonPrice } from "../../lib/orders";
import { sampleLayout } from "../../lib/cafeteria/layout";
import { apiClient } from "../../lib/backend/client";
import type { useCart } from "../../lib/backend/cart";
import { RemoteStatus, useRemote } from "../workspace/common";
import { mealPhoto, type Meal, type Stall } from "./catalogue";

type Basket = ReturnType<typeof useCart>;

export function RestaurantMenu({
  vendor,
  items,
  store,
  onAdd,
}: {
  vendor: Stall;
  items: Meal[];
  store: Basket;
  onAdd: (item: Meal) => void;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const photo =
    sampleLayout.locations.find((location) => location.stallId === vendor.id)?.photo ??
    "/food/" + vendor.image + ".webp";
  const offers = items.filter((item) => item.discount_sen > 0);
  const visible = items.filter(
    (item) =>
      (item.name + " " + item.description).toLowerCase().includes(query.toLowerCase().trim()) &&
      (tab !== "offers" || item.discount_sen > 0) &&
      (tab !== "available" || item.stock > 0),
  );
  return (
    <div className="market-restaurant">
      <Link href="/app/vendors" className="market-breadcrumb">
        <ArrowLeft size={16} aria-hidden />
        All campus stalls
      </Link>
      <header className="market-restaurant-heading">
        <div className="market-counter-photo">
          <Image src={photo} alt={vendor.name + " counter"} fill sizes="160px" />
        </div>
        <div>
          <span className="market-restaurant-category">{vendor.category}</span>
          <h1>{vendor.name}</h1>
          <p>{vendor.description}</p>
          <div className="market-restaurant-meta">
            <span>
              <Clock3 size={15} aria-hidden />
              {vendor.lead_minutes} min preparation
            </span>
            <span>
              {vendor.opens_at.slice(0, 5)}–{vendor.closes_at.slice(0, 5)} MYT
            </span>
            <Link href={"/app/map?stall=" + vendor.id}>
              <MapPin size={15} aria-hidden />
              Find this counter
            </Link>
          </div>
        </div>
      </header>
      {vendor.paused && <p className="notice">This stall has paused new orders. You can still browse its menu.</p>}
      {offers.length > 0 && (
        <div className="market-restaurant-offer">
          <Tag size={20} aria-hidden />
          <div>
            <strong>A good meal, a better price.</strong>
            <span>
              {offers.length} menu {offers.length === 1 ? "offer" : "offers"} · Savings are included in the listed
              price.
            </span>
          </div>
        </div>
      )}
      <div className="market-menu-layout">
        <section>
          <div className="market-menu-toolbar">
            <div role="group" aria-label="Menu filter">
              {[
                ["all", "All dishes"],
                ["offers", "Offers"],
                ["available", "Available"],
              ].map(([value, label]) => (
                <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>
                  {label}
                </button>
              ))}
            </div>
            <label>
              <Search size={18} aria-hidden />
              <input
                type="search"
                aria-label="Search this menu"
                placeholder="Search this menu"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="market-section-heading">
            <div>
              <h2>{tab === "offers" ? "Menu offers" : "Made fresh at the counter"}</h2>
              <p>Choose a dish and make it yours.</p>
            </div>
          </div>
          {store.cart?.pending && (
            <p className="notice">
              Your checkout is awaiting confirmation. <Link href="/app/checkout">Resume checkout</Link>
            </p>
          )}
          <div className="market-meal-grid">
            {visible.map((item) => (
              <article className="market-meal-card" key={item.id} id={item.id}>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <div className="market-meal-price">
                    <strong>{money(item.price_sen - item.discount_sen)}</strong>
                    {item.discount_sen > 0 && <del>{money(item.price_sen)}</del>}
                  </div>
                  {item.discount_sen > 0 && <span className="market-meal-saving">Save {money(item.discount_sen)}</span>}
                  {!item.stock && <span className="market-meal-unavailable">Sold out for now</span>}
                </div>
                <div className={"market-meal-media" + (!mealPhoto(item) ? " no-photo" : "")}>
                  {mealPhoto(item) && <Image src={mealPhoto(item)!} alt={item.name} fill sizes="125px" />}
                  <button
                    aria-label={"Add " + item.name}
                    disabled={vendor.paused || !item.stock || Boolean(store.cart?.pending) || !store.ready}
                    onClick={() => onAdd(item)}
                  >
                    <Plus size={20} aria-hidden />
                    <span className="sr-only">Add</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!visible.length && (
            <div className="market-empty">
              <Search size={26} aria-hidden />
              <h3>No dishes match just yet.</h3>
              <p>Try a different search or browse the full menu.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setTab("all");
                }}
              >
                Show all dishes
              </button>
            </div>
          )}
        </section>
        <BasketSummary store={store} />
      </div>
    </div>
  );
}

function BasketSummary({ store }: { store: Basket }) {
  const result = useRemote(apiClient.catalogue);
  const cart = store.cart;
  const count = cart?.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  if (!result.value)
    return (
      <aside className="market-basket">
        <RemoteStatus error={result.error} reload={result.reload} />
      </aside>
    );
  const data = result.value;
  const total =
    cart?.items.reduce((sum, line) => {
      const item = data.items.find((item) => item.id === line.itemId);
      return sum + (item ? item.price_sen - item.discount_sen + (line.extra ? addonPrice : 0) : 0) * line.quantity;
    }, 0) ?? 0;
  const missing = cart?.items.some((line) => !data.items.some((item) => item.id === line.itemId));
  return (
    <>
      <aside className="market-basket">
        <div className="market-basket-heading">
          <h2>Your basket</h2>
          <ShoppingBag size={20} aria-hidden />
        </div>
        {count && cart ? (
          <>
            <div className="market-basket-lines">
              {cart.items.map((line) => {
                const item = data.items.find((item) => item.id === line.itemId);
                return (
                  <div key={line.itemId + line.extra}>
                    <b>{line.quantity}×</b>
                    <span>
                      <strong>{item?.name ?? "Unavailable item"}</strong>
                      <small>
                        {data.vendors.find((stall) => stall.id === (line.vendorId ?? cart.vendorId))?.name}
                        {line.extra && " · With a side"}
                      </small>
                    </span>
                    <strong>
                      {item
                        ? money((item.price_sen - item.discount_sen + (line.extra ? addonPrice : 0)) * line.quantity)
                        : "—"}
                    </strong>
                  </div>
                );
              })}
            </div>
            <div className="market-basket-total">
              <span>Subtotal</span>
              <strong>{missing ? "Review cart" : money(total)}</strong>
            </div>
            <p className="market-basket-note">Pickup times and final availability are checked at checkout.</p>
            <Link className="button primary" href="/app/cart">
              Review your basket ({count})
            </Link>
            <Link className="market-basket-more" href="/app/vendors">
              Add something from another stall
            </Link>
          </>
        ) : (
          <div className="market-basket-empty">
            <Image src="/illustrations/warm/empty_cart.png" alt="" width={140} height={125} />
            <h3>Your next meal starts here.</h3>
            <p>Add a dish from the menu. You can order from more than one stall.</p>
          </div>
        )}
      </aside>
      {count > 0 && (
        <div className="market-mobile-basket">
          <Link href="/app/cart">
            <span>
              <ShoppingBag size={19} aria-hidden />
              <b>{count}</b>View basket
            </span>
            <strong>{missing ? "Review" : money(total)}</strong>
          </Link>
        </div>
      )}
    </>
  );
}
