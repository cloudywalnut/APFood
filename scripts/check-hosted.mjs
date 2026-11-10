import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  AP_FOOD_DEMO_PROJECT_REF: ref, AP_FOOD_DEMO_PASSWORD: password, AP_FOOD_HOSTED_SMOKE: enabled } = process.env;
const base = new URL(process.env.AP_FOOD_APP_ORIGIN || "http://localhost:3000");
if (enabled !== "1" || !ref || !url || new URL(url).origin !== "https://" + ref + ".supabase.co" || !key || !password ||
  (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname))) {
  throw new Error("Configure and explicitly enable the smoke test on a disposable hosted demo project.");
}

async function token(alias) {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({ email: alias + "@ap-food-demo.example", password });
  if (error || !data.session) {
    throw new Error("Cannot sign in fixture " + alias + " (" + (error?.code ?? "missing session") + "). Check the seeded account and its original fixture password.");
  }
  return data.session.access_token;
}
async function request(path, { actor, method = "GET", input } = {}) {
  const response = await fetch(new URL("/api/" + path, base), {
    method,
    headers: { ...(actor ? { Authorization: "Bearer " + actor } : {}), ...(input === undefined ? {} : { "Content-Type": "application/json" }) },
    body: input === undefined ? undefined : JSON.stringify(input),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}
async function success(path, options) {
  const response = await request(path, options);
  assert.equal(response.ok, true, path + " · " + response.status + " · " + (response.data.error?.code ?? ""));
  return response.data;
}
const post = (path, actor, input) => success(path, { actor, method: "POST", input });
const [student, other, vendor, coffee, admin] = await Promise.all(
  ["student-a","student-b","vendor-noodles","vendor-coffee","admin"].map(token),
);
const cleanup = new Map();
const attempts = 20;
try {
  const buyers = [student, other];
  async function race(stall, capacity, item, expected, failure, operator) {
    const options = await success("traffic/zones");
    const candidates = options.buckets.filter(slot => slot.vendor_id === stall && slot.reserved_units === 0 && slot.total_units === capacity);
    const quotes = await Promise.all(Array.from({ length: attempts }, (_, i) =>
      post("checkout/quote", buyers[i % buyers.length], { vendorId: stall, items: [{ itemId: item.id, quantity: 1, extra: false }] }),
    ));
    for (const quote of quotes) assert.equal(quote.totalSen, item.price_sen - item.discount_sen);
    const slot = candidates.find(candidate => Date.parse(candidate.starts_at) >= Date.now() + 12 * 60_000
      && quotes.every(quote => quote.slots.some(window => Date.parse(window) === Date.parse(candidate.starts_at))));
    assert.ok(slot, "The smoke test requires a fresh pickup window. Start with a clean demo.");
    const inputs = quotes.map(quote => ({ quoteId: quote.quoteId, pickupAt: slot.starts_at, payment: "counter", idempotencyKey: randomUUID() }));
    const responses = await Promise.allSettled(inputs.map((input, i) => request("orders", { method: "POST", actor: buyers[i % buyers.length], input })));
    const wins = responses.flatMap((outcome, i) => {
      if (outcome.status !== "fulfilled" || !outcome.value.ok) return [];
      const id = outcome.value.data.id;
      cleanup.set(id, operator);
      return [{ id, input: inputs[i], owner: buyers[i % buyers.length], totalSen: quotes[i].totalSen }];
    });
    assert.equal(wins.length, expected, stall + " accepted orders");
    for (const outcome of responses) {
      assert.equal(outcome.status, "fulfilled", "Request must return a structured result");
      if (!outcome.value.ok) assert.equal(outcome.value.data.error?.code, failure);
    }
    console.log(stall + " · " + expected + " accepted, " + (attempts - expected) + " " + failure);
    return wins[0];
  }
  const noodleStall = "campus-noodle-bar";
  const coffeeStall = "brew-and-bites";
  const [stalls, noodleMenu, coffeeMenu] = await Promise.all([
    success("vendors"),
    success("vendors/" + noodleStall + "/menu"),
    success("vendors/" + coffeeStall + "/menu"),
  ]);
  const noodleCapacity = stalls.find(stall => stall.id === noodleStall)?.capacity;
  const coffeeCapacity = stalls.find(stall => stall.id === coffeeStall)?.capacity;
  const noodles = noodleMenu.find(item => item.id === "chicken-noodles");
  const toast = coffeeMenu.find(item => item.id === "toastie");
  assert.ok(noodles?.work_units === 1 && noodles.discount_sen > 0 &&
    noodleCapacity > 0 && noodleCapacity < attempts && noodles.stock > noodleCapacity,
    "The noodle race requires a discounted one-unit item with more stock than pickup capacity.");
  assert.ok(toast?.work_units === 1 && toast.stock > 0 && toast.stock < Math.min(attempts, coffeeCapacity),
    "The toast race requires a one-unit item with less stock than pickup capacity.");
  const winner = await race(noodleStall, noodleCapacity, noodles, noodleCapacity, "SLOT_UNAVAILABLE", vendor);
  await race(coffeeStall, coffeeCapacity, toast, toast.stock, "OUT_OF_STOCK", coffee);
  assert.equal((await post("orders", winner.owner, winner.input)).id, winner.id);
  const unrelated = winner.owner === student ? other : student;
  assert.equal((await request("orders/" + winner.id, { actor: unrelated })).status, 404);
  assert.equal((await request("orders/" + winner.id, { actor: coffee })).status, 404);
  for (const status of ["accepted","preparing","ready"]) await post("vendor/orders/" + winner.id + "/transition", vendor, { status });
  const { code } = await post("orders/" + winner.id + "/pickup-token", winner.owner);
  const redemption = await Promise.all(Array.from({ length: 2 }, () =>
    request("vendor/orders/" + winner.id + "/collect", { actor: vendor, method: "POST", input: { code, counterConfirmed: true } }),
  ));
  assert.equal(redemption.filter(result => result.ok).length, 1);
  assert.equal(redemption.find(result => !result.ok)?.data.error?.code, "PICKUP_ALREADY_USED");
  cleanup.delete(winner.id);
  const report = await success("admin/report?days=1", { actor: admin });
  assert.equal(report.ledger.filter(row => row.order_id === winner.id).length, 1);
  assert.equal(report.ledger.find(row => row.order_id === winner.id).amount_sen, winner.totalSen);
} finally {
  for (const [id, actor] of cleanup) {
    try { await post("orders/" + id + "/cancel", actor, { reason: "Hosted smoke test cleanup" }); }
    catch {
      process.exitCode = 1;
      console.error("Demo order still needs cleanup: " + id);
    }
  }
}
if (!process.exitCode) console.log("PASS hosted checkout races, scoped reads, pickup replay, and promo receipt");
