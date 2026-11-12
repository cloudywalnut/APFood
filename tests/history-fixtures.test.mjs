import assert from "node:assert/strict";
import test from "node:test";
import { historyMonth, historySql, monthKeys } from "../scripts/history-fixtures.mjs";
import { createLocalDemoDb, demoActors } from "./support/local-db.mjs";

const config = {
  project: "demo-project", start: "2024-02-01", end: "2024-02-29", recentStart: "2024-02-20", recentPerDay: 3,
  students: [{ id: demoActors.student }], adminId: demoActors.admin,
  vendors: [{ id: "campus-noodle-bar", name: "Chinese", zone_id: "zone-a", category: "Noodles", capacity: 24, lead_minutes: 10, opens_at: "08:00", closes_at: "23:00" }],
  menu: [{ id: "chicken-noodles", vendor_id: "campus-noodle-bar", name: "Chicken noodles", price_sen: 1100, discount_sen: 100, work_units: 1 }],
};

test("historical plans are deterministic, calendar-correct and financially reconciled", () => {
  const plan = historyMonth(config, "2024-02");
  assert.deepEqual(plan, historyMonth(config, "2024-02"));
  assert.ok(plan.orders.some(order => order.created_at.startsWith("2024-02-29")));
  assert.ok(plan.orders.every(order => Date.parse(order.created_at) < Date.parse(order.pickup_at)));
  assert.ok(plan.orders.every(order => ["collected", "cancelled", "rejected"].includes(order.status)));
  const receipts = plan.cash.filter(entry => entry.order_id);
  for (const order of plan.orders) {
    assert.equal(order.total_sen, order.lines.reduce((sum, line) => sum + line.unit * line.quantity, 0));
    const matching = receipts.filter(entry => entry.order_id === order.id);
    assert.equal(matching.length, order.status === "collected" ? 1 : 0);
    if (matching.length) assert.equal(matching[0].amount_sen, order.total_sen);
  }
  assert.ok(plan.orders.filter(order => order.created_at.slice(0, 10) >= "2024-02-20").length <= 10 * 3);
  assert.deepEqual(monthKeys("2023-12-10", "2024-02-29"), ["2023-12", "2024-01", "2024-02"]);
});

test("monthly SQL imports atomically, skips repeats and restores notifications after success or failure", async () => {
  const local = await createLocalDemoDb();
  const db = local.db;
  try {
    const vendor = (await db.query("select * from public.vendors where id='campus-noodle-bar'")).rows[0];
    const item = (await db.query("select * from public.menu_items where vendor_id=$1 limit 1", [vendor.id])).rows[0];
    const plan = historyMonth({ ...config, vendors: [vendor], menu: [item] }, "2024-02");
    const before = Number((await db.query("select count(*) n from public.orders")).rows[0].n);
    await db.exec(historySql(plan));
    const count = Number((await db.query("select count(*) n from public.orders")).rows[0].n);
    assert.equal(count, before + plan.orders.length);
    const reserved = (await db.query("select sum(reserved_units) n from public.capacity_slots")).rows[0].n;
    await db.exec(historySql(plan));
    assert.equal(Number((await db.query("select count(*) n from public.orders")).rows[0].n), count);
    assert.equal((await db.query("select sum(reserved_units) n from public.capacity_slots")).rows[0].n, reserved);
    const broken = structuredClone(historyMonth({ ...config, start: "2024-03-01", end: "2024-03-31", vendors: [vendor], menu: [item] }, "2024-03"));
    broken.orders[0].student_id = "00000000-0000-4000-8000-000000009999";
    await assert.rejects(db.exec(historySql(broken)), /foreign key/i);
    assert.equal(Number((await db.query("select count(*) n from public.orders")).rows[0].n), count);
    assert.equal((await db.query("select tgenabled from pg_trigger where tgname='ap_food_order_changed'")).rows[0].tgenabled, "O");
    assert.equal((await db.query("select sum(reserved_units) n from public.capacity_slots")).rows[0].n, reserved);
    assert.equal(Number((await db.query("select count(*) n from realtime.messages")).rows[0].n), 0);
  } finally { await db.close(); }
});
