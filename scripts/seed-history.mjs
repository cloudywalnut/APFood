import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyticsActors } from "./analytics-seed-plan.mjs";
import { databaseTarget, findSupabaseCli, readDatabase, databaseCommand } from "./hosted-database.mjs";
import { historyVersion, historyMonth, monthKeys, historySql, stableHistoryId } from "./history-fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = databaseTarget();
const cli = findSupabaseCli();
const apply = process.argv.includes("--apply");
const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1];
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const previousDay = new Date(`${today}T00:00:00Z`);
previousDay.setUTCDate(previousDay.getUTCDate() - 1);
const end = argument("end") ?? previousDay.toISOString().slice(0, 10);
const start = argument("start") ?? "2023-01-01";
if (
  !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
  start > end ||
  end >= today ||
  Date.parse(end) - Date.parse(start) > 6 * 366 * 86400_000
)
  throw Error("Choose a past date range of at most six years.");
if (
  [start, end].some(
    (day) => !Number.isFinite(Date.parse(day)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day,
  )
)
  throw Error("The date range contains an invalid calendar date.");
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw Error("Configure SUPABASE_SECRET_KEY for demo account discovery.");
const api = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const directory = join(root, `.env.history-data-${target.ref}`);
const manifestPath = join(directory, "manifest.json");
const readJson = async (filename) => JSON.parse(await readFile(filename, "utf8"));
const saveJson = async (filename, value) => writeFile(filename, JSON.stringify(value), { mode: 0o600 });

async function historyStudents() {
  const names = [
    "Aina Farah",
    "Daniel Lee",
    "Nur Iman",
    "Ravi Kumar",
    "Lucas Tan",
    "Mei Xin",
    "Adam Hakim",
    "Siti Alya",
    "Priya Menon",
    "Nadia Izzati",
    "Farhan Aziz",
    "Chloe Lim",
    "Arjun Rao",
    "Sara Yusuf",
    "Wei Jian",
    "Amir Zaki",
    "Hana Sofia",
    "Haziq Rahman",
    "Isha Patel",
    "Noah Wong",
    "Leena Omar",
    "Ryan Teoh",
    "Alia Nordin",
    "Zara Hassan",
  ];
  const path = join(directory, "students.json");
  let saved;
  try {
    saved = await readJson(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    saved = { project: target.ref, students: [] };
  }
  if (saved.project !== target.ref) throw Error("Student fixture file belongs to another project.");
  const known = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await api.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw Error(`Cannot inspect demo users (${error.code})`);
    for (const user of data.users) known.set(user.email, user);
    if (data.users.length < 100) break;
  }
  for (const [index, name] of names.entries()) {
    const email = `history-student-${String(index + 1).padStart(2, "0")}@apfoods.local`;
    let record = saved.students.find((user) => user.email === email);
    if (!record) {
      record = { email, name: `${name} (Demo)`, password: randomBytes(18).toString("base64url") + "aA1!" };
      saved.students.push(record);
      await saveJson(path, saved);
    }
    let user = known.get(email);
    if (user && user.app_metadata?.fixture !== historyVersion)
      throw Error(`A non-history account already owns fixture address ${email}`);
    if (!user) {
      const result = await api.auth.admin.createUser({
        email,
        password: record.password,
        email_confirm: true,
        user_metadata: { display_name: record.name },
        app_metadata: { fixture: historyVersion },
      });
      if (result.error) throw Error(`Could not create historical student (${result.error.code})`);
      user = result.data.user;
    }
    record.id = user.id;
    await saveJson(path, saved);
  }
  console.log(`Historical student fixtures ready: ${saved.students.length}; existing passwords preserved.`);
  return saved.students.map(({ id, email }) => ({ id, email }));
}

async function main() {
  const preflight = readDatabase(
    cli,
    target,
    `select json_build_object(
    'bytes',pg_database_size(current_database()),
    'recentOrders',(select count(*) from public.orders where created_at >= date_trunc('day',now())-interval '14 days'),
    'recentLedger',(select count(*) from public.cash_entries where created_at >= date_trunc('day',now())-interval '14 days'),
    'orders',(select count(*) from public.orders),'ledger',(select count(*) from public.cash_entries)) as data`,
  )[0].data;
  if (preflight.bytes > 300 * 1024 * 1024) throw Error("Review database storage before adding multi-year fixtures.");
  let config;
  try {
    config = await readJson(manifestPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (
    config &&
    (config.project !== target.ref || config.version !== historyVersion || config.start !== start || config.end !== end)
  )
    throw Error("An anchored historical manifest already exists. Reuse its exact start/end dates to resume.");
  if (!config) {
    const accounts = await readJson(join(root, "supabase", "fixtures", "demo-accounts.json"));
    const actors = await analyticsActors(api, accounts.accounts);
    const [vendorsResult, menuResult] = await Promise.all([
      api
        .from("vendors")
        .select("id,name,zone_id,category,capacity,lead_minutes,opens_at,closes_at")
        .eq("status", "approved")
        .order("id"),
      api
        .from("menu_items")
        .select("id,vendor_id,name,price_sen,discount_sen,work_units", { count: "exact" })
        .order("id"),
    ]);
    if (vendorsResult.error || menuResult.error || menuResult.count !== menuResult.data.length)
      throw Error("Cannot read the complete demo catalogue.");
    if (!vendorsResult.data.length || !menuResult.data.length)
      throw Error("The dedicated demo project needs stalls and menu items first.");
    const recentStart = new Date(`${today}T00:00:00Z`);
    recentStart.setUTCDate(recentStart.getUTCDate() - 13);
    const recentPerDay = Math.max(
      0,
      Math.min(
        3,
        Math.floor((850 - Math.max(preflight.recentOrders, preflight.recentLedger)) / (14 * vendorsResult.data.length)),
      ),
    );
    if (apply) await mkdir(directory, { recursive: true });
    const students = apply
      ? await historyStudents()
      : Array.from({ length: 24 }, (_, index) => ({ id: stableHistoryId(target.ref, `preview-student:${index}`) }));
    config = {
      version: historyVersion,
      project: target.ref,
      start,
      end,
      recentStart: recentStart.toISOString().slice(0, 10),
      recentPerDay,
      vendors: vendorsResult.data,
      menu: menuResult.data,
      students: [...students, ...actors.students.map((user) => ({ id: user.id }))],
      adminId: actors.admin.id,
      baseline: preflight,
    };
    if (apply) await saveJson(manifestPath, config);
  }
  let totalOrders = 0,
    totalLedger = 0,
    totalPayments = 0;
  const byYear = {};
  for (const month of monthKeys(config.start, config.end)) {
    const filename = join(directory, `${month}.json`);
    let plan;
    if (apply)
      try {
        plan = await readJson(filename);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    if (!plan) {
      plan = historyMonth(config, month);
      if (apply) await saveJson(filename, plan);
    }
    totalOrders += plan.orders.length;
    totalLedger += plan.cash.length;
    totalPayments += plan.payments.length;
    byYear[month.slice(0, 4)] = (byYear[month.slice(0, 4)] ?? 0) + plan.orders.length;
    if (apply) {
      const sqlFile = join(directory, "import.sql");
      await writeFile(sqlFile, historySql(plan), { mode: 0o600 });
      databaseCommand(cli, target, ["--file", sqlFile, "--yes"]);
      console.log(
        `${month}: ${plan.orders.length} orders, ${plan.cash.length} ledger entries committed or already present.`,
      );
    }
  }
  console.log(
    JSON.stringify(
      {
        applied: apply,
        project: target.ref,
        start: config.start,
        end: config.end,
        vendors: config.vendors.length,
        students: config.students.length,
        orders: totalOrders,
        ledgerEntries: totalLedger,
        paymentRecords: totalPayments,
        byYear,
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
