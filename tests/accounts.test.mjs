import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createLocalDemoDb, demoActors, demoStalls } from "./support/local-db.mjs";

test("vendor membership disables student RPCs and personal student rows, preserving assigned stall access", async (t) => {
  const { db, call, queryAs } = await createLocalDemoDb();
  t.after(() => db.close());
  const { student, other, vendor } = demoActors;
  const { noodleBar, coffeeBar } = demoStalls;
  const noodles = JSON.stringify([{ itemId: "chicken-noodles", quantity: 1, extra: false }]);
  const coffee = JSON.stringify([{ itemId: "iced-coffee", quantity: 1, extra: false }]);
  await call(student, "public.save_cart($1,$2,$3)", [coffeeBar, coffee, 0]);
  const offer = await call(student, "public.quote_checkout($1,$2)", [coffeeBar, coffee]);
  const personal = await call(student, "public.place_order($1,$2,$3,$4)", [
    offer.quoteId,
    offer.slots[1],
    "demo",
    randomUUID(),
  ]);
  const unused = await call(student, "public.quote_checkout($1,$2)", [coffeeBar, coffee]);
  const assigned = await call(other, "public.quote_checkout($1,$2)", [noodleBar, noodles]);
  const kitchen = await call(other, "public.place_order($1,$2,$3,$4)", [
    assigned.quoteId,
    assigned.slots[1],
    "demo",
    randomUUID(),
  ]);
  await db.query("insert into public.memberships (user_id, role, vendor_id) values ($1, 'vendor', $2)", [
    student,
    noodleBar,
  ]);
  await assert.rejects(() => call(student, "public.quote_checkout($1,$2)", [coffeeBar, coffee]), /FORBIDDEN/);
  await assert.rejects(
    () => call(student, "public.place_order($1,$2,$3,$4)", [unused.quoteId, unused.slots[1], "demo", randomUUID()]),
    /FORBIDDEN/,
  );
  await assert.rejects(() => call(student, "public.save_cart($1,$2,$3)", [coffeeBar, coffee, 1]), /FORBIDDEN/);
  await assert.rejects(() => call(student, "public.checkout_basket($1,$2,$3)", ["[]", randomUUID(), 1]), /FORBIDDEN/);
  await assert.rejects(() => call(student, "public.issue_pickup_code($1)", [personal.id]), /FORBIDDEN/);
  await assert.rejects(() => call(student, "public.claim_qr_payment($1)", [personal.id]), /ORDER_NOT_FOUND/);
  assert.deepEqual(await queryAs(student, "select id from public.orders"), [{ id: kitchen.id }]);
  assert.deepEqual(await queryAs(student, "select * from public.carts"), []);
  await call(student, "public.transition_order($1,$2)", [kitchen.id, "accepted"]);
  await assert.rejects(
    () => call(student, "public.transition_order($1,$2)", [personal.id, "cancelled"]),
    /ORDER_NOT_FOUND/,
  );
  // The original vendor's stall membership remains valid as well.
  assert.equal((await queryAs(vendor, "select id from public.orders")).length, 1);
});

test("account policies, persistent cart conflicts, QR payment, cancellation, and expiry", async (t) => {
  const { db, call, queryAs } = await createLocalDemoDb();
  t.after(() => db.close());
  const { student, other, vendor, admin } = demoActors;
  const { noodleBar } = demoStalls;
  const items = JSON.stringify([{ itemId: "chicken-noodles", quantity: 1, extra: false }]);
  const saved = await call(student, "public.save_cart($1,$2,$3)", [noodleBar, items, 0]);
  assert.equal(saved.revision, 1);
  await assert.rejects(() => call(student, "public.save_cart($1,$2,$3)", [noodleBar, items, 0]), /CART_CHANGED/);
  assert.equal((await queryAs(other, "select * from public.carts")).length, 0);
  const quote = () => call(student, "public.quote_checkout($1,$2)", [noodleBar, items]);
  const offer = await quote();
  const target = offer.slots.at(-2);
  await db.exec("update private.app_settings set qr_demo_enabled = true");
  await call(vendor, "public.save_vendor_payment($1,$2,$3)", [
    noodleBar,
    "Noodle Bar",
    noodleBar + "/" + randomUUID() + ".png",
  ]);
  const key = randomUUID();
  const order = await call(student, "public.checkout_cart($1,$2,$3,$4,$5)", [
    offer.quoteId,
    target,
    "duitnow_qr",
    key,
    1,
  ]);
  assert.equal((await queryAs(student, "select revision from public.carts"))[0].revision, 2);
  await call(student, "public.save_cart($1,$2,$3)", [noodleBar, items, 2]);
  assert.deepEqual(
    await call(student, "public.checkout_cart($1,$2,$3,$4,$5)", [offer.quoteId, target, "duitnow_qr", key, 1]),
    order,
  );
  assert.equal((await queryAs(student, "select revision from public.carts"))[0].revision, 3);
  await assert.rejects(() => call(other, "public.claim_qr_payment($1)", [order.id]), /ORDER_NOT_FOUND/);
  await assert.rejects(
    () => call(vendor, "public.transition_order($1,$2)", [order.id, "accepted"]),
    /PAYMENT_REQUIRED/,
  );
  await call(student, "public.claim_qr_payment($1)", [order.id]);
  await call(student, "public.claim_qr_payment($1)", [order.id]);
  await call(vendor, "public.transition_order($1,$2)", [order.id, "accepted"]);
  await call(student, "public.transition_order($1,$2)", [order.id, "cancelled"]);
  assert.equal(
    (await queryAs(student, "select status from public.order_payments where order_id=$1", [order.id]))[0].status,
    "refund_pending",
  );
  await call(vendor, "public.record_refund($1,$2)", [order.id, "BANK-REF-1"]);
  await assert.rejects(
    () => call(vendor, "public.record_refund($1,$2)", [order.id, "BANK-REF-1"]),
    /INVALID_TRANSITION/,
  );
  assert.equal((await queryAs(admin, "select * from public.cash_entries")).length, 0);

  const expiring = await quote();
  const unpaid = await call(student, "public.place_order($1,$2,$3,$4)", [
    expiring.quoteId,
    target,
    "duitnow_qr",
    randomUUID(),
  ]);
  await db.query("update public.order_payments set expires_at = now() - interval '1 second' where order_id=$1", [
    unpaid.id,
  ]);
  assert.equal((await db.query("select private.expire_qr_orders() as n")).rows[0].n, 1);
  assert.equal((await db.query("select private.expire_qr_orders() as n")).rows[0].n, 0);
  await assert.rejects(() => call(student, "public.claim_qr_payment($1)", [unpaid.id]), /PAYMENT_EXPIRED/);
  assert.equal((await queryAs(null, "select stock from public.menu_items where id='chicken-noodles'"))[0].stock, 18);

  const paidOffer = await quote();
  const paid = await call(student, "public.place_order($1,$2,$3,$4)", [
    paidOffer.quoteId,
    target,
    "duitnow_qr",
    randomUUID(),
  ]);
  await call(student, "public.claim_qr_payment($1)", [paid.id]);
  for (const stage of ["accepted", "preparing", "ready"])
    await call(vendor, "public.transition_order($1,$2)", [paid.id, stage]);
  const code = await call(student, "public.issue_pickup_code($1)", [paid.id]);
  await call(vendor, "public.collect_order($1,$2,$3)", [paid.id, code.code, false]);
  assert.deepEqual(await queryAs(admin, "select kind,amount_sen from public.cash_entries"), [
    { kind: "duitnow_qr", amount_sen: 900 },
  ]);

  await assert.rejects(
    () =>
      call(student, "public.manage_account($1,$2,$3,$4)", [
        student,
        "active",
        '[{"role":"admin","vendor_id":null}]',
        "Escalation",
      ]),
    /FORBIDDEN/,
  );
  await assert.rejects(
    () =>
      call(admin, "public.manage_account($1,$2,$3,$4)", [
        admin,
        "suspended",
        '[{"role":"admin","vendor_id":null}]',
        "Suspend",
      ]),
    /LAST_ADMIN/,
  );
  await call(admin, "public.manage_account($1,$2,$3,$4)", [
    student,
    "suspended",
    '[{"role":"student","vendor_id":null}]',
    "Access review",
  ]);
  await assert.rejects(() => quote(), /FORBIDDEN/);
  assert.equal((await queryAs(student, "select * from public.orders")).length, 0);
  assert.equal((await queryAs(student, "select * from public.carts")).length, 0);
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [other]);
  await assert.rejects(() => call(other, "public.quote_checkout($1,$2)", [noodleBar, items]), /FORBIDDEN/);
});
