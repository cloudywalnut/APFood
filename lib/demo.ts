import { offerPrice } from "./promotions";

export type Scenario = "standard" | "light" | "medium" | "heavy";
export type Status = "placed" | "accepted" | "preparing" | "ready" | "collected" | "cancelled" | "rejected";
export type Payment = "demo" | "counter";
export type Vendor = { id: string; name: string; zone: string; category: string; description: string; image: string; status: "approved" | "suspended"; paused: boolean; capacity: number; lead: number; hours: string };
export type Item = { id: string; vendorId: string; name: string; description: string; price: number; stock: number; active: boolean; work: number; image?:string; imageAlt?:string };
export type CartLine = { itemId: string; quantity: number; extra: boolean };
export type OrderLine = CartLine & { name: string; unit: number; work: number };
export type Order = { id: string; vendorId: string; lines: OrderLine[]; total: number; slot: number; day: string; status: Status; payment: Payment; scenario: Scenario; code: string; codeExpiresAt?: number; readyLate?: boolean };
export type Entry = { id: string; vendorId: string; type: "demo" | "counter" | "expense" | "reversal"; amount: number; label: string; day: string; scenario: Scenario; originalId?: string };
export type Audit = { id: string; actor: string; action: string; target: string; detail: string; at: string };
export type DemoState = { vendors: Vendor[]; items: Item[]; cart: CartLine[]; orders: Order[]; entries: Entry[]; audit: Audit[]; scenario: Scenario };

export const scenarios: Scenario[] = ["standard", "light", "medium", "heavy"];
export const scenarioNames: Record<Scenario, string> = { standard: "Standard", light: "Light", medium: "Medium", heavy: "Heavy" };
export const statusNames: Record<Status, string> = { placed: "Placed", accepted: "Accepted", preparing: "Preparing", ready: "Ready", collected: "Collected", cancelled: "Cancelled", rejected: "Rejected" };
export const stages = ["placed", "accepted", "preparing", "ready", "collected"] as const;
export const slots = [0, 1, 2, 3, 4, 5];
export const addonPrice = 200;

const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" });
export function dayKey(offset = 0) {
  return dateFormatter.format(new Date(Date.now() + offset * 86_400_000));
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
  { id: "campus-noodle-bar", name: "Chinese", zone: "Main Food Court", category: "Noodles & rice", description: "Wok-tossed campus favourites, made to order.", image: "noodles", status: "approved", paused: false, capacity: 5, lead: 10, hours: "10:00 AM – 3:00 PM" },
  { id: "brew-and-bites", name: "Malay", zone: "Main Food Court", category: "Malay cuisine & kopi", description: "Good coffee and quick bites between classes.", image: "coffee", status: "approved", paused: false, capacity: 6, lead: 5, hours: "9:00 AM – 4:00 PM" },
  { id: "green-bowl-kitchen", name: "Japanese & Korean", zone: "Annex Cafeteria", category: "Japanese & Korean cuisine", description: "Colourful bowls, crunchy greens and warm rice.", image: "bowl", status: "approved", paused: false, capacity: 7, lead: 10, hours: "10:00 AM – 3:00 PM" },
  { id: "indian", name: "Indian", zone: "Main Food Court", category: "Indian cuisine", description: "Rice, curries and freshly made roti.", image: "bowl", status: "approved", paused: false, capacity: 8, lead: 10, hours: "9:00 AM – 4:00 PM" },
  { id: "arab-shawarma", name: "Arab Shawarma", zone: "Annex Cafeteria", category: "Middle Eastern", description: "Shawarma wraps and fragrant rice plates.", image: "noodles", status: "approved", paused: false, capacity: 6, lead: 10, hours: "10:00 AM – 5:00 PM" },
  { id: "drinks-counter", name: "Refreshments", zone: "Main Food Court", category: "Drinks", description: "Cold drinks between classes.", image: "coffee", status: "approved", paused: true, capacity: 6, lead: 5, hours: "Temporarily closed" },
  { id: "local-corner-left", name: "Local Corner · Left", zone: "Main Food Court", category: "Local rice dishes", description: "Rice plates and vegetables at the left side of the glass window.", image: "bowl", status: "approved", paused: false, capacity: 6, lead: 10, hours: "10:00 AM – 3:00 PM" },
  { id: "local-corner-right", name: "Local Corner · Right", zone: "Main Food Court", category: "Local noodles & rice", description: "Freshly cooked noodles and rice at the right side of the glass window.", image: "noodles", status: "approved", paused: false, capacity: 6, lead: 10, hours: "10:00 AM – 3:00 PM" },
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
  ["chicken-curry", "indian", "Chicken Curry Rice", "Chicken curry, steamed rice and vegetables.", 1200, 16],
  ["roti-set", "indian", "Roti Canai Set", "Two pieces of roti with dhal and curry.", 650, 20],
  ["vegetable-biryani", "indian", "Vegetable Biryani", "Spiced basmati rice and seasonal vegetables.", 1000, 12],
  ["chicken-shawarma", "arab-shawarma", "Chicken Shawarma", "Grilled chicken, crunchy greens and garlic sauce in a warm wrap.", 1150, 16],
  ["falafel-wrap", "arab-shawarma", "Falafel Wrap", "Chickpea falafel, salad and tahini.", 1050, 10],
  ["shawarma-rice", "arab-shawarma", "Shawarma Rice", "Chicken shawarma served over fragrant rice.", 1400, 12],
  ["nasi-lemak", "brew-and-bites", "Nasi Lemak", "Coconut rice, sambal, egg, cucumber and crispy anchovies.", 950, 16],
  ["iced-lemon-tea", "drinks-counter", "Iced Lemon Tea", "Fresh lemon tea over ice.", 390, 20],
  ["crispy-dumplings", "campus-noodle-bar", "Crispy Dumplings", "Vegetable dumplings with a soy dipping sauce.", 800, 0],
  ["local-left-chicken-rice", "local-corner-left", "Chicken Rice", "Chicken, fragrant rice, cucumber and chilli sauce.", 1000, 20],
  ["local-left-vegetable-rice", "local-corner-left", "Vegetable Rice", "Steamed rice with seasonal vegetables and tofu.", 850, 20],
  ["local-right-mee-goreng", "local-corner-right", "Mee Goreng", "Stir-fried noodles with vegetables and egg.", 950, 20],
  ["local-right-nasi-goreng", "local-corner-right", "Nasi Goreng", "Fried rice with vegetables and a fried egg.", 1000, 20],
] as const;

const baseItems: Item[] = menuRows.map(([id, vendorId, name, description, price, stock]) => ({ id, vendorId, name, description, price, stock, work: 1, active: true }));

export function seedDemo(): DemoState {
  const orders: Order[] = [];
  const entries: Entry[] = [];
  for (const scenario of scenarios) {
    const multiplier = { standard: 1, light: 1, medium: 2, heavy: 3 }[scenario];
    for (let index = 0; index < 14; index += 1) {
      for (const [vendorIndex, vendor] of baseVendors.entries()) {
        const choices = baseItems.filter(i => i.vendorId === vendor.id);
        if (vendor.paused || !choices.length) continue;
        const item = choices[index % choices.length];
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
  return { vendors: baseVendors, items: baseItems, cart: [], orders, entries, scenario: "standard", audit: [{ id: "seed", actor: "Initial setup", action: "Loaded cafeteria", target: "APFoods", detail: "Cafeteria catalogue loaded", at: new Date(dayKey() + "T10:00:00+08:00").toISOString() }] };
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

export function totals(entries: Entry[]) {
  const amount = (type: Entry["type"]) => entries.filter(entry => entry.type === type).reduce((sum, entry) => sum + entry.amount, 0);
  const demo = amount("demo");
  const counter = amount("counter");
  const expense = amount("expense");
  const reversal = amount("reversal");
  return { demo, counter, expense, reversal, inflow: demo + counter, net: demo + counter - expense + reversal };
}

export function withAudit(state: DemoState, actor: string, action: string, target: string, detail = "") {
  return [{ id: uniqueId(), actor, action, target, detail, at: new Date().toISOString() }, ...state.audit];
}

// Add new sample records without discarding a saved cart, orders or vendor edits.
export function migrateCatalogue(state:DemoState):DemoState {
 const aliases:Record<string,string>={"Campus Noodle Bar":"Chinese","Brew & Bites":"Malay","Green Bowl Kitchen":"Japanese & Korean"};
 return {...state,audit:state.audit.map(a=>({...a,actor:a.actor==="Initial setup"?"Initial setup":a.actor,target:a.target==="AP Food"?"APFoods":a.target})),vendors:[...state.vendors.map(v=>({...v,name:aliases[v.name]??v.name,category:v.id==="brew-and-bites"&&v.category==="Coffee & light bites"?"Malay cuisine & kopi":v.id==="green-bowl-kitchen"&&v.category==="Rice bowls & greens"?"Japanese & Korean cuisine":v.category})),...baseVendors.filter(v=>!state.vendors.some(old=>old.id===v.id))],items:[...state.items,...baseItems.filter(i=>!state.items.some(old=>old.id===i.id))]};
}
