import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export const demoActors = {
  student: "00000000-0000-4000-8000-000000000001",
  other: "00000000-0000-4000-8000-000000000002",
  vendor: "00000000-0000-4000-8000-000000000003",
  otherVendor: "00000000-0000-4000-8000-000000000004",
  admin: "00000000-0000-4000-8000-000000000005",
};
export const demoStalls = { noodleBar: "campus-noodle-bar", coffeeBar: "brew-and-bites" };

export async function createLocalDemoDb() {
  const db = new PGlite();
  try {
    // Stand-ins for platform-managed schemas in the disposable database.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      grant usage on schema auth to anon, authenticated;
      create table auth.users (
        id uuid primary key, email text,
        email_confirmed_at timestamptz default now(),
        raw_user_meta_data jsonb not null default '{}'
      );
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      create schema realtime;
      grant usage on schema realtime to authenticated;
      create table realtime.messages (topic text, event text, extension text, payload jsonb);
      alter table realtime.messages enable row level security;
      grant select on realtime.messages to authenticated;
      create function realtime.topic() returns text language sql stable as $$
        select current_setting('realtime.topic', true);
      $$;
      create function realtime.send(payload jsonb, event text, topic text, private boolean)
      returns void language sql as $$
        insert into realtime.messages values (topic, event, 'broadcast', payload);
      $$;
    `);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const migrations = (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
    for (const name of migrations) await db.exec(await readFile(new URL(name, directory), "utf8"));
    const seed = await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8");
    const seedCatalogue = () => db.exec(seed);
    await seedCatalogue();

    const { student, other, vendor, otherVendor, admin } = demoActors;
    const { noodleBar, coffeeBar } = demoStalls;
    await db.transaction(async tx => {
      await tx.query("insert into auth.users (id) values ($1), ($2), ($3), ($4), ($5)",
        [student, other, vendor, otherVendor, admin]);
      await tx.query("delete from public.memberships where user_id = any($1::uuid[])", [[vendor, otherVendor, admin]]);
      await tx.query(`
        insert into public.memberships (user_id, role, vendor_id) values
          ($1, 'student', null), ($2, 'student', null), ($3, 'vendor', $6),
          ($4, 'vendor', $7), ($5, 'admin', null) on conflict do nothing
      `, [student, other, vendor, otherVendor, admin, noodleBar, coffeeBar]);
    });

    const queryAs = (user, sql, args = [], topic) => db.transaction(async tx => {
      await tx.exec(user ? "set local role authenticated" : "set local role anon");
      if (user) await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
      if (topic) await tx.query("select set_config('realtime.topic', $1, true)", [topic]);
      return (await tx.query(sql, args)).rows;
    });
    const call = async (user, sql, args) => (await queryAs(user, "select " + sql + " as value", args))[0].value;
    return { db, seedCatalogue, queryAs, call };
  } catch (error) {
    await db.close();
    throw error;
  }
}
