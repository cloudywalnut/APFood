import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret,
  AP_FOOD_DEMO_PROJECT_REF: ref, AP_FOOD_BOOTSTRAP_ADMIN_EMAIL: email } = process.env;
if (!url || !secret || !ref || new URL(url).origin !== "https://" + ref + ".supabase.co" || !email) {
  throw new Error("Configure the project URL/ref, server key, and AP_FOOD_BOOTSTRAP_ADMIN_EMAIL.");
}
const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const admins = await client.from("memberships").select("user_id").eq("role", "admin").limit(1);
if (admins.error) throw new Error("Cannot inspect administrator membership.");
if (admins.data.length) throw new Error("An administrator already exists. Use User management for access changes.");
let target;
for (let page = 1;; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("Cannot inspect registered accounts.");
  target = data.users.find(user => user.email?.toLowerCase() === email.toLowerCase() && user.email_confirmed_at);
  if (target || !data.nextPage || data.nextPage <= page) break;
}
if (!target) throw new Error("Register and verify the designated account first.");
const result = await client.from("memberships").insert({ user_id: target.id, role: "admin", vendor_id: null });
if (result.error) throw new Error("Administrator bootstrap failed.");
console.log("First administrator configured.");
