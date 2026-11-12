import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, open, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { demoMenu, demoProfiles } from "./demo-menu.mjs";

const aliases = ["student-a", "student-b", "vendor-noodles", "vendor-coffee", "admin"];
const signature = createHash("sha256").update(JSON.stringify(demoMenu)).digest("hex");
const rpcArgs = {
  save_menu_item: ["p_vendor", "p_id", "p_name", "p_description", "p_price", "p_stock", "p_active", "p_units", "p_expected_stock"],
  save_vendor_payment: ["p_vendor", "p_name", "p_path"],
  quote_checkout: ["p_vendor", "p_cart"], place_order: ["p_quote", "p_pickup", "p_payment", "p_key"],
  claim_qr_payment: ["p_id"], transition_order: ["p_id", "p_status", "p_reason"],
  issue_pickup_code: ["p_id"], collect_order: ["p_id", "p_code", "p_counter_confirmed"],
  pickup_activity: [],
};

export function parseDemoOptions(args) {
  const options = { scenario: "light", execute: false, hosted: false, runId: "rehearsal-" + randomUUID().slice(0, 8), stageMs: 150, payment: "duitnow_qr" };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--execute") options.execute = true;
    else if (arg === "--dry-run") options.execute = false;
    else if (arg === "--hosted") options.hosted = true;
    else if (["--scenario", "--run-id", "--allow-project", "--interval-ms", "--stage-ms", "--orders", "--payment"].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error("Missing value for " + arg);
      options[{ "--scenario": "scenario", "--run-id": "runId", "--allow-project": "allowProject", "--interval-ms": "intervalMs", "--stage-ms": "stageMs", "--orders": "orders", "--payment": "payment" }[arg]] = value;
    } else throw new Error("Unknown option: " + arg);
  }
  if (!demoProfiles[options.scenario]) throw new Error("Choose light, medium, or heavy.");
  if (!["demo", "duitnow_qr"].includes(options.payment)) throw new Error("payment must be demo or duitnow_qr.");
  options.orders = Number(options.orders ?? demoProfiles[options.scenario].requests);
  if (!Number.isInteger(options.orders) || options.orders < 1 || options.orders > 100) throw new Error("orders must be an integer from 1 to 100.");
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(options.runId)) throw new Error("Run ID must be 1–32 lowercase letters, digits or hyphens.");
  options.intervalMs ??= demoProfiles[options.scenario].intervalMs;
  for (const key of ["intervalMs", "stageMs"]) {
    options[key] = Number(options[key]);
    if (!Number.isInteger(options[key]) || options[key] < 0 || options[key] > 5000) throw new Error(key + " must be an integer from 0 to 5000.");
  }
  if (options.hosted && options.execute && (!options.allowProject || !args.includes("--run-id"))) {
    throw new Error("Hosted execution requires --allow-project <designated-ref> and an explicit --run-id.");
  }
  return options;
}

function requestKey(value) {
  const hex = createHash("sha256").update(value).digest("hex");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-4" + hex.slice(13, 16) + "-8" + hex.slice(17, 20) + "-" + hex.slice(20, 32);
}

async function localAdapter() {
  const { createLocalDemoDb, demoActors } = await import("./local-demo-db.mjs");
  const local = await createLocalDemoDb();
  const actors = Object.fromEntries(aliases.map((alias, index) => [alias,
    [demoActors.student, demoActors.other, demoActors.vendor, demoActors.otherVendor, demoActors.admin][index]]));
  // Platform configuration only, in an entirely new in-memory DB. Business writes below use authenticated RPCs.
  await local.db.exec("update private.app_settings set qr_demo_enabled = true where id");
  return {
    project: "isolated-memory",
    rpc: (alias, name, args) => {
      if (name === "pickup_activity") return local.queryAs(actors[alias], "select * from public.pickup_activity()");
      const keys = rpcArgs[name];
      if (!keys) throw new Error("Unsupported demo RPC");
      return local.call(actors[alias], "public." + name + "(" + keys.map((_, i) => "$" + (i + 1)).join(",") + ")",
        keys.map(key => typeof args[key] === "object" && args[key] !== null ? JSON.stringify(args[key]) : args[key] ?? null));
    },
    read: (alias, table, fields, column, value) => {
      if (!["menu_items", "orders", "cash_entries", "vendor_payments"].includes(table) || !["id", "order_id", "vendor_id"].includes(column)) throw new Error("Unsupported demo read");
      return local.queryAs(actors[alias], `select ${fields} from public.${table} where ${column} = $1`, [value]);
    },
    close: () => local.db.close(),
  };
}

async function hostedAdapter(options) {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, AP_FOOD_DEMO_PROJECT_REF: ref } = process.env;
  if (!url || !key || !ref || options.allowProject !== ref || new URL(url).origin !== "https://" + ref + ".supabase.co") {
    throw new Error("Hosted execution is restricted to the configured designated demo project and matching --allow-project.");
  }
  const credentials = JSON.parse(await readFile(new URL("../.env.demo-users.json", import.meta.url), "utf8"));
  if (credentials.projectRef !== ref) throw new Error("Demo fixture credential project does not match.");
  const { createClient } = await import("@supabase/supabase-js");
  const clients = {};
  for (const alias of aliases) {
    const saved = credentials.users?.[alias];
    if (!saved?.password || saved.email !== alias + "@ap-food-demo.example") throw new Error("Missing designated fixture account: " + alias);
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: saved.email, password: saved.password });
    if (error || data.user?.app_metadata?.ap_food_fixture !== true) throw new Error("Fixture sign-in/claim failed: " + alias);
    clients[alias] = client;
  }
  return {
    project: ref,
    async rpc(alias, name, args) {
      const { data, error } = await clients[alias].rpc(name, args);
      if (error) throw new Error(name + ": " + error.message);
      return data;
    },
    async read(alias, table, fields, column, value) {
      const { data, error } = await clients[alias].from(table).select(fields).eq(column, value);
      if (error) throw new Error("Demo read failed: " + table);
      return data;
    },
    close: async () => {},
  };
}

export async function runDemo(options, log = message => process.stderr.write(message + "\n")) {
  const profile = demoProfiles[options.scenario];
  const plan = { source: "FICTIONAL_DEMO_TRAFFIC", physicalCrowd: "Not verified", runId: options.runId,
    scenario: options.scenario, mode: options.hosted ? "designated-hosted-demo" : "isolated-memory",
    requests: options.orders, menuItems: demoMenu.length, intervalMs: options.intervalMs, stageMs: options.stageMs,
    payment: options.payment === "demo" ? "demo · simulated prepaid tender · no money movement" : "duitnow_qr · customer_claimed_demo · no bank verification or money movement" };
  if (!options.execute) return { ...plan, dryRun: true, note: "No accounts, environment files, network or database accessed. Add --execute to run." };

  let adapter, lock, lockPath;
  const path = new URL("../.env.demo-run-" + options.runId + ".json", import.meta.url);
  let state = { version: 1, runId: options.runId, scenario: options.scenario, requestCount: options.orders, payment: options.payment, menuSignature: signature, orders: [] };
  const persist = async () => {
    if (!options.hosted) return;
    await writeFile(new URL(path.href + ".tmp"), JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    await rename(new URL(path.href + ".tmp"), path);
  };
  try {
    if (options.hosted) {
      lockPath = new URL(path.href + ".lock");
      try { lock = await open(lockPath, "wx", 0o600); }
      catch { throw new Error("This run is locked. Ensure no runner is active before removing its .lock file."); }
      try { state = JSON.parse(await readFile(path, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (state.version !== 1 || state.runId !== options.runId || state.scenario !== options.scenario || (state.requestCount ?? profile.requests) !== options.orders || (state.payment ?? "duitnow_qr") !== options.payment || state.menuSignature !== signature) throw new Error("Run configuration changed. Use a new run ID.");
    }
    adapter = options.hosted ? await hostedAdapter(options) : await localAdapter();
    if (state.project && state.project !== adapter.project) throw new Error("Run manifest belongs to another project.");
    state.project = adapter.project;
    await persist();
    for (const [vendor, operator] of [["campus-noodle-bar", "vendor-noodles"], ["brew-and-bites", "vendor-coffee"]]) {
      if (options.payment !== "duitnow_qr") continue;
      if (!options.hosted) await adapter.rpc(operator, "save_vendor_payment", { p_vendor: vendor, p_name: "FICTIONAL DEMO merchant", p_path: vendor + "/00000000-0000-4000-8000-000000000000.png" });
      if (!(await adapter.read(operator, "vendor_payments", "vendor_id", "vendor_id", vendor)).length) throw new Error("Configure merchant QR in Vendor Payment settings before running: " + vendor);
    }
    const menu = demoMenu.map(item => ({ ...item, id: "demo-" + options.runId + "-" + item.key }));
    for (const item of menu) {
      const existing = await adapter.read(item.operator, "menu_items", "id,name,description,vendor_id", "id", item.id);
      const name = item.name;
      if (existing.length) {
        if (existing[0].name !== name || existing[0].vendor_id !== item.vendor || existing[0].description !== item.description) throw new Error("Refusing to overwrite conflicting item: " + item.id);
        continue; // Never reset sold stock or edit an existing item on replay.
      }
      await adapter.rpc(item.operator, "save_menu_item", { p_vendor: item.vendor, p_id: item.id, p_name: name,
        p_description: item.description, p_price: item.price, p_stock: item.stock, p_active: true, p_units: item.units, p_expected_stock: null });
    }
    for (let i = 0; i < options.orders; i++) {
      let record = state.orders[i];
      const item = menu[[0, 6, 1, 8, 2, 4, 3, 7, 5, 9][i % menu.length]];
      if (!record) {
        record = { index: i, buyer: i % 2 ? "student-b" : "student-a", itemId: item.id, vendor: item.vendor, operator: item.operator, attempts: 0, conflicts: 0 };
        state.orders.push(record);
        await persist();
      }
      if (i && !record.id) await delay(options.intervalMs);
      for (; !record.id && record.attempts < 12;) {
        if (!record.intent) {
          const quantity = i % 7 === 6 ? 2 : 1;
          const offer = await adapter.rpc(record.buyer, "quote_checkout", { p_vendor: item.vendor, p_cart: [{ itemId: item.id, quantity, extra: false }] });
          const eligible = offer.slots.filter(slot => Date.parse(slot) >= Date.now() + 20 * 60_000);
          const pickup = eligible[0]; // Concentrate arrivals; the authoritative quote moves overflow into later buckets.
          if (!pickup) throw new Error("No feasible pickup window with payment lead time. Check stall hours/capacity.");
          record.intent = { p_quote: offer.quoteId, p_pickup: pickup, p_payment: options.payment, p_key: requestKey(adapter.project + ":" + options.runId + ":" + i + ":" + record.attempts) };
          await persist(); // Durable intent before checkout, including on ambiguous network failures.
        }
        try {
          const placed = await adapter.rpc(record.buyer, "place_order", record.intent);
          record.id = placed.id;
          await persist();
          const replay = await adapter.rpc(record.buyer, "place_order", record.intent);
          if (replay.id !== record.id) throw new Error("Checkout replay returned a different order.");
        } catch (error) {
          if (!/\b(SLOT_UNAVAILABLE|QUOTE_EXPIRED)\b/.test(error.message)) throw error;
          record.conflicts++;
          record.attempts++;
          delete record.intent;
          await persist();
        }
      }
      if (!record.id) throw new Error("Checkout retry budget exhausted; resume this run after inspecting its manifest.");
      const [order] = await adapter.read(record.buyer, "orders", "id,status,total_sen", "id", record.id);
      if (!order) throw new Error("Run order is not visible to its owner.");
      if (order.status !== "collected") {
        if (options.payment === "duitnow_qr") await adapter.rpc(record.buyer, "claim_qr_payment", { p_id: record.id });
        let current = order.status;
        for (const [from, to] of [["placed", "accepted"], ["accepted", "preparing"], ["preparing", "ready"]]) {
          if (current === from) {
            await delay(options.stageMs);
            await adapter.rpc(record.operator, "transition_order", { p_id: record.id, p_status: to, p_reason: null });
            current = to;
          }
        }
        if (current !== "ready") throw new Error("Cannot fulfil terminal order " + record.id + " (" + current + ").");
        const { code } = await adapter.rpc(record.buyer, "issue_pickup_code", { p_id: record.id });
        await delay(options.stageMs);
        await adapter.rpc(record.operator, "collect_order", { p_id: record.id, p_code: code, p_counter_confirmed: false });
        try {
          await adapter.rpc(record.operator, "collect_order", { p_id: record.id, p_code: code, p_counter_confirmed: false });
          throw new Error("Duplicate pickup was incorrectly accepted.");
        } catch (error) { if (!/\bPICKUP_ALREADY_USED\b/.test(error.message)) throw error; }
      }
      const receipts = await adapter.read("admin", "cash_entries", "order_id,kind,amount_sen", "order_id", record.id);
      if (receipts.length !== 1 || receipts[0].amount_sen !== order.total_sen || receipts[0].kind !== options.payment) throw new Error("Exactly-one matching receipt check failed for " + record.id);
      record.totalSen = order.total_sen;
      record.collected = true;
      await persist();
      log("FICTIONAL " + options.runId + " · " + (i + 1) + "/" + options.orders + " collected · " + item.name);
    }
    const windows = [...new Set(state.orders.map(order => order.intent.p_pickup))];
    const buckets = (await adapter.rpc("admin", "pickup_activity", {})).filter(bucket =>
      ["campus-noodle-bar", "brew-and-bites"].includes(bucket.vendor_id) &&
      windows.some(window => Date.parse(window) === Date.parse(bucket.starts_at)));
    return { ...plan, dryRun: false, project: adapter.project, placed: state.orders.length,
      collected: state.orders.filter(order => order.collected).length, exactlyOnceReceipts: state.orders.length,
      totalSen: state.orders.reduce((total, order) => total + order.totalSen, 0),
      checkoutRetries: state.orders.reduce((total, order) => total + order.conflicts, 0),
      pickupWindows: windows,
      pickupBuckets: buckets,
      orderIds: state.orders.map(order => order.id),
      note: options.hosted ? "Fictional orders/menu persist in the designated project. Same run ID resumes without resetting stock or history." : "Disposable database closed after report; hosted data untouched. Local reruns create a fresh isolated database." };
  } catch (error) {
    error.demoSummary = { ...plan, dryRun: false, completed: false,
      placed: state.orders.filter(order => order.id).length,
      collected: state.orders.filter(order => order.collected).length,
      totalSen: state.orders.reduce((total, order) => total + (order.totalSen ?? 0), 0),
      note: "Stopped without deleting history or changing capacity. Preserve the manifest to resume the same hosted run." };
    throw error;
  } finally {
    await adapter?.close();
    if (lock) { await lock.close(); await unlink(lockPath); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runDemo(parseDemoOptions(process.argv.slice(2))), null, 2)); }
  catch (error) {
    if (error.demoSummary) console.log(JSON.stringify(error.demoSummary, null, 2));
    console.error(error.message); process.exitCode = 1;
  }
}
