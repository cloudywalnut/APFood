import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { databaseTarget, findSupabaseCli, readDatabase, databaseCommand } from "./hosted-database.mjs";
import { analyticsActors } from "./analytics-seed-plan.mjs";
import { historyMonth, historySql } from "./history-fixtures.mjs";

const target = databaseTarget(),
  cli = findSupabaseCli(),
  apply = process.argv.includes("--apply");
const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const yesterday = new Date(`${today}T00:00:00Z`);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const month = argument("month") ?? today.slice(0, 7),
  through = argument("through") ?? yesterday.toISOString().slice(0, 10);
if (
  !/^\d{4}-\d{2}$/.test(month) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(through) ||
  !through.startsWith(month) ||
  through >= today ||
  new Date(`${through}T00:00:00Z`).toISOString().slice(0, 10) !== through
)
  throw Error("Choose a completed date within the requested month.");
const version = "apfoods-campus-month-v2",
  directory = `.env.campus-month-${target.ref}-${month}`;
const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const save = async (path, value) => writeFile(path, JSON.stringify(value), { mode: 0o600 });
const accounts = await json("supabase/fixtures/demo-accounts.json");
const actors = await analyticsActors(api, accounts.accounts);
const [vendors, menu] = await Promise.all([
  api
    .from("vendors")
    .select("id,name,zone_id,category,capacity,lead_minutes,opens_at,closes_at")
    .eq("status", "approved")
    .order("id"),
  api.from("menu_items").select("id,vendor_id,name,price_sen,discount_sen,work_units", { count: "exact" }).order("id"),
]);
if (vendors.error || menu.error || menu.count !== menu.data.length) throw Error("Cannot load complete catalogue.");
const baseline = readDatabase(
  cli,
  target,
  `select count(*) orders,(select count(*) from public.cash_entries) ledger,pg_database_size(current_database()) bytes from public.orders`,
)[0];
if (baseline.bytes > 300 * 1024 * 1024) throw Error("Review hosted storage first.");
let config;
try {
  config = await json(`${directory}/manifest.json`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (config && (config.project !== target.ref || config.through !== through || config.version !== version))
  throw Error("Resume using the manifest original month/through date.");
if (!config) {
  let students = actors.students.map(({ id }) => ({ id }));
  if (apply) {
    await mkdir(directory, { recursive: true });
    let stored;
    try {
      stored = await json(`${directory}/students.json`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      stored = Array.from({ length: 500 }, (_, index) => ({
        email: `campus-demo-${String(index + 1).padStart(4, "0")}@apfoods.local`,
        name: `Campus Student ${String(index + 1).padStart(4, "0")} (Demo)`,
        password: randomBytes(18).toString("base64url") + "aA1!",
      }));
    }
    await save(`${directory}/students.json`, stored);
    const known = new Map();
    for (let page = 1; ; page++) {
      const { data, error } = await api.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw Error("Cannot inspect fixture users: " + error.code);
      for (const user of data.users) known.set(user.email, user);
      if (data.users.length < 200) break;
    }
    let next = 0,
      finished = 0,
      saving = Promise.resolve();
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (next < stored.length) {
          const record = stored[next++];
          let user = known.get(record.email);
          if (user && user.app_metadata?.fixture !== version)
            throw Error("Fixture address belongs to another account.");
          if (!user) {
            let result;
            for (let attempt = 0; attempt < 3; attempt++) {
              result = await api.auth.admin.createUser({
                email: record.email,
                password: record.password,
                email_confirm: true,
                user_metadata: { display_name: record.name },
                app_metadata: { fixture: version },
              });
              if (!result.error) break;
              if (result.error.status !== 429) break;
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
            if (result.error) throw Error("Cannot create demo account: " + result.error.code);
            user = result.data.user;
          }
          record.id = user.id;
          saving = saving.then(() => save(`${directory}/students.json`, stored));
          await saving;
          if (++finished % 50 === 0)
            console.log(`${finished}/500 fictional student accounts ready; passwords preserved.`);
        }
      }),
    );
    students = [...stored.map(({ id }) => ({ id })), ...students];
  }
  config = {
    version,
    project: target.ref,
    month,
    through,
    campusPopulation: 5000,
    dailyOrders: 1500,
    students,
    adminId: actors.admin.id,
    vendors: vendors.data,
    menu: menu.data,
    baseline,
  };
  if (apply) await save(`${directory}/manifest.json`, config);
}
let orderCount = 0,
  ledgerCount = 0,
  paymentCount = 0;
for (
  let date = new Date(`${month}-01T00:00:00Z`);
  date.toISOString().slice(0, 10) <= through;
  date.setUTCDate(date.getUTCDate() + 1)
) {
  const day = date.toISOString().slice(0, 10),
    filename = `${directory}/${day}.json`;
  let plan;
  if (apply)
    try {
      plan = await json(filename);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  if (!plan) {
    plan = historyMonth(
      { ...config, start: day, end: day, recentStart: "9999-01-01", namespace: `${version}:${day}` },
      month,
    );
    for (const entry of plan.cash) {
      entry.label = entry.label.replace("[DEMO HISTORY v1]", "[DEMO CAMPUS MONTH v2]");
      entry.created_at = new Date(`${day}T${entry.kind === "reversal" ? "19:45" : "19:30"}:00+08:00`).toISOString();
    }
    plan.audit.reason = JSON.stringify({
      fixture: version,
      day,
      campusPopulation: 5000,
      orders: plan.orders.length,
      fictional: true,
    });
    if (apply) await save(filename, plan);
  }
  orderCount += plan.orders.length;
  ledgerCount += plan.cash.length;
  paymentCount += plan.payments.length;
  if (apply) {
    await writeFile(`${directory}/import.sql`, historySql(plan));
    databaseCommand(cli, target, ["--file", `${directory}/import.sql`, "--yes"]);
    console.log(`${day}: ${plan.orders.length} orders committed or already present.`);
  }
}
console.log(
  JSON.stringify(
    {
      applied: apply,
      month,
      through,
      stalls: config.vendors.length,
      cohort: config.students.length,
      orders: orderCount,
      ledger: ledgerCount,
      payments: paymentCount,
      campusPopulationAssumption: 5000,
    },
    null,
    2,
  ),
);
