import test from "node:test";
import assert from "node:assert/strict";
import { createLocalDemoDb, demoActors } from "./support/local-db.mjs";
test("admin aggregates reconcile ledger, include older active orders and reject other roles", async () => {
  const local = await createLocalDemoDb();
  try {
    const vendor = (await local.db.query("select id,zone_id from public.vendors where id='campus-noodle-bar'")).rows[0];
    const pickup = new Date(Date.now() - 3600000).toISOString(),
      old = new Date(Date.now() - 20 * 86400000).toISOString();
    await local.db.query(
      "insert into public.capacity_slots(vendor_id,starts_at,total_units,reserved_units) values($1,$2,24,2)",
      [vendor.id, pickup],
    );
    const lines = JSON.stringify([{ itemId: "chicken-noodles", name: "Noodles", quantity: 1, unit: 1000 }]);
    const ids = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"];
    for (const [i, id] of ids.entries())
      await local.db.query(
        "insert into public.orders(id,student_id,vendor_id,zone_id,pickup_at,status,payment,lines,total_sen,units,created_at,collected_at)values($1,$2,$3,$4,$5,$6,'counter',$7,1000,1,$8,$9)",
        [
          id,
          demoActors.student,
          vendor.id,
          vendor.zone_id,
          pickup,
          i ? "preparing" : "collected",
          lines,
          i ? old : new Date().toISOString(),
          i ? null : new Date().toISOString(),
        ],
      );
    await local.db.query(
      "insert into public.cash_entries(vendor_id,zone_id,order_id,kind,amount_sen,label)values($1,$2,$3,'counter',1000,'Receipt')",
      [vendor.id, vendor.zone_id, ids[0]],
    );
    await local.db.query(
      "insert into public.cash_entries(kind,amount_sen,label,expense_request_key)values('expense',300,'Shared',gen_random_uuid())",
    );
    const value = await local.call(demoActors.admin, "public.admin_overview(7)");
    assert.equal(value.summary.orders, 1);
    assert.equal(value.summary.active, 1);
    assert.equal(value.summary.receiptsSen, 1000);
    assert.equal(value.summary.netSen, 700);
    assert.equal(value.summary.sharedNetSen, -300);
    assert.equal(
      value.daily.reduce((n, row) => n + row.netSen, 0),
      value.summary.netSen,
    );
    const stall = value.vendors.find((v) => v.id === vendor.id);
    assert.equal(stall.overdueCount, 1);
    assert.equal(stall.netSen, 1000);
    const scoped = await local.call(demoActors.admin, "public.admin_overview(7,$1)", [vendor.id]);
    assert.equal(scoped.summary.netSen, 1000);
    assert.equal(scoped.summary.sharedNetSen, 0);
    for (const user of [null, demoActors.student, demoActors.vendor])
      await assert.rejects(local.call(user, "public.admin_overview(7)"), /FORBIDDEN|permission denied/);
    await assert.rejects(local.call(demoActors.admin, "public.admin_overview(365)"), /INVALID_PERIOD/);
    const detail = await local.call(demoActors.admin, "public.admin_vendor_overview($1,7)", [vendor.id]);
    assert.ok(detail.staff.some((p) => p.id === demoActors.vendor));
    const accounts = await local.call(demoActors.admin, "public.admin_vendor_accounts($1)", [vendor.id]);
    assert.equal(accounts.total, 1);
    const payment = await local.call(demoActors.admin, "public.admin_payment_summary($1,$2)", [
      value.since,
      value.asOf,
    ]);
    assert.equal(payment.counterSen, 1000);
    assert.equal(payment.outstandingCounterSen, 1000);
    const events = await local.call(demoActors.admin, "public.admin_audit_page(1)");
    assert.ok(Array.isArray(events.events));
    const expense = await local.call(demoActors.admin, "public.record_expense($1,200,'Vendor supplies',$2)", [
      vendor.id,
      "10000000-0000-4000-8000-000000000003",
    ]);
    const spent = await local.call(demoActors.admin, "public.admin_overview(7)");
    assert.equal(spent.summary.netSen, 500);
    await local.call(demoActors.admin, "public.reverse_expense($1,'Correct verification posting')", [expense]);
    const reversed = await local.call(demoActors.admin, "public.admin_overview(7)");
    assert.equal(reversed.summary.netSen, 700);
    assert.equal(reversed.summary.reversalSen, 200);
    await assert.rejects(
      local.call(demoActors.admin, "public.reverse_expense($1,'Duplicate')", [expense]),
      /EXPENSE_UNAVAILABLE/,
    );
    const evidenceUntil = new Date(Date.now() + 5000).toISOString();
    await local.db.query(
      "insert into public.orders(id,student_id,vendor_id,zone_id,pickup_at,status,payment,lines,total_sen,units)values('10000000-0000-4000-8000-000000000004',$1,$2,$3,$4,'cancelled','counter',$5,2000,1)",
      [
        demoActors.student,
        vendor.id,
        vendor.zone_id,
        pickup,
        JSON.stringify([{ itemId: "chicken-noodles", name: "Noodles", quantity: 1, unit: 2000 }]),
      ],
    );
    const intelligence = await local.call(demoActors.admin, "public.admin_intelligence_evidence($1,$2)", [
      value.since,
      evidenceUntil,
    ]);
    const orderValue = intelligence.vendors.find((v) => v.vendorId === vendor.id);
    assert.equal(orderValue.unsuccessfulValueSen, 2000);
    assert.equal(orderValue.receiptedOrders, 1);
    assert.equal(orderValue.averageReceiptSen, 1000);
    // A move changes the live stall directory, not the historical order/ledger zone.
    const otherZone = (await local.db.query("select id from public.zones where id<>$1 limit 1", [vendor.zone_id]))
      .rows[0].id;
    await local.db.query("update public.vendors set zone_id=$1 where id=$2", [otherZone, vendor.id]);
    const moved = await local.call(demoActors.admin, "public.admin_overview(7,$1,$2)", [vendor.id, otherZone]);
    assert.equal(moved.summary.orders, 0);
    assert.equal(moved.summary.receiptsSen, 0);
    assert.equal(
      moved.products.reduce((sum, p) => sum + p.units, 0),
      0,
    );
    for (const user of [demoActors.student, demoActors.vendor]) {
      await assert.rejects(local.call(user, "public.admin_vendor_overview($1,7)", [vendor.id]), /FORBIDDEN/);
      await assert.rejects(local.call(user, "public.admin_audit_page(1)"), /FORBIDDEN/);
      await assert.rejects(local.call(user, "public.admin_vendor_accounts($1)", [vendor.id]), /FORBIDDEN/);
      await assert.rejects(
        local.call(user, "public.admin_intelligence_evidence($1,$2)", [value.since, evidenceUntil]),
        /FORBIDDEN/,
      );
    }
    await assert.rejects(local.call(demoActors.admin, "public.admin_overview(null)"), /INVALID_PERIOD/);
  } finally {
    await local.db.close();
  }
});
