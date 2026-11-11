import { offerPrice } from "./promotions";

export type Scenario = "standard" | "light" | "medium" | "heavy";
export type Status = "placed" | "accepted" | "preparing" | "ready" | "collected" | "cancelled" | "rejected";
export type Payment = "demo" | "counter";
export type Vendor = { id: string; name: string; zone: string; category: string; description: string; image: string; status: "approved" | "suspended"; paused: boolean; capacity: number; lead: number; hours: string };
export type Item = { id: string; vendorId: string; name: string; description: string; price: number; stock: number; active: boolean; work: number };
export type CartLine = { itemId: string; quantity: number; extra: boolean };
export type OrderLine = CartLine & { name: string; unit: number; work: number };
export type Order = { id: string; vendorId: string; lines: OrderLine[]; total: number; slot: number; day: string; status: Status; payment: Payment; scenario: Scenario; code: string; codeExpiresAt?: number; readyLate?: boolean };
export type Entry = { id: string; vendorId: string; type: "demo" | "counter" | "expense" | "reversal"; amount: number; label: string; day: string; scenario: Scenario; originalId?: string };
export type Audit = { id: string; actor: string; action: string; target: string; detail: string; at: string };
export type DemoState = { vendors: Vendor[]; items: Item[]; cart: CartLine[]; orders: Order[]; entries: Entry[]; audit: Audit[]; scenario: Scenario };

export const scenarios: Scenario[] = ["standard", "light", "medium", "heavy"];
export const scenarioNames: Record<Scenario, string> = { standard: "Standard demo", light: "Light", medium: "Medium", heavy: "Heavy" };
export const statusNames: Record<Status, string> = { placed: "Placed", accepted: "Accepted", preparing: "Preparing", ready: "Ready", collected: "Collected", cancelled: "Cancelled", rejected: "Rejected" };
export const stages = ["placed", "accepted", "preparing", "ready", "collected"] as const;
export const slots = [0, 1, 2, 3, 4, 5];
export const addonPrice = 200;

const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" });
export function dayKey(offset = 0, now = Date.now()) {
  return dateFormatter.format(new Date(now + offset * 86_400_000));
}

export function dayLabel(day: string) {
  return new Intl.DateTimeFormat("en-MY", { month: "short", day: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(day + "T12:00:00+08:00"));
}

export function money(sen: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(sen / 100);
}

export function slotTime(slot: number) {
  const minute = 12 * 60 + 15 * slot;
  const hour = Math.floor(minute / 60);
  return (hour % 12 || 12) + ":" + String(minute % 60).padStart(2, "0");
}

export function slotLabel(slot: number) {
  return slotTime(slot) + "–" + slotTime(slot + 1) + " PM";
}

export const isActive = (status: Status) => ["placed", "accepted", "preparing", "ready"].includes(status);
export const uniqueId = () => crypto.randomUUID();

const baseVendors: Vendor[] = [
  { id: "campus-noodle-bar", name: "Campus Noodle Bar", zone: "Main Food Court", category: "Noodles & rice", description: "Wok-tossed campus favourites, made to order.", image: "noodles", status: "approved", paused: false, capacity: 5, lead: 10, hours: "10:00 AM – 3:00 PM" },
  { id: "brew-and-bites", name: "Brew & Bites", zone: "Main Food Court", category: "Coffee & light bites", description: "Good coffee and quick bites between classes.", image: "coffee", status: "approved", paused: false, capacity: 6, lead: 5, hours: "9:00 AM – 4:00 PM" },
  { id: "green-bowl-kitchen", name: "Green Bowl Kitchen", zone: "Annex Cafeteria", category: "Rice bowls & greens", description: "Colourful bowls, crunchy greens and warm rice.", image: "bowl", status: "approved", paused: false, capacity: 7, lead: 10, hours: "10:00 AM – 3:00 PM" },
];

const menuRows = [
  ["chicken-noodles", "campus-noodle-bar", "Chicken Noodle Bowl", "Soy-glazed chicken, spring onions and wok-tossed noodles.", 1100, 18],
  ["chilli-rice", "campus-noodle-bar", "Chilli Chicken Rice", "Fragrant rice, crispy chicken and house sambal.", 1250, 12],
  ["mushroom-noodles", "campus-noodle-bar", "Mushroom Noodles", "Shiitake, greens and a savoury mushroom glaze.", 1050, 5],
  ["iced-coffee", "brew-and-bites", "Iced Kopi", "Bold local coffee poured over ice.", 650, 20],
  ["egg-toast", "brew-and-bites", "Egg & Kaya Toast", "Toasted bread with kaya and a soft egg.", 850, 11],
  ["toastie", "brew-and-bites", "Cheese Toastie", "Golden toast and melted cheddar.", 900, 4],
  ["tofu-bowl", "green-bowl-kitchen", "Sesame Tofu Bowl", "Crispy tofu, sesame greens and steamed rice.", 1300, 14],
  ["ginger-bowl", "green-bowl-kitchen", "Ginger Chicken Bowl", "Tender ginger chicken, carrots and greens.", 1400, 10],
  ["harvest-bowl", "green-bowl-kitchen", "Harvest Rice Bowl", "Seasonal vegetables and a bright lime dressing.", 1200, 3],
] as const;

const baseItems: Item[] = menuRows.map(([id, vendorId, name, description, price, stock]) => ({ id, vendorId, name, description, price, stock, work: 1, active: true }));

export function seedDemo(): DemoState {
  const orders: Order[] = [];
  const entries: Entry[] = [];
  for (const scenario of scenarios) {
    const multiplier = { standard: 1, light: 1, medium: 2, heavy: 3 }[scenario];
    for (let index = 0; index < 14; index += 1) {
      for (const [vendorIndex, vendor] of baseVendors.entries()) {
        const item = baseItems[vendorIndex * 3 + index % 3];
        const quantity = multiplier + (index + vendorIndex) % 4;
        const day = dayKey(-index);
        const id = "AP-" + scenario[0].toUpperCase() + (1100 + index * 10 + vendorIndex);
        const payment = index % 2 ? "counter" : "demo";
        const total = item.price * quantity;
        orders.push({ id, vendorId: vendor.id, lines: [{ itemId: item.id, name: item.name, quantity, extra: false, unit: item.price, work: 1 }], total, slot: 1, day, status: "collected", payment, scenario, code: "", readyLate: (index + vendorIndex) % 5 === 0 });
        entries.push({ id, vendorId: vendor.id, type: payment, amount: total, label: id + " pickup", day, scenario });
        entries.push({ id: id + "-cost", vendorId: vendor.id, type: "expense", amount: 900 + (index * 137 + vendorIndex * 551) % 1700, label: "Ingredients", day, scenario });
      }
    }
    entries.push({ id: scenario + "-overhead", vendorId: "", type: "expense", amount: 1800, label: "Shared cleaning supplies", day: dayKey(), scenario });
    const activeCount = { standard: 2, light: 1, medium: 3, heavy: 5 }[scenario];
    for (let index = 0; index < activeCount; index += 1) {
      const item = baseItems[index % 3];
      const status = (["placed", "accepted", "preparing", "ready"] as const)[index % 4];
      orders.push({ id: "AP-" + scenario[0].toUpperCase() + (1042 + index), vendorId: item.vendorId, lines: [{ itemId: item.id, name: item.name, quantity: 1, extra: false, unit: item.price, work: 1 }], total: item.price, slot: 0, day: dayKey(), status, payment: index % 2 ? "counter" : "demo", scenario, code: "", readyLate: index === 3 });
    }
  }
  return { vendors: baseVendors, items: baseItems, cart: [], orders, entries, scenario: "standard", audit: [{ id: "seed", actor: "Demo setup", action: "Loaded fictional cafeteria", target: "AP Food", detail: "Three stalls and browser-only fixtures", at: new Date(dayKey() + "T10:00:00+08:00").toISOString() }] };
}

export function loadFor(state: DemoState, vendor: Vendor, slot: number) {
  const booked = state.orders.filter(order => order.scenario === state.scenario && order.vendorId === vendor.id && order.day === dayKey() && order.slot === slot && isActive(order.status));
  return { units: booked.reduce((sum, order) => sum + order.lines.reduce((units, line) => units + line.work * line.quantity, 0), 0), count: booked.length };
}

export function available(state: DemoState, vendor: Vendor, slot: number, units = 1) {
  const minutesFromDemoOpening = 10 + slot * 15;
  return vendor.status === "approved" && !vendor.paused && minutesFromDemoOpening >= vendor.lead && loadFor(state, vendor, slot).units + units <= vendor.capacity;
}

export function cartDetails(state: DemoState) {
  return state.cart.flatMap(line => {
    const item = state.items.find(candidate => candidate.id === line.itemId);
    return item ? [{ ...line, item, unit: offerPrice(item) + (line.extra ? addonPrice : 0) }] : [];
  });
}

export function totals(entries: { type: Entry["type"] | "duitnow_qr" | "refund"; amount: number }[]) {
  const amount = (type: Entry["type"] | "duitnow_qr" | "refund") => entries.filter(entry => entry.type === type).reduce((sum, entry) => sum + entry.amount, 0);
  const demo = amount("demo");
  const counter = amount("counter");
  const expense = amount("expense");
  const reversal = amount("reversal");
  const duitnow = amount("duitnow_qr");
  const refund = amount("refund");
  return { demo, counter, expense: expense + refund, reversal, inflow: demo + counter + duitnow, net: demo + counter + duitnow - expense - refund + reversal };
}

export function withAudit(state: DemoState, actor: string, action: string, target: string, detail = "") {
  return [{ id: uniqueId(), actor, action, target, detail, at: new Date().toISOString() }, ...state.audit];
}
