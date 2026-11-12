// Prepares a dedicated Supabase demo project: syncs the demo catalogue, creates the demo accounts with the
// shared password, removes fixture accounts no longer listed, and loads 14 days of order and ledger history once.
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: secret,
  AP_FOOD_DEMO_PROJECT_REF: projectRef,
} = process.env;
if (!projectRef || !url || new URL(url).origin !== "https://" + projectRef + ".supabase.co" || !secret) {
  throw new Error("Configure the dedicated project URL/ref and its secret key.");
}
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const { password, accounts } = await readJson("../supabase/fixtures/demo-accounts.json");
const catalogue = await readJson("../supabase/fixtures/demo-catalogue.json");

function check(result, message) {
  if (result.error) throw new Error(message + " (" + result.error.message + ")");
  return result.data;
}

// Deterministic UUIDs keep re-runs idempotent.
function stableId(value) {
  const hex = createHash("sha256")
    .update(projectRef + ":" + value)
    .digest("hex");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-4" +
    hex.slice(13, 16) +
    "-8" +
    hex.slice(17, 20) +
    "-" +
    hex.slice(20, 32)
  );
}

// 1. Catalogue. Stall hours stay as seeded (full day) so ordering works at any time.
const zones = check(await supabase.from("zones").select("id,name"), "Cannot read zones");
const zoneId = (name) =>
  zones.find((zone) => zone.name === name)?.id ??
  (() => {
    throw new Error("Unknown zone " + name);
  })();
check(
  await supabase.from("vendors").upsert(
    catalogue.vendors.map((vendor) => ({
      id: vendor.id,
      zone_id: zoneId(vendor.zone),
      name: vendor.name,
      description: vendor.description,
      category: vendor.category,
      image: vendor.image,
      status: vendor.status,
      paused: vendor.paused,
      capacity: vendor.capacity,
      lead_minutes: vendor.lead,
      opens_at: "00:00",
      closes_at: "24:00",
    })),
  ),
  "Cannot sync stalls",
);
check(
  await supabase.from("menu_items").upsert(
    catalogue.items.map((item) => ({
      id: item.id,
      vendor_id: item.vendorId,
      name: item.name,
      description: item.description,
      price_sen: item.price,
      stock: item.stock,
      work_units: 1,
      active: true,
    })),
  ),
  "Cannot sync menu items",
);
const extras = check(
  await supabase
    .from("menu_items")
    .select("id")
    .not("id", "in", "(" + catalogue.items.map((item) => item.id).join(",") + ")"),
  "Cannot read menu items",
);
if (extras.length)
  check(
    await supabase
      .from("menu_items")
      .update({ active: false })
      .in(
        "id",
        extras.map((item) => item.id),
      ),
    "Cannot hide extra menu items",
  );
console.log(
  "Catalogue synced · " +
    catalogue.vendors.length +
    " stalls, " +
    catalogue.items.length +
    " items" +
    (extras.length ? ", " + extras.length + " extra hidden" : ""),
);

// 2. Accounts. Every fixture uses the shared demo password.
const existing = new Map();
for (let page = 1; ; page++) {
  const { users, nextPage } = check(
    await supabase.auth.admin.listUsers({ page, perPage: 100 }),
    "Cannot list accounts",
  );
  for (const user of users) existing.set(user.email, user);
  if (!nextPage || nextPage <= page) break;
}
const userIds = new Map();
for (const account of accounts) {
  const attributes = {
    password,
    email_confirm: true,
    user_metadata: { display_name: account.name },
    app_metadata: { ap_food_fixture: true },
  };
  let user = existing.get(account.email);
  if (user && user.app_metadata.ap_food_fixture !== true)
    throw new Error("Existing non-fixture account conflicts with " + account.email);
  user = user
    ? check(await supabase.auth.admin.updateUserById(user.id, attributes), "Cannot update " + account.email).user
    : check(
        await supabase.auth.admin.createUser({ email: account.email, ...attributes }),
        "Cannot create " + account.email,
      ).user;
  check(
    await supabase
      .from("memberships")
      .upsert(
        { user_id: user.id, role: account.role, vendor_id: account.vendorId ?? null },
        { onConflict: "user_id,role,vendor_id", ignoreDuplicates: true },
      ),
    "Cannot assign membership for " + account.email,
  );
  userIds.set(account.role === "vendor" ? account.vendorId : account.role, user.id);
  console.log(account.email + " · " + account.role);
}
for (const [email, user] of existing) {
  if (user.app_metadata.ap_food_fixture !== true || accounts.some((account) => account.email === email)) continue;
  const removed = await supabase.auth.admin.deleteUser(user.id);
  console.log(
    removed.error
      ? "Could not remove old fixture " + email + " (it still owns orders)"
      : "Removed old fixture " + email,
  );
}

// 3. History: 14 days of collected orders per open stall, ingredient costs, and two active orders. Runs once per project.
const marker = check(
  await supabase.from("audit_events").select("id").eq("action", "Loaded cafeteria").eq("target", "APFoods").limit(1),
  "Cannot inspect history",
);
if (marker.length) {
  console.log("Demo history already loaded.");
} else {
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = (offset = 0) => dayFormat.format(new Date(Date.now() + offset * 86_400_000));
  const at = (day, minutesAfterNoon) =>
    new Date(Date.parse(day + "T12:00:00+08:00") + minutesAfterNoon * 60_000).toISOString();
  const slotStart = (day, slot) => at(day, slot * 15);
  const vendorById = new Map(catalogue.vendors.map((vendor) => [vendor.id, vendor]));
  const slots = new Map();
  const orders = [];
  const ledger = [];
  function addOrder({ id, vendorId, item, quantity, day, slot, status, payment, readyLate }) {
    const vendor = vendorById.get(vendorId);
    const pickupAt = slotStart(day, slot);
    const key = vendorId + "|" + pickupAt;
    const bucket = slots.get(key) ?? {
      vendor_id: vendorId,
      starts_at: pickupAt,
      total_units: vendor.capacity,
      reserved_units: 0,
    };
    bucket.reserved_units += quantity;
    slots.set(key, bucket);
    const collected = status === "collected";
    orders.push({
      id: stableId("order:" + id),
      student_id: userIds.get("student"),
      vendor_id: vendorId,
      zone_id: zoneId(vendor.zone),
      pickup_at: pickupAt,
      status,
      payment,
      lines: [{ itemId: item.id, name: item.name, quantity, extra: false, unit: item.price, work: 1 }],
      total_sen: item.price * quantity,
      units: quantity,
      created_at: at(day, slot * 15 - 25),
      ready_at: collected ? at(day, slot * 15 + (readyLate ? 10 : -5)) : null,
      collected_at: collected ? at(day, slot * 15 + (readyLate ? 12 : 5)) : null,
    });
    if (collected)
      ledger.push({
        vendor_id: vendorId,
        zone_id: zoneId(vendor.zone),
        order_id: stableId("order:" + id),
        kind: payment,
        amount_sen: item.price * quantity,
        label: id + " pickup",
        created_at: at(day, slot * 15 + 5),
      });
  }
  for (let index = 0; index < 14; index += 1) {
    for (const [vendorIndex, vendor] of catalogue.vendors.entries()) {
      const choices = catalogue.items.filter((item) => item.vendorId === vendor.id);
      if (vendor.paused || !choices.length) continue;
      const id = "AP-S" + (1100 + index * 10 + vendorIndex);
      const day = dayKey(-index);
      addOrder({
        id,
        vendorId: vendor.id,
        item: choices[index % choices.length],
        quantity: 1 + ((index + vendorIndex) % 4),
        day,
        slot: 1,
        status: "collected",
        payment: index % 2 ? "counter" : "demo",
        readyLate: (index + vendorIndex) % 5 === 0,
      });
      ledger.push({
        vendor_id: vendor.id,
        zone_id: zoneId(vendor.zone),
        kind: "expense",
        expense_request_key: stableId("expense:" + id),
        amount_sen: 900 + ((index * 137 + vendorIndex * 551) % 1700),
        label: "Ingredients",
        created_at: at(day, 180),
      });
    }
  }
  ledger.push({
    vendor_id: null,
    zone_id: null,
    kind: "expense",
    expense_request_key: stableId("expense:standard-overhead"),
    amount_sen: 1800,
    label: "Shared cleaning supplies",
    created_at: at(dayKey(), 180),
  });
  for (let index = 0; index < 2; index += 1) {
    const item = catalogue.items[index % 3];
    addOrder({
      id: "AP-S" + (1042 + index),
      vendorId: item.vendorId,
      item,
      quantity: 1,
      day: dayKey(),
      slot: 0,
      status: ["placed", "accepted"][index],
      payment: index % 2 ? "counter" : "demo",
      readyLate: false,
    });
  }
  check(await supabase.from("capacity_slots").upsert([...slots.values()]), "Cannot create pickup windows");
  check(await supabase.from("orders").upsert(orders), "Cannot create orders");
  check(await supabase.from("cash_entries").insert(ledger), "Cannot create ledger entries");
  check(
    await supabase
      .from("audit_events")
      .insert({ actor_id: userIds.get("admin"), actor_role: "admin", action: "Loaded cafeteria", target: "APFoods" }),
    "Cannot record history marker",
  );
  console.log("Demo history loaded · " + orders.length + " orders, " + ledger.length + " ledger entries.");
}
console.log("Sign in with any account above using the shared password from supabase/fixtures/demo-accounts.json.");
