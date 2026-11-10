import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: secret,
  AP_FOOD_DEMO_PROJECT_REF: projectRef, AP_FOOD_DEMO_PASSWORD: password } = process.env;
if (!projectRef || !url || new URL(url).origin !== "https://" + projectRef + ".supabase.co" || !secret || !password || password.length < 12) {
  throw new Error("Set the explicitly allowed demo project URL/ref, secret key, and a demo password of at least 12 characters.");
}
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const fixtures = [
  ["student-a", "student", null], ["student-b", "student", null],
  ["vendor-noodles", "vendor", "campus-noodle-bar"], ["vendor-coffee", "vendor", "brew-and-bites"],
  ["admin", "admin", null],
];
const lookup = new Map();
for (let page = 1;; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("Cannot list demo users: " + error.message);
  for (const user of data.users) lookup.set(user.email, user);
  if (!data.nextPage || data.nextPage <= page) break;
}
for (const [alias, role, vendorId] of fixtures) {
  const email = alias + "@ap-food-demo.example";
  let user = lookup.get(email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { ap_food_fixture: true } });
    if (error || !data.user) throw new Error("Cannot create " + alias + ": " + error?.message);
    user = data.user;
  }
  if (user.app_metadata.ap_food_fixture !== true) throw new Error("Refusing to grant a demo role to an existing non-fixture account.");
  const { error } = await supabase.from("memberships").upsert({ user_id: user.id, role, vendor_id: vendorId }, {
    onConflict: "user_id,role,vendor_id", ignoreDuplicates: true,
  });
  if (error) throw new Error("Cannot seed membership for " + alias + ": " + error.message);
  console.log(email + " · " + role + (vendorId ? " · " + vendorId : ""));
}
