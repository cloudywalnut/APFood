import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret, AP_FOOD_DEMO_PROJECT_REF: projectRef } = process.env;
if (!projectRef || !url || new URL(url).origin !== "https://" + projectRef + ".supabase.co" || !secret) {
  throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and AP_FOOD_DEMO_PROJECT_REF.");
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

function klDayIso(daysAgo, hour, minute) {
  const now = new Date();
  const klDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  klDate.setDate(klDate.getDate() - daysAgo);
  const y = klDate.getFullYear();
  const m = String(klDate.getMonth() + 1).padStart(2, "0");
  const d = String(klDate.getDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:00+08:00`;
}

// Deterministic pseudo-random generator per vendor/day so seeded data is realistic and reproducible
function seeded(seed) {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

const VENDOR_PROFILES = {
  "campus-noodle-bar": { baseOrders: 18, peakHours: [12, 13, 18], morningBias: false },
  "brew-and-bites": { baseOrders: 22, peakHours: [8, 9, 15], morningBias: true },
  "green-bowl-kitchen": { baseOrders: 16, peakHours: [12, 13, 14], morningBias: false },
  "indian": { baseOrders: 19, peakHours: [12, 13, 19], morningBias: false },
  "arab-shawarma": { baseOrders: 15, peakHours: [13, 14, 18], morningBias: false },
  "drinks-counter": { baseOrders: 24, peakHours: [9, 10, 14, 15], morningBias: true },
  "local-corner-left": { baseOrders: 14, peakHours: [11, 12, 13], morningBias: false },
  "local-corner-right": { baseOrders: 11, peakHours: [12, 13, 16], morningBias: false },
  "western": { baseOrders: 17, peakHours: [12, 13, 18], morningBias: false },
  "fried-chicken": { baseOrders: 20, peakHours: [12, 13, 17], morningBias: false },
};

async function main() {
  const { data: userList, error: userErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (userErr) throw userErr;
  const students = userList.users.filter(u =>
    ["student-a@ap-food-demo.example", "student-b@ap-food-demo.example"].includes(u.email ?? ""),
  );
  if (!students.length) throw new Error("Run seed:demo-users first to create student fixture accounts.");

  const { data: vendors, error: vErr } = await supabase.from("vendors").select("id,name,zone_id,status").eq("status", "approved");
  if (vErr) throw vErr;

  const { data: allMenu, error: mErr } = await supabase.from("menu_items").select("id,vendor_id,name,price_sen,discount_sen,stock,active,work_units").eq("active", true);
  if (mErr) throw mErr;

  let totalInserted = 0;

  for (const [vIndex, vendor] of (vendors ?? []).entries()) {
    const marker = "analytics-v1:" + vendor.id;
    const { data: existingMarker } = await supabase.from("audit_events").select("id").eq("action", "Vendor analytics seeded").eq("target", marker).maybeSingle();
    if (existingMarker) {
      console.log(`Skipping ${vendor.id} (already seeded)`);
      continue;
    }

    const items = (allMenu ?? []).filter(m => m.vendor_id === vendor.id && m.stock > 0);
    if (!items.length) {
      console.log(`Skipping ${vendor.id} (no active menu items)`);
      continue;
    }

    const profile = VENDOR_PROFILES[vendor.id] ?? { baseOrders: 12, peakHours: [12, 13, 15], morningBias: false };
    const rand = seeded(vIndex * 997 + 1337);
    const slotMap = new Map();
    const ordersToInsert = [];
    const cashToInsert = [];

    // Leave the last item as a slow-mover (rarely ordered) so "what should sell" is always meaningful
    const hotItems = items.length > 1 ? items.slice(0, items.length - 1) : items;
    const slowItem = items.length > 1 ? items[items.length - 1] : null;

    for (let i = 0; i < profile.baseOrders; i++) {
      const daysAgo = Math.floor(rand() * 13) + 1; // 1..13 days ago
      const dayOfWeek = new Date(klDayIso(daysAgo, 12, 0)).getDay();
      // Peak hours get 75% of orders; off-peak gets 25%
      const hour = rand() < 0.75
        ? profile.peakHours[Math.floor(rand() * profile.peakHours.length)]
        : (profile.morningBias ? [10, 11, 16][Math.floor(rand() * 3)] : [10, 15, 16][Math.floor(rand() * 3)]);
      const minute = [0, 15, 30, 45][Math.floor(rand() * 4)];

      const createdIso = klDayIso(daysAgo, Math.max(7, hour - 1), minute);
      const pickupIso = klDayIso(daysAgo, hour, minute);
      const readyIso = klDayIso(daysAgo, hour, Math.min(59, minute + 5));
      const collectedIso = klDayIso(daysAgo, hour, Math.min(59, minute + 10));

      // Day-of-week item preference: vary top item by weekday vs weekend/Tue-Thu
      let item;
      if (slowItem && i === profile.baseOrders - 1 && rand() < 0.4) {
        item = slowItem;
      } else if (hotItems.length >= 2 && (dayOfWeek === 2 || dayOfWeek === 4)) {
        item = hotItems[(i + 1) % hotItems.length];
      } else {
        item = hotItems[Math.floor(rand() * Math.min(hotItems.length, 2))];
      }

      const qty = rand() < 0.2 ? 2 : 1;
      const unitPrice = Math.max(100, item.price_sen - item.discount_sen);
      const totalSen = unitPrice * qty;
      const units = Math.max(1, item.work_units * qty);
      const isCancelled = rand() < 0.08;
      const status = isCancelled ? "cancelled" : "collected";
      const payment = rand() < 0.55 ? "counter" : "demo";
      const student = students[i % students.length];
      const orderId = randomUUID();

      const slotKey = `${vendor.id}|${pickupIso}`;
      slotMap.set(slotKey, {
        vendor_id: vendor.id,
        starts_at: pickupIso,
        total_units: 60,
        reserved_units: Math.min(60, (slotMap.get(slotKey)?.reserved_units ?? 0) + (isCancelled ? 0 : units)),
      });

      ordersToInsert.push({
        id: orderId,
        student_id: student.id,
        vendor_id: vendor.id,
        zone_id: vendor.zone_id,
        pickup_at: pickupIso,
        status,
        payment,
        lines: [{ itemId: item.id, name: item.name, quantity: qty, unit: unitPrice, work: item.work_units ?? 1, extra: false }],
        total_sen: totalSen,
        units,
        created_at: createdIso,
        updated_at: isCancelled ? createdIso : collectedIso,
        ready_at: isCancelled ? null : readyIso,
        collected_at: isCancelled ? null : collectedIso,
      });

      if (!isCancelled) {
        cashToInsert.push({
          id: randomUUID(),
          vendor_id: vendor.id,
          zone_id: vendor.zone_id,
          order_id: orderId,
          kind: payment,
          amount_sen: totalSen,
          label: "Collected order receipt",
          created_at: collectedIso,
        });
      }
    }

    const { error: slotErr } = await supabase
      .from("capacity_slots")
      .upsert([...slotMap.values()], { onConflict: "vendor_id,starts_at", ignoreDuplicates: true });
    if (slotErr) throw slotErr;

    const { error: ordErr } = await supabase.from("orders").insert(ordersToInsert);
    if (ordErr) throw ordErr;

    if (cashToInsert.length) {
      const { error: cashErr } = await supabase.from("cash_entries").insert(cashToInsert);
      if (cashErr) throw cashErr;
    }

    const { error: auditErr } = await supabase.from("audit_events").insert({
      actor_id: students[0].id,
      actor_role: "admin",
      action: "Vendor analytics seeded",
      target: marker,
      reason: `Seeded ${ordersToInsert.length} historical orders for ${vendor.id}`,
    });
    if (auditErr) throw auditErr;

    totalInserted += ordersToInsert.length;
    console.log(`Seeded ${ordersToInsert.length} orders for ${vendor.id}`);
  }

  console.log(`Done. Total historical orders inserted: ${totalInserted}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
