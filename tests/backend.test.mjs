import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLocalDemoDb, demoActors, demoStalls } from "./support/local-db.mjs";

const { student, other, vendor, otherVendor, admin } = demoActors;
const { noodleBar, coffeeBar } = demoStalls;
const cart = JSON.stringify([{ itemId: "chicken-noodles", quantity: 1, extra: false }]);

test("backend migrations, role isolation, allocations, pickup and ledger", async (t) => {
  const { db, seedCatalogue, queryAs, call } = await createLocalDemoDb();
  t.after(() => db.close());
  await seedCatalogue();
  const quote = (user = student, stall = noodleBar, items = cart) =>
    call(user, "public.quote_checkout($1,$2)", [stall, items]);
  const order = (user, q, pickup = q.slots[1], key = randomUUID(), payment = "demo") =>
    call(user, "public.place_order($1,$2,$3,$4)", [q.quoteId, pickup, payment, key]);
  const transition = (user, id, status, reason = null) =>
    call(user, "public.transition_order($1,$2,$3)", [id, status, reason]);

  assert.equal((await queryAs(null, "select id from vendors")).length, 10);
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
  await db.query("update private.checkout_quotes set expires_at = now() - interval '1 second' where id = $1", [
    q.quoteId,
  ]);
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
  const collect = (code, confirmed = true) =>
    call(vendor, "public.collect_order($1,$2,$3)", [placed.id, code, confirmed]);
  await assert.rejects(() => collect(before.code), /PICKUP_CODE_INVALID/);
  await assert.rejects(() => collect(pickup.code, false), /COUNTER_CONFIRMATION_REQUIRED/);
  await collect(pickup.code);
  await assert.rejects(() => collect(pickup.code), /PICKUP_ALREADY_USED/);
  assert.deepEqual(await queryAs(admin, "select kind, amount_sen from cash_entries"), [
    { kind: "counter", amount_sen: 900 },
  ]);
  assert.deepEqual(await queryAs(student, "select id from cash_entries"), []);
  assert.equal((await queryAs(vendor, "select id from cash_entries")).length, 1);
  assert.equal((await queryAs(otherVendor, "select id from cash_entries")).length, 0);

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
  await call(vendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
    noodleBar,
    "chicken-noodles",
    "Chicken Noodle Bowl",
    "",
    1200,
    12,
    true,
    1,
    12,
  ]);
  await assert.rejects(() => order(student, editQuote), /PRICE_CHANGED/);

  // Optional work_units (null -> defaults to 1) and dish image persistence/preservation/clearing
  await call(vendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
    noodleBar, "dry-wantan-mee", "Dry Wantan Mee", "Tossed noodles with char siew", 850, 15, true, null, null, "https://example.com/wantan.webp",
  ]);
  const [created] = await queryAs(vendor, "select name, work_units, image from menu_items where id = 'dry-wantan-mee'");
  assert.deepEqual(created, { name: "Dry Wantan Mee", work_units: 1, image: "https://example.com/wantan.webp" });
  await call(vendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
    noodleBar, "dry-wantan-mee", "Dry Wantan Mee Special", "Tossed noodles with char siew", 950, 15, true, null, 15, null,
  ]);
  const [preserved] = await queryAs(vendor, "select name, work_units, image from menu_items where id = 'dry-wantan-mee'");
  assert.deepEqual(preserved, { name: "Dry Wantan Mee Special", work_units: 1, image: "https://example.com/wantan.webp" });
  await call(vendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
    noodleBar, "dry-wantan-mee", "Dry Wantan Mee Special", "Tossed noodles with char siew", 950, 15, true, 2, 15, "",
  ]);
  const [cleared] = await queryAs(vendor, "select work_units, image from menu_items where id = 'dry-wantan-mee'");
  assert.deepEqual(cleared, { work_units: 2, image: "" });
  await assert.rejects(() => call(otherVendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7)", [noodleBar, "hijack", "Hijack", "", 500, 5, true]), /FORBIDDEN/);

  const expenseKey = randomUUID();
  const expense = await call(admin, "public.record_expense($1,$2,$3,$4)", [null, 200, "Supplies", expenseKey]);
  assert.equal(await call(admin, "public.record_expense($1,$2,$3,$4)", [null, 200, "Supplies", expenseKey]), expense);
  await assert.rejects(
    () => call(admin, "public.record_expense($1,$2,$3,$4)", [null, 201, "Supplies", expenseKey]),
    /IDEMPOTENCY_KEY_REUSED/,
  );
  await call(admin, "public.reverse_expense($1,$2)", [expense, "Duplicate"]);
  await assert.rejects(() => call(admin, "public.reverse_expense($1,$2)", [expense, "Again"]), /EXPENSE_UNAVAILABLE/);
  const ledger = await queryAs(admin, "select kind, amount_sen from cash_entries");
  assert.equal(
    ledger.reduce((sum, e) => sum + (e.kind === "expense" ? -e.amount_sen : e.amount_sen), 0),
    900,
  );
  const buckets = await queryAs(null, "select * from public.pickup_activity()");
  assert.ok(buckets.some((row) => row.vendor_id === noodleBar && row.pickup_count === 5 && row.reserved_units === 5));

  await call(admin, "public.admin_manage_vendor($1,$2,$3,$4)", [noodleBar, null, "annex-cafeteria", "Demo relocation"]);
  const recorded = await queryAs(admin, "select zone_id from cash_entries where order_id = $1", [placed.id]);
  assert.deepEqual(recorded, [{ zone_id: "main-food-court" }]);
});
