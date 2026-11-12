import { readFile, writeFile } from "node:fs/promises";

export async function analyticsActors(client, accounts) {
  const studentEmails = new Set([
    ...accounts.filter((account) => account.role === "student").map((account) => account.email.toLowerCase()),
    "student-a@ap-food-demo.example",
    "student-b@ap-food-demo.example",
  ]);
  const adminEmails = new Set([
    ...accounts.filter((account) => account.role === "admin").map((account) => account.email.toLowerCase()),
    "admin@ap-food-demo.example",
  ]);
  const students = [];
  const admins = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    for (const user of data.users) {
      if (!user.email_confirmed_at) continue;
      const email = (user.email ?? "").toLowerCase();
      if (studentEmails.has(email)) students.push(user);
      if (adminEmails.has(email)) admins.push(user);
    }
    if (data.users.length < 100) break;
  }
  if (!students.length || !admins.length)
    throw new Error(
      "Create and confirm the configured demo student and administrator accounts before seeding analytics.",
    );
  return { students, admin: admins[0] };
}

export async function hasAnalyticsMarker(client, marker) {
  const { data, error } = await client
    .from("audit_events")
    .select("id")
    .eq("action", "Vendor analytics seeded")
    .eq("target", marker)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function loadOrCreateAnalyticsPlan(filename, identity, generate) {
  const read = async () => {
    const plan = JSON.parse(await readFile(filename, "utf8"));
    if (
      plan.version !== 1 ||
      plan.projectRef !== identity.projectRef ||
      plan.vendorId !== identity.vendorId ||
      !Array.isArray(plan.slots) ||
      !Array.isArray(plan.orders) ||
      !Array.isArray(plan.cash) ||
      !plan.audit?.id
    ) {
      throw new Error("Analytics plan does not match the requested project and stall.");
    }
    return plan;
  };
  try {
    return await read();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const generated = await generate();
  if (!generated) return null;
  const plan = { version: 1, ...identity, ...generated };
  try {
    // Finish the durable plan before the first database write. Keep it for retries.
    await writeFile(filename, JSON.stringify(plan), { flag: "wx", mode: 0o600 });
    return plan;
  } catch (error) {
    if (error.code === "EEXIST") return read();
    throw error;
  }
}

export async function applyAnalyticsPlan(client, plan) {
  for (const [table, rows, onConflict] of [
    ["capacity_slots", plan.slots, "vendor_id,starts_at"],
    ["orders", plan.orders, "id"],
    ["cash_entries", plan.cash, "id"],
    ["audit_events", [plan.audit], "id"],
  ]) {
    if (!rows.length) continue;
    const { error } = await client.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
    if (error) throw error;
  }
}
