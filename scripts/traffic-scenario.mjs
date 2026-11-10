import { randomUUID } from "node:crypto";
import { createLocalDemoDb, demoActors, demoStalls } from "./local-demo-db.mjs";

const scenarios = new Map([
  ["light", { requests: 1, reroutes: 0 }],
  ["medium", { requests: 3, reroutes: 0 }],
  ["heavy", { requests: 12, reroutes: 3 }],
]);

export async function runTrafficScenario(scenario) {
  const profile = scenarios.get(scenario);
  if (!profile) throw new Error("Choose light, medium, or heavy.");

  const { db, queryAs, call } = await createLocalDemoDb();
  try {
    const { student, other, vendor, admin } = demoActors;
    const { noodleBar, coffeeBar } = demoStalls;
    const quote = (buyer, stall, itemId) => call(buyer, "public.quote_checkout($1,$2)", [
      stall, JSON.stringify([{ itemId, quantity: 1, extra: false }]),
    ]);
    const place = (buyer, offer, pickup) => call(buyer, "public.place_order($1,$2,$3,$4)", [
      offer.quoteId, pickup, "counter", randomUUID(),
    ]);

    const offered = [];
    for (let i = 0; i < profile.requests; i++) {
      const buyer = i % 2 === 0 ? student : other;
      offered.push({ buyer, offer: await quote(buyer, noodleBar, "chicken-noodles") });
    }
    // Start with a shared window and enough lead time to finish the rehearsal.
    const target = offered[0].offer.slots.find(slot =>
      Date.parse(slot) >= Date.now() + 25 * 60_000 &&
      offered.every(({ offer }) => offer.slots.includes(slot)));
    if (!target) throw new Error("The seeded noodle stall needs a shared pickup window.");

    const accepted = [];
    const conflicts = [];
    for (const { buyer, offer } of offered) {
      try {
        const order = await place(buyer, offer, target);
        accepted.push({ ...order, buyer });
      } catch (error) {
        if (error.message !== "SLOT_UNAVAILABLE") throw error;
        conflicts.push(buyer);
      }
    }
    const nearby = await quote(other, coffeeBar, "iced-coffee");
    await place(other, nearby, target);

    const nextOffer = await quote(student, noodleBar, "chicken-noodles");
    const nextPickup = nextOffer.slots.find(slot => Date.parse(slot) >= Date.parse(target));
    if (!nextPickup) throw new Error("The seeded noodle stall needs a later pickup window.");
    const reroutes = conflicts.slice(0, profile.reroutes);
    for (const buyer of reroutes) {
      const offer = await quote(buyer, noodleBar, "chicken-noodles");
      const later = offer.slots.find(slot => Date.parse(slot) > Date.parse(target));
      if (!later) throw new Error("No pickup window available for a rerouted order.");
      await place(buyer, offer, later);
    }

    const buckets = await queryAs(null, `
      select vendor_id, pickup_count, reserved_units, total_units
      from public.pickup_activity() where starts_at = $1
      order by vendor_id
    `, [target]);

    const first = accepted[0];
    if (!first) throw new Error("The rehearsal needs an accepted order to demonstrate collection.");
    for (const stage of ["accepted", "preparing", "ready"]) {
      await call(vendor, "public.transition_order($1,$2,$3)", [first.id, stage, null]);
    }
    const { code } = await call(first.buyer, "public.issue_pickup_code($1)", [first.id]);
    await call(vendor, "public.collect_order($1,$2,$3)", [first.id, code, true]);
    const receipts = await queryAs(admin, "select kind, amount_sen from public.cash_entries");

    return {
      source: "local_simulated_orders",
      scenario,
      pickupWindow: target,
      initialAttempts: offered.length,
      acceptedAtTarget: accepted.length,
      slotConflicts: conflicts.length,
      reroutedOrders: reroutes.length,
      unresolvedConflicts: conflicts.length - reroutes.length,
      comparisonOrders: 1,
      totalPlaced: accepted.length + reroutes.length + 1,
      nextNoodlePickupAfterInitialDemand: nextPickup,
      targetBucketsBeforeCollection: buckets,
      collectedOrders: receipts.length,
      demoReceipts: receipts,
    };
  } finally {
    await db.close();
  }
}
