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
  if (error || !data.session) throw new Error("Cannot sign in fixture " + alias);
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
try {
  const buyers = [student, other];
  async function race(stall, itemId, expected, failure, operator) {
    const options = await success("traffic/zones");
    const candidates = options.buckets.filter(slot => slot.vendor_id === stall && slot.reserved_units === 0);
    const quotes = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      post("checkout/quote", buyers[i % buyers.length], { vendorId: stall, items: [{ itemId, quantity: 1, extra: false }] }),
    ));
    const slot = candidates.find(candidate => Date.parse(candidate.starts_at) >= Date.now() + 12 * 60_000
      && quotes.every(quote => quote.slots.some(window => Date.parse(window) === Date.parse(candidate.starts_at))));
    assert.ok(slot, "The smoke test requires a fresh pickup window. Start with a clean demo.");
    const inputs = quotes.map(quote => ({ quoteId: quote.quoteId, pickupAt: slot.starts_at, payment: "counter", idempotencyKey: randomUUID() }));
    const responses = await Promise.allSettled(inputs.map((input, i) => request("orders", { method: "POST", actor: buyers[i % buyers.length], input })));
    const wins = responses.flatMap((outcome, i) => {
      if (outcome.status !== "fulfilled" || !outcome.value.ok) return [];
      const id = outcome.value.data.id;
      cleanup.set(id, operator);
      return [{ id, input: inputs[i], owner: buyers[i % buyers.length] }];
    });
    assert.equal(wins.length, expected, stall + " accepted orders");
    for (const outcome of responses) {
      assert.equal(outcome.status, "fulfilled", "Request must return a structured result");
      if (!outcome.value.ok) assert.equal(outcome.value.data.error?.code, failure);
    }
    console.log(stall + " · " + expected + " accepted, " + (20 - expected) + " " + failure);
    return wins[0];
  }
  const noodleStock = (await success("vendors/campus-noodle-bar/menu")).find(item => item.id === "chicken-noodles")?.stock;
  const toastStock = (await success("vendors/brew-and-bites/menu")).find(item => item.id === "toastie")?.stock;
  assert.ok(noodleStock >= 5 && toastStock > 0 && toastStock < 6, "Use a dedicated demo with the original stock and capacity settings.");
  const winner = await race("campus-noodle-bar", "chicken-noodles", 5, "SLOT_UNAVAILABLE", vendor);
  await race("brew-and-bites", "toastie", toastStock, "OUT_OF_STOCK", coffee);
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
  assert.equal(report.ledger.find(row => row.order_id === winner.id).amount_sen, 900);
  console.log("PASS hosted checkout races, scoped reads, pickup replay, and promo receipt");
} finally {
  for (const [id, actor] of cleanup) {
    try { await post("orders/" + id + "/cancel", actor, { reason: "Hosted smoke test cleanup" }); }
    catch { console.warn("Demo order still needs cleanup: " + id); }
  }
}
