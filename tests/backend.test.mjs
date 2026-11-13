import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLocalDemoDb, demoActors, demoStalls } from "./support/local-db.mjs";

const { student, other, vendor, otherVendor, admin } = demoActors;
const { noodleBar, coffeeBar } = demoStalls;
const cart = JSON.stringify([{ itemId: "chicken-noodles", quantity: 1, extra: false }]);

test("pickup credentials preserve leading zeroes, expire, and accept in-flight legacy tokens once", async (t) => {
  const { db, seedCatalogue, call } = await createLocalDemoDb();
  t.after(() => db.close());
  await seedCatalogue();
  for (const credential of ["01234567", "A".repeat(32)]) {
    const quote = await call(student, "public.quote_checkout($1,$2)", [noodleBar, cart]);
    const order = await call(student, "public.place_order($1,$2,$3,$4)", [
      quote.quoteId,
      quote.slots[1],
      "counter",
      randomUUID(),
    ]);
    for (const stage of ["accepted", "preparing", "ready"]) {
      await call(vendor, "public.transition_order($1,$2,$3)", [order.id, stage, null]);
    }
    const issued = await call(student, "public.issue_pickup_code($1)", [order.id]);
    assert.match(issued.code, /^\d{8}$/);
    await db.query("update private.pickup_codes set expires_at=now()-interval '1 second' where order_id=$1", [
      order.id,
    ]);
    await assert.rejects(
      () => call(vendor, "public.collect_order($1,$2,$3)", [order.id, issued.code, true]),
      /PICKUP_CODE_INVALID/,
    );
    // Force credentials that random generation cannot reliably produce in a test.
    await db.query(
      "update private.pickup_codes set code_hash=sha256(convert_to($2,'UTF8')),expires_at=now()+interval '5 minutes' where order_id=$1",
      [order.id, credential],
    );
    await call(vendor, "public.collect_order($1,$2,$3)", [order.id, credential, true]);
    await assert.rejects(
      () => call(vendor, "public.collect_order($1,$2,$3)", [order.id, credential, true]),
      /PICKUP_ALREADY_USED/,
    );
    const { rows } = await db.query("select count(*)::int receipts from public.cash_entries where order_id=$1", [
      order.id,
    ]);
    assert.equal(rows[0].receipts, 1);
  }
});

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
  assert.match(pickup.code, /^[0-9]{8}$/);
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
    noodleBar,
    "dry-wantan-mee",
    "Dry Wantan Mee",
    "Tossed noodles with char siew",
    850,
    15,
    true,
    null,
    null,
    "https://example.com/wantan.webp",
  ]);
  const [created] = await queryAs(vendor, "select name, work_units, image from menu_items where id = 'dry-wantan-mee'");
  assert.deepEqual(created, { name: "Dry Wantan Mee", work_units: 1, image: "https://example.com/wantan.webp" });
  await call(vendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
    noodleBar,
    "dry-wantan-mee",
    "Dry Wantan Mee Special",
    "Tossed noodles with char siew",
    950,
    15,
    true,
    null,
    15,
    null,
  ]);
  const [preserved] = await queryAs(
    vendor,
    "select name, work_units, image from menu_items where id = 'dry-wantan-mee'",
  );
  assert.deepEqual(preserved, {
    name: "Dry Wantan Mee Special",
    work_units: 1,
    image: "https://example.com/wantan.webp",
  });
  await call(vendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [
    noodleBar,
    "dry-wantan-mee",
    "Dry Wantan Mee Special",
    "Tossed noodles with char siew",
    950,
    15,
    true,
    2,
    15,
    "",
  ]);
  const [cleared] = await queryAs(vendor, "select work_units, image from menu_items where id = 'dry-wantan-mee'");
  assert.deepEqual(cleared, { work_units: 2, image: "" });
  await assert.rejects(
    () =>
      call(otherVendor, "public.save_menu_item($1,$2,$3,$4,$5,$6,$7)", [
        noodleBar,
        "hijack",
        "Hijack",
        "",
        500,
        5,
        true,
      ]),
    /FORBIDDEN/,
  );

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

test("orders can be cancelled across all stages (placed, accepted, preparing, ready)", async (t) => {
  const { db, seedCatalogue, queryAs, call } = await createLocalDemoDb();
  t.after(() => db.close());
  await seedCatalogue();
  const quote = (user = student, stall = noodleBar, items = cart) =>
    call(user, "public.quote_checkout($1,$2)", [stall, items]);
  const order = (user, q, pickup = q.slots[1], key = randomUUID(), payment = "demo") =>
    call(user, "public.place_order($1,$2,$3,$4)", [q.quoteId, pickup, payment, key]);
  const transition = (user, id, status, reason = null) =>
    call(user, "public.transition_order($1,$2,$3)", [id, status, reason]);

  // Stage 1: Placed - student can cancel
  const q1 = await quote();
  const o1 = await order(student, q1);
  await transition(student, o1.id, "cancelled");
  assert.equal((await queryAs(vendor, "select status from orders where id = $1", [o1.id]))[0].status, "cancelled");
  // Cannot re-cancel already cancelled order
  await assert.rejects(() => transition(student, o1.id, "cancelled"), /INVALID_TRANSITION/);

  // Stage 2: Accepted - student can cancel
  const q2 = await quote();
  const o2 = await order(student, q2);
  await transition(vendor, o2.id, "accepted");
  await transition(student, o2.id, "cancelled");
  assert.equal((await queryAs(vendor, "select status from orders where id = $1", [o2.id]))[0].status, "cancelled");

  // Stage 3: Preparing - student can cancel
  const q3 = await quote();
  const o3 = await order(student, q3);
  await transition(vendor, o3.id, "accepted");
  await transition(vendor, o3.id, "preparing");
  await transition(student, o3.id, "cancelled");
  assert.equal((await queryAs(vendor, "select status from orders where id = $1", [o3.id]))[0].status, "cancelled");

  // Stage 4: Ready - student can cancel, and pickup code is cleared
  const q4 = await quote();
  const o4 = await order(student, q4);
  await transition(vendor, o4.id, "accepted");
  await transition(vendor, o4.id, "preparing");
  await transition(vendor, o4.id, "ready");
  const code = await call(student, "public.issue_pickup_code($1)", [o4.id]);
  assert.match(code.code, /^[0-9]{8}$/);
  await transition(student, o4.id, "cancelled");
  assert.equal((await queryAs(vendor, "select status from orders where id = $1", [o4.id]))[0].status, "cancelled");
  // Collection fails because order is cancelled
  await assert.rejects(
    () => call(vendor, "public.collect_order($1,$2,$3)", [o4.id, code.code, true]),
    /INVALID_TRANSITION/,
  );

  // Vendor cancellation at ready stage requires reason and succeeds
  const q5 = await quote();
  const o5 = await order(student, q5);
  await transition(vendor, o5.id, "accepted");
  await transition(vendor, o5.id, "preparing");
  await transition(vendor, o5.id, "ready");
  await assert.rejects(() => transition(vendor, o5.id, "cancelled"), /REASON_REQUIRED/);
  await transition(vendor, o5.id, "cancelled", "Customer requested cancellation at counter");
  assert.equal((await queryAs(vendor, "select status from orders where id = $1", [o5.id]))[0].status, "cancelled");

  // Vendor cancellation at placed stage requires reason and succeeds
  const q6 = await quote();
  const o6 = await order(student, q6);
  await transition(vendor, o6.id, "cancelled", "Kitchen overloaded");
  assert.equal((await queryAs(vendor, "select status from orders where id = $1", [o6.id]))[0].status, "cancelled");

  // Collected orders cannot be cancelled by either party
  const q7 = await quote();
  const o7 = await order(student, q7);
  await transition(vendor, o7.id, "accepted");
  await transition(vendor, o7.id, "preparing");
  await transition(vendor, o7.id, "ready");
  const code7 = await call(student, "public.issue_pickup_code($1)", [o7.id]);
  await call(vendor, "public.collect_order($1,$2,$3)", [o7.id, code7.code, true]);
  assert.equal((await queryAs(vendor, "select status from orders where id = $1", [o7.id]))[0].status, "collected");
  await assert.rejects(() => transition(student, o7.id, "cancelled"), /INVALID_TRANSITION/);
  await assert.rejects(() => transition(vendor, o7.id, "cancelled", "After pickup"), /INVALID_TRANSITION/);

  // Vendor cancellation at ready stage deletes issued pickup codes
  const q8 = await quote();
  const o8 = await order(student, q8);
  await transition(vendor, o8.id, "accepted");
  await transition(vendor, o8.id, "preparing");
  await transition(vendor, o8.id, "ready");
  const code8 = await call(student, "public.issue_pickup_code($1)", [o8.id]);
  assert.match(code8.code, /^[0-9]{8}$/);
  await transition(vendor, o8.id, "cancelled", "Out of containers");
  const { rows: codes8 } = await db.query("select * from private.pickup_codes where order_id = $1", [o8.id]);
  assert.equal(codes8.length, 0);
  await assert.rejects(() => call(student, "public.issue_pickup_code($1)", [o8.id]), /INVALID_TRANSITION/);

  // Cancellation of paid DuitNow QR order at ready stage moves payment to refund_pending
  await db.exec("update private.app_settings set qr_demo_enabled = true");
  await call(vendor, "public.save_vendor_payment($1,$2,$3)", [
    noodleBar,
    "Noodle Bar",
    noodleBar + "/" + randomUUID() + ".png",
  ]);
  const q9 = await quote();
  const o9 = await order(student, q9, q9.slots[1], randomUUID(), "duitnow_qr");
  await call(student, "public.claim_qr_payment($1)", [o9.id]);
  await transition(vendor, o9.id, "accepted");
  await transition(vendor, o9.id, "preparing");
  await transition(vendor, o9.id, "ready");
  await transition(student, o9.id, "cancelled");
  const [payRecord] = await queryAs(student, "select status from public.order_payments where order_id = $1", [o9.id]);
  assert.equal(payRecord.status, "refund_pending");
});
