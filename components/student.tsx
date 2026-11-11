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
import { APPickupCode } from "./apspace/pickup-code";
import { TabBar } from "./apspace/ui";
import { MealEditor } from "./apspace/meal-editor";
import { APHome, APCheckout } from "./apspace/student-views";
import { MapDiscovery, MenuDiscovery, ItemDiscovery } from "./cafeteria/journey";
import { OrderTracking } from "./apspace/order-tracking";
import { Traffic } from "./traffic";

type State = ReturnType<typeof useDemo>;

export function StudentPage({ route, section, id, itemId }: { route: string; section: string; id?: string; itemId?:string }) {
  return <StudentShell route={route}>
    {section === "home" && <APHome />}
    {section === "area" && <MapDiscovery areaId={id}/>}
    {section === "item" && id && itemId && <ItemDiscovery stallId={id} itemId={itemId}/>}
    {section === "vendors" && (id ? <MenuDiscovery stallId={id}/> : <MapDiscovery/>)}
    {section === "cart" && <Cart />}
    {section === "checkout" && <APCheckout />}
    {section === "orders" && (id ? <OrderDetail id={id} /> : <Orders />)}
    {section === "traffic" && <Traffic />}
  </StudentShell>;
}

function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="quiet-link back-link" href={href}><ArrowLeft size={16} aria-hidden /> {children}</Link>;
}


function Cart() {
  const state = useDemo();
  const lines = cartDetails(state);
  const vendor = state.vendors.find(candidate => candidate.id === lines[0]?.item.vendorId);
  if (!vendor) return <Empty title="Your cart is empty" detail="Pick something from a campus stall to get started." href="/app/vendors" action="Explore vendors" />;
  return <><Back href="/app/vendors">Back to menu</Back><div className="student-heading"><div><h1>Your cart</h1><p>{[...new Set(lines.map(line=>state.vendors.find(v=>v.id===line.item.vendorId)?.name))].join(" · ")}</p></div></div><div className="panel cart-panel">
    {lines.map((line, index) => <div className="cart-row" key={line.itemId + line.extra}><div><h3>{line.item.name}</h3><small>{state.vendors.find(v=>v.id===line.item.vendorId)?.name}</small><p>{line.extra ? "With a side" : "Regular"} · {money(line.unit)} each</p></div><div className="stepper"><button className="icon-button" aria-label={"Decrease " + line.item.name} onClick={() => changeQuantity(index, line.quantity - 1)}><Minus size={16} aria-hidden /></button><strong>{line.quantity}</strong><button className="icon-button" aria-label={"Increase " + line.item.name} disabled={lines.filter(candidate => candidate.itemId === line.itemId).reduce((count, candidate) => count + candidate.quantity, 0) >= itemStock(state, line.item)} onClick={() => changeQuantity(index, line.quantity + 1)}><Plus size={16} aria-hidden /></button><button className="icon-button" aria-label={"Remove " + line.item.name} onClick={() => changeQuantity(index, 0)}><Trash2 size={16} aria-hidden /></button></div></div>)}
    <div className="line spread cart-total"><strong>Subtotal</strong><strong>{money(lines.reduce((sum, line) => sum + line.unit * line.quantity, 0))}</strong></div></div><div className="sticky-action"><Link href="/app/checkout" className="button primary">Choose pickup time <ArrowRight size={17} aria-hidden /></Link></div></>;
}

function Orders() {
  const state = useDemo();
  const [tab,setTab]=useState("all");
  const orders = state.orders.filter(order => order.scenario === state.scenario && (tab === "all" || (tab === "active" ? isActive(order.status) : !isActive(order.status)))).sort((a, b) => Number(isActive(b.status)) - Number(isActive(a.status)));
  return <><div className="student-heading"><div><h1>Orders</h1><p>Track active pickups and find previous sample orders.</p></div></div><TabBar label="Order list" value={tab} onChange={setTab} tabs={[{id:"all",label:"All orders"},{id:"active",label:"Active"},{id:"history",label:"History"}]}/>{orders.length ? <div className="orders-list panel">{orders.map(order => <Link href={"/app/orders/" + order.id} className="order-list-row" key={order.id}><span><strong>{state.vendors.find(vendor => vendor.id === order.vendorId)?.name}</strong><small>{order.id} · {order.day === dayKey() ? "Today" : order.day} · {slotLabel(order.slot)}</small></span><StatusBadge status={order.status} /><strong>{money(order.total)}</strong><ChevronRight size={16} aria-hidden /></Link>)}</div> : <Empty title="No orders here yet" detail="Your pickups appear after you place an order." href="/app/vendors" action="Explore vendors" />}</>;
}


function OrderDetail({id}:{id:string}){return <OrderTracking id={id}/>;}
