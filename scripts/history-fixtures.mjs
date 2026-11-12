import { createHash } from "node:crypto";

export const historyVersion = "apfoods-history-v1";
export function stableHistoryId(project, key) {
  const prefix = createHash("sha256").update(`${project}:${historyVersion}`).digest("hex").slice(0, 8);
  const hex = createHash("sha256").update(`${project}:${historyVersion}:${key}`).digest("hex");
  return `${prefix}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function randomFor(key) {
  let value = createHash("sha256").update(key).digest().readUInt32LE(0) || 1;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}
export function monthKeys(start, end) {
  const months = [];
  for (
    let date = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
    date.toISOString().slice(0, 7) <= end.slice(0, 7);
    date.setUTCMonth(date.getUTCMonth() + 1)
  )
    months.push(date.toISOString().slice(0, 7));
  return months;
}
const at = (day, hour, minute = 0) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`).toISOString();
const offset = (date, minutes) => new Date(Date.parse(date) + minutes * 60_000).toISOString();

export function historyMonth(config, month) {
  const { project, start, end, recentStart, vendors, menu, students, adminId, recentPerDay = 3 } = config;
  const orders = [],
    cash = [],
    payments = [],
    slots = new Map();
  const id = (key) => stableHistoryId(project, config.namespace ? `${config.namespace}:${key}` : key);
  for (
    let date = new Date(`${month}-01T00:00:00Z`);
    date.toISOString().startsWith(month);
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const day = date.toISOString().slice(0, 10);
    if (day < start || day > end) continue;
    const weekday = date.getUTCDay();
    const monthNumber = date.getUTCMonth() + 1;
    for (const [vendorIndex, vendor] of vendors.entries()) {
      const items = menu.filter((item) => item.vendor_id === vendor.id);
      if (!items.length) continue;
      const rand = randomFor(`${project}:${vendor.id}:${day}`);
      const growth = 0.72 + (date.getUTCFullYear() - 2023) * 0.14;
      const semester = [1, 6, 7, 12].includes(monthNumber) ? 0.62 : 1;
      const count = config.dailyOrders
        ? Math.max(
            1,
            Math.round(
              (config.dailyOrders / vendors.length) *
                [0.32, 1.08, 1.02, 1.1, 1, 0.9, 0.38][weekday] *
                (0.8 + (vendorIndex % 4) * 0.15) *
                (0.8 + rand() * 0.4),
            ),
          )
        : day >= recentStart
          ? recentPerDay > 0
            ? Math.max(1, Math.floor(rand() * recentPerDay) + 1)
            : 0
          : Math.max(
              1,
              Math.round(
                8 *
                  growth *
                  semester *
                  (weekday === 0 || weekday === 6 ? 0.34 : 1) *
                  (0.75 + rand() * 0.6) *
                  (0.8 + (vendorIndex % 4) * 0.15),
              ),
            );
      const morning = /coffee|drink|kopitiam|brew/i.test(`${vendor.id} ${vendor.category}`);
      const opening = Number(vendor.opens_at.slice(0, 2));
      const closing = Number(vendor.closes_at.slice(0, 2));
      const hours = (morning ? [8, 9, 10, 12, 14, 15, 16] : [10, 11, 12, 12, 13, 13, 14, 17, 18]).filter(
        (hour) => hour >= opening + 1 && hour < closing - 1,
      );
      if (!hours.length) throw Error(`No historical business window for ${vendor.id}`);
      for (let index = 0; index < count; index++) {
        const pickup = at(day, hours[Math.floor(rand() * hours.length)], [0, 15, 30, 45][Math.floor(rand() * 4)]);
        const created = offset(pickup, -(vendor.lead_minutes + 15 + Math.floor(rand() * 20)));
        const orderId = id(`order:${vendor.id}:${day}:${index}`);
        const chance = rand();
        const status = chance < 0.045 ? "cancelled" : chance < 0.075 ? "rejected" : "collected";
        const channel = rand();
        const payment =
          status !== "collected" ? "counter" : channel < 0.4 ? "counter" : channel < 0.65 ? "duitnow_qr" : "demo";
        const first = items[(date.getUTCDate() + index + Math.floor(rand() * items.length)) % items.length];
        const selected = [first];
        if (items.length > 1 && rand() < 0.24)
          selected.push(items[(items.indexOf(first) + 1 + Math.floor(rand() * (items.length - 1))) % items.length]);
        const lines = selected.map((item) => {
          const extra = rand() < 0.1;
          const historicalPrice = Math.max(
            100,
            Math.round(((item.price_sen - item.discount_sen) * (0.88 + (date.getUTCFullYear() - 2023) * 0.04)) / 10) *
              10,
          );
          return {
            itemId: item.id,
            name: item.name,
            quantity: rand() < 0.17 ? 2 : 1,
            extra,
            unit: historicalPrice + (extra ? 200 : 0),
            work: item.work_units + (extra ? 1 : 0),
          };
        });
        const total = lines.reduce((sum, line) => sum + line.unit * line.quantity, 0);
        const units = lines.reduce((sum, line) => sum + line.work * line.quantity, 0);
        const collected = offset(pickup, rand() < 0.12 ? 15 + Math.floor(rand() * 20) : 1 + Math.floor(rand() * 8));
        orders.push({
          id: orderId,
          student_id: students[Math.floor(rand() * students.length)].id,
          vendor_id: vendor.id,
          zone_id: vendor.zone_id,
          pickup_at: pickup,
          status,
          payment,
          lines,
          total_sen: total,
          units,
          version: status === "collected" ? 5 : 2,
          created_at: created,
          updated_at: status === "collected" ? collected : offset(created, 3),
          ready_at: status === "collected" ? offset(pickup, -2 - Math.floor(rand() * 6)) : null,
          collected_at: status === "collected" ? collected : null,
        });
        const key = `${vendor.id}:${pickup}`;
        const slot = slots.get(key) ?? {
          vendor_id: vendor.id,
          starts_at: pickup,
          total_units: vendor.capacity,
          reserved_units: 0,
        };
        if (status === "collected") slot.reserved_units += units;
        slot.total_units = Math.max(slot.total_units, slot.reserved_units);
        slots.set(key, slot);
        if (status === "collected") {
          cash.push({
            id: id(`receipt:${orderId}`),
            vendor_id: vendor.id,
            zone_id: vendor.zone_id,
            order_id: orderId,
            kind: payment,
            amount_sen: total,
            label: "[DEMO HISTORY v1] Collected order receipt",
            created_at: collected,
          });
          if (payment !== "demo")
            payments.push({
              order_id: orderId,
              status: "paid",
              source: payment === "counter" ? "counter" : "customer_claimed_demo",
              merchant_name: `[DEMO HISTORY] ${vendor.name}`,
              qr_path: null,
              expires_at: payment === "duitnow_qr" ? offset(created, 5) : null,
              paid_at: payment === "counter" ? collected : offset(created, 2),
            });
        }
      }
    }
  }
  const monthLastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const lastDay = Math.min(Number(end.slice(0, 7) === month ? end.slice(8) : 31), monthLastDay);
  for (const vendor of vendors) {
    const receipts = cash
      .filter((entry) => entry.vendor_id === vendor.id && entry.order_id)
      .reduce((sum, entry) => sum + entry.amount_sen, 0);
    if (!receipts) continue;
    for (const [index, [label, fraction]] of [
      ["Ingredients", 0.28],
      ["Packaging", 0.035],
      ["Shift staffing", 0.1],
    ].entries()) {
      const expenseId = id(`expense:${vendor.id}:${month}:${index}`);
      const amount = Math.max(100, Math.round((receipts * fraction) / 10) * 10);
      const day = `${month}-${String(Math.min(lastDay, 8 + index * 9)).padStart(2, "0")}`;
      cash.push({
        id: expenseId,
        vendor_id: vendor.id,
        zone_id: vendor.zone_id,
        kind: "expense",
        amount_sen: amount,
        label: `[DEMO HISTORY v1] ${label}`,
        expense_request_key: id(`expense-key:${expenseId}`),
        created_at: at(day, 19, 30),
      });
      if (index === 1 && randomFor(expenseId)() < 0.16)
        cash.push({
          id: id(`reverse:${expenseId}`),
          vendor_id: vendor.id,
          zone_id: vendor.zone_id,
          kind: "reversal",
          reverses_id: expenseId,
          amount_sen: amount,
          label: "[DEMO HISTORY v1] Duplicate packaging charge reversed",
          created_at: at(day, 19, 45),
        });
    }
  }
  const target = `${config.namespace ?? historyVersion}:${month}`;
  return {
    month,
    slots: [...slots.values()],
    orders,
    cash,
    payments,
    audit: {
      id: id(`audit:${month}`),
      actor_id: adminId,
      actor_role: "admin",
      action: "Demo history seeded",
      target,
      reason: JSON.stringify({
        version: historyVersion,
        start,
        end,
        orders: orders.length,
        receipts: cash.filter((entry) => entry.order_id).length,
      }),
    },
  };
}

export function historySql(plan) {
  const json = JSON.stringify(plan).replaceAll("'", "''");
  const tag = "$apfoods_history_import$";
  if (json.includes(tag)) throw Error("Unexpected SQL delimiter in fixture data");
  return `do ${tag}
declare p jsonb := '${json}'::jsonb;
begin
  perform set_config('lock_timeout','5s',true);
  perform pg_advisory_xact_lock(hashtextextended('apfoods-history-v1',0));
  if exists(select 1 from public.audit_events where id=(p->'audit'->>'id')::uuid) then return; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='ap_food_order_changed' and tgenabled='O') then
    raise exception 'Expected the live order notification trigger to be enabled';
  end if;
  if exists(select 1 from public.orders where id in (select (value->>'id')::uuid from jsonb_array_elements(p->'orders'))) then
    raise exception 'Historical batch has unexpected existing IDs; no records were changed';
  end if;
  -- Only notifications are suspended, under the transaction's table lock. FK,
  -- check constraints and RLS definitions remain intact. Failure rolls this back.
  alter table public.orders disable trigger ap_food_order_changed;
  insert into public.capacity_slots(vendor_id,starts_at,total_units,reserved_units)
    select vendor_id,starts_at,total_units,reserved_units from jsonb_to_recordset(p->'slots') as x(vendor_id text,starts_at timestamptz,total_units int,reserved_units int)
    on conflict(vendor_id,starts_at) do update set
      total_units=greatest(public.capacity_slots.total_units,public.capacity_slots.reserved_units+excluded.reserved_units),
      reserved_units=public.capacity_slots.reserved_units+excluded.reserved_units;
  insert into public.orders(id,student_id,vendor_id,zone_id,pickup_at,status,payment,lines,total_sen,units,version,created_at,updated_at,ready_at,collected_at)
    select id,student_id,vendor_id,zone_id,pickup_at,status,payment,lines,total_sen,units,version,created_at,updated_at,ready_at,collected_at
    from jsonb_to_recordset(p->'orders') as x(id uuid,student_id uuid,vendor_id text,zone_id text,pickup_at timestamptz,status text,payment text,lines jsonb,total_sen int,units int,version int,created_at timestamptz,updated_at timestamptz,ready_at timestamptz,collected_at timestamptz);
  insert into public.order_payments(order_id,status,source,merchant_name,qr_path,expires_at,paid_at)
    select order_id,status,source,merchant_name,qr_path,expires_at,paid_at from jsonb_to_recordset(p->'payments') as x(order_id uuid,status text,source text,merchant_name text,qr_path text,expires_at timestamptz,paid_at timestamptz);
  insert into public.cash_entries(id,vendor_id,zone_id,order_id,kind,amount_sen,label,expense_request_key,reverses_id,created_at)
    select id,vendor_id,zone_id,order_id,kind,amount_sen,label,expense_request_key,reverses_id,created_at from jsonb_to_recordset(p->'cash') as x(id uuid,vendor_id text,zone_id text,order_id uuid,kind text,amount_sen int,label text,expense_request_key uuid,reverses_id uuid,created_at timestamptz);
  insert into public.audit_events(id,actor_id,actor_role,action,target,reason)
    select (p->'audit'->>'id')::uuid,(p->'audit'->>'actor_id')::uuid,'admin','Demo history seeded',p->'audit'->>'target',p->'audit'->>'reason';
  alter table public.orders enable trigger ap_food_order_changed;
end;
${tag};`;
}
