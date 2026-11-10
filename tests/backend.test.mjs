import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const student = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const vendor = "00000000-0000-4000-8000-000000000003";
const otherVendor = "00000000-0000-4000-8000-000000000004";
const admin = "00000000-0000-4000-8000-000000000005";
const noodleBar = "campus-noodle-bar";
const coffeeBar = "brew-and-bites";
const cart = JSON.stringify([{ itemId: "chicken-noodles", quantity: 1, extra: false }]);

test("backend migrations, role isolation, allocations, pickup and ledger", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create schema realtime;
    grant usage on schema realtime to authenticated;
    create table realtime.messages (topic text, event text, extension text, payload jsonb);
    alter table realtime.messages enable row level security;
    grant select on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$
      select current_setting('realtime.topic', true);
    $$;
    create function realtime.send(payload jsonb, event text, topic text, private boolean)
    returns void language sql as $$
      insert into realtime.messages values (topic, event, 'broadcast', payload);
    $$;
  `);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(directory)).sort()) await db.exec(await readFile(new URL(name, directory), "utf8"));
  const seed = await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  await db.exec(seed);
  await db.exec(seed);
  for (const [user, role, stall] of [[student, "student", null], [other, "student", null], [vendor, "vendor", noodleBar], [otherVendor, "vendor", coffeeBar], [admin, "admin", null]]) {
    await db.query("insert into auth.users values ($1)", [user]);
    await db.query("insert into public.memberships values ($1,$2,$3)", [user, role, stall]);
  }

  async function queryAs(user, sql, args = [], topic) {
    await db.exec("begin; set local role " + (user ? "authenticated" : "anon"));
    try {
      if (user) await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
      if (topic) await db.query("select set_config('realtime.topic', $1, true)", [topic]);
      const result = await db.query(sql, args);
      await db.exec("commit");
      return result.rows;
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  }
  const call = async (user, sql, args) => (await queryAs(user, "select " + sql + " as value", args))[0].value;
  const quote = (user = student, stall = noodleBar, items = cart) => call(user, "public.quote_checkout($1,$2)", [stall, items]);
  const order = (user, q, pickup = q.slots[1], key = randomUUID(), payment = "demo") =>
    call(user, "public.place_order($1,$2,$3,$4)", [q.quoteId, pickup, payment, key]);
  const transition = (user, id, status, reason = null) => call(user, "public.transition_order($1,$2,$3)", [id,status,reason]);

  assert.equal((await queryAs(null, "select id from vendors")).length, 3);
  await assert.rejects(() => queryAs(null, "select id from orders"), /permission denied/);
  await assert.rejects(() => quote(vendor), /FORBIDDEN/);
  await assert.rejects(() => queryAs(student, "select * from private.pickup_codes"), /permission denied/);
  await assert.rejects(() => queryAs(student, "update menu_items set stock = 999"), /permission denied/);

  const q = await quote();
  assert.equal(q.totalSen, 900);
  assert.ok(q.slots.length >= 3);
  await assert.rejects(() => order(other, q), /QUOTE_EXPIRED/);
  const key = randomUUID();
  const placed = await order(student, q, q.slots[1], key, "counter");
  const vendorTopic = "ap-food:vendor:" + noodleBar;
  const studentTopic = "ap-food:student:" + student;
  assert.deepEqual(await queryAs(vendor, "select payload from realtime.messages", [], vendorTopic), [{ payload: {} }]);
  assert.equal((await queryAs(student, "select payload from realtime.messages", [], studentTopic)).length, 1);
  assert.equal((await queryAs(other, "select payload from realtime.messages", [], studentTopic)).length, 0);
  assert.equal((await queryAs(otherVendor, "select payload from realtime.messages", [], vendorTopic)).length, 0);
  await assert.rejects(() => order(student, q), /QUOTE_USED/);
  await db.query("update private.checkout_quotes set expires_at = now() - interval '1 second' where id = $1", [q.quoteId]);
  assert.deepEqual(await order(student, q, q.slots[1], key, "counter"), placed);
  await assert.rejects(() => order(student, q, q.slots[2], key, "counter"), /IDEMPOTENCY_KEY_REUSED/);
  await assert.rejects(() => order(student, q), /QUOTE_EXPIRED/);

  assert.equal((await queryAs(other, "select id from orders")).length, 0);
  assert.equal((await queryAs(otherVendor, "select id from orders")).length, 0);
  assert.equal((await queryAs(vendor, "select id from orders")).length, 1);
  await assert.rejects(() => transition(otherVendor, placed.id, "accepted"), /ORDER_NOT_FOUND/);
  await assert.rejects(() => transition(vendor, placed.id, "ready"), /INVALID_TRANSITION/);
  for (const stage of ["accepted", "preparing", "ready"]) await transition(vendor, placed.id, stage);
  await assert.rejects(() => call(other, "public.issue_pickup_code($1)", [placed.id]), /ORDER_NOT_FOUND/);
  const before = await call(student, "public.issue_pickup_code($1)", [placed.id]);
  const pickup = await call(student, "public.issue_pickup_code($1)", [placed.id]);
  assert.match(pickup.code, /^[A-F0-9]{32}$/);
  const collect = (code, confirmed = true) => call(vendor, "public.collect_order($1,$2,$3)", [placed.id,code,confirmed]);
  await assert.rejects(() => collect(before.code), /PICKUP_CODE_INVALID/);
  await assert.rejects(() => collect(pickup.code, false), /COUNTER_CONFIRMATION_REQUIRED/);
  await collect(pickup.code);
  await assert.rejects(() => collect(pickup.code), /PICKUP_ALREADY_USED/);
  assert.deepEqual(await queryAs(admin, "select kind, amount_sen from cash_entries"), [{ kind: "counter", amount_sen: 900 }]);
  assert.deepEqual(await queryAs(student, "select id from cash_entries"), []);

  const capacityQuotes = [];
  for (let n = 0; n < 6; n++) capacityQuotes.push(await quote());
  const target = capacityQuotes[0].slots[2];
  const allocated = [];
  for (const entry of capacityQuotes.slice(0, 5)) allocated.push(await order(student, entry, target));
  await assert.rejects(() => order(student, capacityQuotes[5], target), /SLOT_UNAVAILABLE/);
  await transition(student, allocated[0].id, "cancelled");
  await assert.rejects(() => transition(student, allocated[0].id, "cancelled"), /INVALID_TRANSITION/);
  await order(student, capacityQuotes[5], target);

  await db.query("update menu_items set stock = 1 where id = 'iced-coffee'");
  const coffee = JSON.stringify([{ itemId: "iced-coffee", quantity: 1, extra: false }]);
  const one = await quote(student, coffeeBar, coffee);
  const two = await quote(other, coffeeBar, coffee);
  assert.equal(one.totalSen, 550);
  await order(student, one);
  await assert.rejects(() => order(other, two), /OUT_OF_STOCK/);

  const editQuote = await quote();
  await call(vendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9)", [noodleBar, "chicken-noodles", "Chicken Noodle Bowl", "", 1200, 12, true, 1, 12]);
  await assert.rejects(() => order(student, editQuote), /PRICE_CHANGED/);

  const expenseKey = randomUUID();
  const expense = await call(admin, "public.record_expense($1,$2,$3,$4)", [null, 200, "Supplies", expenseKey]);
  assert.equal(await call(admin, "public.record_expense($1,$2,$3,$4)", [null, 200, "Supplies", expenseKey]), expense);
  await assert.rejects(() => call(admin, "public.record_expense($1,$2,$3,$4)", [null, 201, "Supplies", expenseKey]), /IDEMPOTENCY_KEY_REUSED/);
  await call(admin, "public.reverse_expense($1,$2)", [expense, "Duplicate"]);
  await assert.rejects(() => call(admin, "public.reverse_expense($1,$2)", [expense, "Again"]), /EXPENSE_UNAVAILABLE/);
  const ledger = await queryAs(admin, "select kind, amount_sen from cash_entries");
  assert.equal(ledger.reduce((sum, e) => sum + (e.kind === "expense" ? -e.amount_sen : e.amount_sen), 0), 900);
  const buckets = await queryAs(null, "select * from public.pickup_activity()");
  assert.ok(buckets.some(row => row.vendor_id === noodleBar && row.pickup_count === 5 && row.reserved_units === 5));

  await call(admin, "public.admin_manage_vendor($1,$2,$3,$4)", [noodleBar, null, "annex-cafeteria", "Demo relocation"]);
  const recorded = await queryAs(admin, "select zone_id from cash_entries where order_id = $1", [placed.id]);
  assert.deepEqual(recorded, [{ zone_id: "main-food-court" }]);
});
