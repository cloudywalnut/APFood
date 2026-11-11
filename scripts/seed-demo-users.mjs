import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  SUPABASE_SECRET_KEY: secret, AP_FOOD_DEMO_PROJECT_REF: projectRef,
  AP_FOOD_DEMO_PASSWORD: sharedPassword } = process.env;
if (!projectRef || !url || new URL(url).origin !== "https://" + projectRef + ".supabase.co" || !secret || !publicKey) {
  throw new Error("Configure the dedicated project URL/ref and its API keys.");
}
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const credentialsPath = new URL("../.env.demo-users.json", import.meta.url);
let credentials = { projectRef, users: {} };
try {
  const saved = JSON.parse(await readFile(credentialsPath, "utf8"));
  if (saved.projectRef === projectRef) credentials = saved;
} catch (error) { if (error.code !== "ENOENT") throw error; }
const fixtures = [
  ["student-a", "Aina Rahman", "student", null],
  ["student-b", "Daniel Tan", "student", null],
  ["vendor-noodles", "Farah · Noodle Bar", "vendor", "campus-noodle-bar"],
  ["vendor-coffee", "Jason · Brew & Bites", "vendor", "brew-and-bites"],
  ["vendor-bowls", "Mei · Green Bowl Kitchen", "vendor", "green-bowl-kitchen"],
  ["admin", "Keyaan · Campus Operations", "admin", null],
];
const lookup = new Map();
for (let page = 1;; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("Cannot list fixture accounts.");
  for (const user of data.users) lookup.set(user.email, user);
  if (!data.nextPage || data.nextPage <= page) break;
}
const accounts = new Map();
for (const [alias, name, role, vendorId] of fixtures) {
  const email = alias + "@ap-food-demo.example";
  let user = lookup.get(email);
  if (!user) {
    const password = sharedPassword || credentials.users[alias]?.password || randomBytes(18).toString("base64url") + "!Aa1";
    // Persist intent first so an interrupted bootstrap can recover the original password.
    credentials.users[alias] = { email, password };
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 });
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: name }, app_metadata: { ap_food_fixture: true },
    });
    if (error || !data.user) throw new Error("Cannot create fixture " + alias);
    user = data.user;
  }
  if (user.app_metadata.ap_food_fixture !== true) throw new Error("Existing non-fixture account conflicts with " + alias);
  const { error } = await supabase.from("memberships").upsert({ user_id: user.id, role, vendor_id: vendorId },
    { onConflict: "user_id,role,vendor_id", ignoreDuplicates: true });
  if (error) throw new Error("Cannot assign fixture membership for " + alias);
  accounts.set(alias, user);
  console.log(email + " · " + role);
}
await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 });
console.log("Generated sign-in details saved locally in .env.demo-users.json.");

function requestKey(value) {
  const hex = createHash("sha256").update(projectRef + ":" + value).digest("hex");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) + "-8" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}
async function signedIn(alias) {
  const record = credentials.users[alias];
  const password = record?.password || sharedPassword;
  if (!password) throw new Error("The original password is required to seed order history for " + alias);
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: alias + "@ap-food-demo.example", password });
  if (error) throw new Error("Fixture sign-in failed for " + alias);
  return client;
}
async function rpc(client, name, input) {
  const { data, error } = await client.rpc(name, input);
  if (error) throw new Error("History bootstrap failed at " + name);
  return data;
}
const student = await signedIn("student-a");
for (const [vendorAlias, vendorId, itemId] of [
  ["vendor-noodles", "campus-noodle-bar", "chicken-noodles"],
  ["vendor-coffee", "brew-and-bites", "iced-coffee"],
  ["vendor-bowls", "green-bowl-kitchen", "tofu-bowl"],
]) {
  const key = requestKey("sample-history-v1:" + vendorId);
  const previous = await supabase.from("audit_events").select("order_id").eq("action", "Sample history created").eq("target", key).maybeSingle();
  if (previous.error) throw new Error("Cannot inspect sample history.");
  if (previous.data) continue;
  const operator = await signedIn(vendorAlias);
  credentials.history ??= {};
  let intent = credentials.history[vendorId];
  if (!intent) {
    const offer = await rpc(student, "quote_checkout", { p_vendor: vendorId, p_cart: [{ itemId, quantity: 1, extra: false }] });
    intent = { p_quote: offer.quoteId, p_pickup: offer.slots.at(-2), p_payment: "counter", p_key: key };
    credentials.history[vendorId] = intent;
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 });
  }
  const placed = await rpc(student, "place_order", intent);
  const current = await student.from("orders").select("status").eq("id", placed.id).single();
  for (const [from, to] of [["placed", "accepted"], ["accepted", "preparing"], ["preparing", "ready"]]) {
    if (current.data.status === from) {
      await rpc(operator, "transition_order", { p_id: placed.id, p_status: to });
      current.data.status = to;
    }
  }
  if (current.data.status === "ready") {
    const pickup = await rpc(student, "issue_pickup_code", { p_id: placed.id });
    await rpc(operator, "collect_order", { p_id: placed.id, p_code: pickup.code, p_counter_confirmed: true });
  }
  const marker = await supabase.from("audit_events").insert({ actor_id: accounts.get("admin").id, actor_role: "admin", action: "Sample history created", target: key, order_id: placed.id });
  if (marker.error) throw new Error("Cannot record completed history bootstrap.");
}
console.log("Sample order history is ready.");
