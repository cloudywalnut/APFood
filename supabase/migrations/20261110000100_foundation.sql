-- Identity, catalogue, and least-privilege order/ledger reads.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.zones (
  id text primary key,
  name text not null unique
);
create table public.vendors (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,95}$'),
  zone_id text not null references public.zones,
  name text not null,
  description text not null default '',
  category text not null default '',
  image text not null default '',
  status text not null default 'approved' check (status in ('approved', 'suspended')),
  paused boolean not null default false,
  capacity integer not null check (capacity between 1 and 300),
  lead_minutes integer not null check (lead_minutes between 1 and 120),
  opens_at time not null,
  closes_at time not null,
  check (opens_at < closes_at)
);
create table public.memberships (
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('student', 'vendor', 'admin')),
  vendor_id text references public.vendors,
  check ((role = 'vendor') = (vendor_id is not null)),
  unique nulls not distinct (user_id, role, vendor_id)
);
create table public.menu_items (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,95}$'),
  vendor_id text not null references public.vendors,
  name text not null,
  description text not null default '',
  price_sen integer not null check (price_sen between 1 and 100000),
  discount_sen integer not null default 0 check (discount_sen >= 0 and discount_sen < price_sen),
  stock integer not null check (stock >= 0),
  active boolean not null default true,
  work_units integer not null check (work_units between 1 and 300)
);
create index menu_items_vendor_idx on public.menu_items (vendor_id);
create table public.capacity_slots (
  vendor_id text not null references public.vendors,
  starts_at timestamptz not null,
  total_units integer not null check (total_units > 0),
  reserved_units integer not null default 0 check (reserved_units between 0 and total_units),
  primary key (vendor_id, starts_at)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users,
  vendor_id text not null references public.vendors,
  zone_id text not null references public.zones,
  pickup_at timestamptz not null,
  status text not null default 'placed' check (status in ('placed','accepted','preparing','ready','collected','cancelled','rejected')),
  payment text not null check (payment in ('demo','counter')),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) > 0),
  total_sen integer not null check (total_sen > 0),
  units integer not null check (units > 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  collected_at timestamptz,
  foreign key (vendor_id, pickup_at) references public.capacity_slots
);
create index orders_student_idx on public.orders (student_id, created_at desc);
create index orders_vendor_idx on public.orders (vendor_id, created_at desc);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users,
  actor_role text not null check (actor_role in ('student','vendor','admin')),
  order_id uuid references public.orders,
  action text not null,
  target text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_order_idx on public.audit_events (order_id, created_at);
create table public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id text references public.vendors,
  zone_id text references public.zones,
  order_id uuid unique references public.orders,
  reverses_id uuid unique references public.cash_entries,
  expense_request_key uuid unique,
  kind text not null check (kind in ('demo','counter','expense','reversal')),
  amount_sen integer not null check (amount_sen > 0),
  label text not null,
  created_at timestamptz not null default now(),
  check ((vendor_id is null) = (zone_id is null)),
  check ((kind in ('demo','counter')) = (order_id is not null)),
  check ((kind = 'expense') = (expense_request_key is not null)),
  check ((kind = 'reversal') = (reverses_id is not null))
);
create index cash_entries_created_idx on public.cash_entries (created_at);

create table private.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users,
  vendor_id text not null references public.vendors,
  cart jsonb not null,
  lines jsonb not null,
  slots timestamptz[] not null,
  expires_at timestamptz not null
);
create index checkout_quotes_student_expiry_idx on private.checkout_quotes (student_id, expires_at);
create table private.checkout_requests (
  student_id uuid not null references auth.users,
  request_key uuid not null,
  quote_id uuid not null unique,
  pickup_at timestamptz not null,
  payment text not null,
  order_id uuid not null references public.orders,
  primary key (student_id, request_key)
);
create table private.pickup_codes (
  order_id uuid primary key references public.orders,
  code_hash bytea not null,
  expires_at timestamptz not null
);

create function private.has_role(p_role text, p_vendor text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role = p_role and m.vendor_id is not distinct from p_vendor
  );
$$;
revoke all on function private.has_role(text, text) from public;
grant execute on function private.has_role(text, text) to anon, authenticated;

alter table public.zones enable row level security;
alter table public.vendors enable row level security;
alter table public.memberships enable row level security;
alter table public.menu_items enable row level security;
alter table public.capacity_slots enable row level security;
alter table public.orders enable row level security;
alter table public.audit_events enable row level security;
alter table public.cash_entries enable row level security;

revoke all on public.zones, public.vendors, public.memberships, public.menu_items,
  public.capacity_slots, public.orders, public.audit_events, public.cash_entries from public, anon, authenticated;
grant select on public.zones, public.vendors, public.menu_items to anon, authenticated;
grant select on public.memberships, public.orders, public.audit_events, public.cash_entries to authenticated;
grant select, insert, update on public.memberships, public.zones, public.vendors, public.menu_items to service_role;

create policy zones_catalogue on public.zones for select to anon, authenticated using (true);
create policy vendors_catalogue on public.vendors for select to anon, authenticated
  using (status = 'approved' or private.has_role('admin') or private.has_role('vendor', id));
create policy items_catalogue on public.menu_items for select to anon, authenticated using (
  (active and exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'approved'))
  or private.has_role('admin') or private.has_role('vendor', vendor_id)
);
create policy own_memberships on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy scoped_orders on public.orders for select to authenticated using (
  (student_id = (select auth.uid()) and private.has_role('student'))
  or private.has_role('vendor', vendor_id) or private.has_role('admin')
);
create policy scoped_audit on public.audit_events for select to authenticated using (
  private.has_role('admin') or exists (
    select 1 from public.orders o where o.id = order_id and private.has_role('vendor', o.vendor_id)
  )
);
create policy admin_cash_entries on public.cash_entries for select to authenticated using (private.has_role('admin'));
