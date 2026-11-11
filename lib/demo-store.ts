"use client";

import { useSyncExternalStore } from "react";
import { migrateCatalogue, addonPrice, available, cartDetails, dayKey, seedDemo, stages, uniqueId, withAudit, type CartLine, type DemoState, type Entry, type Item, type Order, type Payment, type Scenario, type Status, type Vendor } from "./demo";

export const storageKey = "ap-food-apspace-demo-v1";
const eventName = "ap-food-change";
const initial = seedDemo();
let lastRaw: string | null = null;
let lastValue = initial;

function snapshot() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== lastRaw) {
      lastValue = raw ? migrateCatalogue(JSON.parse(raw) as DemoState) : seedDemo();
      lastRaw = raw;
    }
  } catch {
    return lastValue;
  }
  return lastValue;
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(eventName, listener);
  };
}

export function useDemo() {
  return useSyncExternalStore(subscribe, snapshot, () => initial);
}

function update(change: (state: DemoState) => DemoState) {
  const before = snapshot();
  const state = change(before);
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    lastRaw = localStorage.getItem(storageKey);
  } catch {
    // Keep the demo usable in the current tab if storage is blocked.
  }
  lastValue = state;
  window.dispatchEvent(new Event(eventName));
  const message=state.audit[0]?.id!==before.audit[0]?.id?state.audit[0]?.action:JSON.stringify(state.cart)!==JSON.stringify(before.cart)?'Basket updated':state.scenario!==before.scenario?'Activity scenario updated':undefined;
  if(message) window.dispatchEvent(new CustomEvent('apfoods-notice',{detail:message}));
}

export function clearDemo() {
  try {
    localStorage.removeItem(storageKey);
  } finally {
    lastRaw = null;
    lastValue = seedDemo();
    window.dispatchEvent(new Event(eventName));
  }
}

export function itemStock(state: DemoState, item: Item) {
  const used = state.orders.filter(order => order.scenario === state.scenario && order.id.startsWith("AP-D") && !["cancelled", "rejected"].includes(order.status)).reduce((total, order) => total + order.lines.filter(line => line.itemId === item.id).reduce((units, line) => units + line.quantity, 0), 0);
  return Math.max(0, item.stock - used);
}

export const selectScenario = (scenario: Scenario) => update(state => ({ ...state, scenario }));

export function addToCart(line: CartLine, replace = false) {
  update(state => {
    const item = state.items.find(candidate => candidate.id === line.itemId);
    if (!item || !item.active || !Number.isInteger(line.quantity) || line.quantity < 1) throw new Error("This item is unavailable.");
    const cart = replace ? [] : state.cart;
    const matching = cart.find(candidate => candidate.itemId === line.itemId && candidate.extra === line.extra);
    const already = cart.filter(candidate => candidate.itemId === line.itemId).reduce((sum, candidate) => sum + candidate.quantity, 0);
    if (line.quantity + already > itemStock(state, item)) throw new Error("There are only " + itemStock(state, item) + " portions left.");
    const next = matching ? cart.map(candidate => candidate === matching ? { ...candidate, quantity: candidate.quantity + line.quantity } : candidate) : [...cart, line];
    return { ...state, cart: next };
  });
}

export function changeQuantity(index: number, quantity: number) {
  update(state => ({ ...state, cart: quantity > 0 ? state.cart.map((line, lineIndex) => lineIndex === index ? { ...line, quantity } : line) : state.cart.filter((_, lineIndex) => lineIndex !== index) }));
}

export function placeOrder(slot: number, payment: Payment) {
  const id = "AP-D" + uniqueId().slice(0, 6).toUpperCase();
  update(state => {
    const cart = cartDetails(state);
    if (!cart.length) throw new Error("Your cart is empty.");
    const groups = [...new Set(cart.map(line => line.item.vendorId))].map(vendorId => {
      const vendor = state.vendors.find(candidate => candidate.id === vendorId);
      if (!vendor || vendor.status !== 'approved') throw new Error("A stall is unavailable. Review your cart.");
      const lines = cart.filter(line => line.item.vendorId === vendorId);
      for (const { item } of lines) {
        const requested = lines.filter(line => line.item.id === item.id).reduce((sum, line) => sum + line.quantity, 0);
        if (!item.active || requested > itemStock(state, item)) throw new Error(item.name + " does not have enough stock. Edit your cart and try again.");
      }
      const units = lines.reduce((sum, line) => sum + line.quantity * line.item.work, 0);
      if (!available(state, vendor, slot, units)) throw new Error(vendor.name + ": this pickup window is no longer available. Choose another one.");
      return {vendor, lines};
    });
    // Validate every stall before committing any orders or clearing the basket.
    const orders: Order[] = groups.map(({vendor, lines}, index) => ({
      id: index === 0 ? id : "AP-D" + uniqueId().slice(0, 6).toUpperCase(), vendorId: vendor.id,
      lines: lines.map(({item, ...line}) => ({...line, name:item.name, work:item.work})),
      total: lines.reduce((sum, line) => sum + line.unit * line.quantity, 0), day:dayKey(), slot,
      status:"placed", payment, scenario:state.scenario, code:""
    }));
    let next = {...state, orders:[...orders, ...state.orders], cart:[]};
    for (const order of orders) next = {...next, audit:withAudit(next, "Student", "Placed order", order.id, groups.find(group => group.vendor.id === order.vendorId)?.vendor.name)};
    return next;
  });
  return id;
}

export function issueCode(id: string, renew = false) {
  update(state => {
    const order = state.orders.find(candidate => candidate.id === id);
    if (!order || order.status !== "ready") throw new Error("The order must be ready before you can open its pickup code.");
    if (!renew && order.code && (order.codeExpiresAt ?? 0) > Date.now()) return state;
    return { ...state, orders: state.orders.map(candidate => candidate.id === id ? { ...candidate, code: uniqueId().slice(0, 8).toUpperCase(), codeExpiresAt: Date.now() + 5 * 60_000 } : candidate) };
  });
}

export function transition(id: string, status: Status, actor: "Student" | "Vendor", details: { reason?: string; code?: string; confirmed?: boolean } = {}) {
  update(state => {
    const order = state.orders.find(candidate => candidate.id === id);
    if (!order) throw new Error("This order is unavailable.");
    if (order.status === "collected") throw new Error("This pickup code has already been used.");
    const current = stages.findIndex(stage => stage === order.status);
    const canCancel = ["placed", "accepted"].includes(order.status) || (actor === "Vendor" && order.status === "preparing");
    const valid = status === "cancelled" ? canCancel : actor === "Vendor" && (status === "rejected" ? order.status === "placed" : current >= 0 && stages[current + 1] === status);
    if (!valid) throw new Error("This order has changed. Review its current status.");
    if (status === "rejected" && !details.reason?.trim()) throw new Error("Enter a reason for rejecting this order.");
    if (status === "collected") {
      if (!order.code || order.code !== details.code?.trim().toUpperCase()) throw new Error("The pickup code doesn't match this order.");
      if ((order.codeExpiresAt ?? 0) <= Date.now()) throw new Error("That code has expired. Ask the student for a new code.");
      if (order.payment === "counter" && !details.confirmed) throw new Error("Confirm the counter payment first.");
    }
    const receipt: Entry[] = status === "collected" ? [{ id: "receipt-" + id, vendorId: order.vendorId, type: order.payment, amount: order.total, label: id + " pickup", day: dayKey(), scenario: order.scenario }] : [];
    return {
      ...state,
      orders: state.orders.map(candidate => candidate.id === id ? { ...candidate, status } : candidate),
      entries: [...receipt, ...state.entries],
      audit: withAudit(state, actor, "Order " + status, id, details.reason),
    };
  });
}

export function saveVendor(id: string, changes: Partial<Vendor>, actor: "Vendor" | "Admin", reason: string) {
  update(state => ({ ...state, vendors: state.vendors.map(vendor => vendor.id === id ? { ...vendor, ...changes } : vendor), audit: withAudit(state, actor, "Updated stall", state.vendors.find(vendor => vendor.id === id)?.name ?? id, reason) }));
}

export function saveItem(item: Item) {
  update(state => ({ ...state, items: state.items.some(candidate => candidate.id === item.id) ? state.items.map(candidate => candidate.id === item.id ? item : candidate) : [...state.items, item], audit: withAudit(state, "Vendor", "Saved menu item", item.name) }));
}

export function addExpense(vendorId: string, amount: number, label: string) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Enter a positive amount in RM.");
  update(state => ({ ...state, entries: [{ id: uniqueId(), vendorId, type: "expense", amount, label, day: dayKey(), scenario: state.scenario }, ...state.entries], audit: withAudit(state, "Admin", "Recorded expense", label) }));
}

export function reverseExpense(id: string, reason: string) {
  update(state => {
    const entry = state.entries.find(candidate => candidate.id === id && candidate.type === "expense");
    if (!entry || state.entries.some(candidate => candidate.originalId === id)) throw new Error("This expense has already been reversed or is unavailable.");
    if (!reason.trim()) throw new Error("Enter a reason for the reversal.");
    return { ...state, entries: [{ ...entry, type: "reversal", id: uniqueId(), originalId: id, label: entry.label + " reversal", day: dayKey() }, ...state.entries], audit: withAudit(state, "Admin", "Reversed expense", entry.label, reason) };
  });
}

// Read boundary for the browser mock service. Domain operations are unchanged.
export const getDemoSnapshot = snapshot;
