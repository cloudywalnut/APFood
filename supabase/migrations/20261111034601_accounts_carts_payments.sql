-- Account state is checked on every privileged operation, including existing JWTs.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (length(display_name) <= 80),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;

create function private.create_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 80));
  insert into public.memberships (user_id, role) values (new.id, 'student')
    on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.create_account() from public;
create trigger ap_food_create_account after insert on auth.users
  for each row execute function private.create_account();
insert into public.profiles (id, display_name)
  select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 80) from auth.users
  on conflict do nothing;
insert into public.memberships (user_id, role)
  select id, 'student' from auth.users on conflict do nothing;

create or replace function private.has_role(p_role text, p_vendor text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.user_id and p.status = 'active'
    join auth.users u on u.id = m.user_id and u.email_confirmed_at is not null
    where m.user_id = auth.uid() and m.role = p_role and m.vendor_id is not distinct from p_vendor
  );
$$;
create policy profile_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.has_role('admin'));

create function public.update_profile(p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then raise exception 'INVALID_PROFILE'; end if;
  update public.profiles set display_name = btrim(p_name)
    where id = auth.uid() and status = 'active';
  if not found then raise exception 'FORBIDDEN'; end if;
end;
$$;

-- Serialise administrator changes so simultaneous demotions cannot remove every admin.
create function public.manage_account(p_user uuid, p_status text, p_memberships jsonb, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare entry jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('ap-food:account-management', 0));
  perform private.require_role('admin');
  if p_reason is null or length(btrim(p_reason)) not between 1 and 250 then raise exception 'REASON_REQUIRED'; end if;
  if p_status not in ('active', 'suspended') or p_status is null or
    jsonb_typeof(p_memberships) is distinct from 'array' or jsonb_array_length(p_memberships) not between 1 and 20
    then raise exception 'INVALID_PROFILE'; end if;
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  delete from public.memberships where user_id = p_user;
  for entry in select * from jsonb_array_elements(p_memberships) loop
    insert into public.memberships (user_id, role, vendor_id)
      values (p_user, entry->>'role', nullif(entry->>'vendor_id', ''));
  end loop;
  update public.profiles set status = p_status where id = p_user;
  if not exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where m.role = 'admin' and p.status = 'active'
  ) then raise exception 'LAST_ADMIN'; end if;
  perform private.log_event('admin', 'Account updated', p_user::text, null, p_reason);
end;
$$;

create function public.list_accounts(p_search text default '', p_role text default '', p_status text default '', p_page integer default 1)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_role('admin');
  if p_page < 1 or p_page > 10000 or length(p_search) > 100 then raise exception 'INVALID_PROFILE'; end if;
  with matched as (
    select p.id, p.display_name, p.status, p.created_at, u.email, u.email_confirmed_at,
      coalesce((select jsonb_agg(jsonb_build_object('role', m.role, 'vendor_id', m.vendor_id))
        from public.memberships m where m.user_id = p.id), '[]'::jsonb) as memberships
    from public.profiles p join auth.users u on u.id = p.id
    where (p_search = '' or p.display_name ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%')
      and (p_status = '' or p.status = p_status)
      and (p_role = '' or exists (select 1 from public.memberships m where m.user_id = p.id and m.role = p_role))
  )
  select jsonb_build_object('total', (select count(*) from matched), 'users',
    coalesce((select jsonb_agg(page) from (select * from matched order by created_at desc, id limit 20 offset (p_page - 1) * 20) page), '[]'::jsonb))
    into result;
  return result;
end;
$$;

-- Only stored identifiers and quantities are authoritative in a cart.
create table public.carts (
  user_id uuid primary key references auth.users on delete cascade,
  vendor_id text references public.vendors,
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
alter table public.carts enable row level security;
revoke all on public.carts from public, anon, authenticated;
grant select on public.carts to authenticated;
create policy own_cart on public.carts for select to authenticated
  using (user_id = (select auth.uid()) and private.has_role('student'));

create function public.save_cart(p_vendor text, p_items jsonb, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.carts;
begin
  perform private.require_role('student');
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_CART'; end if;
  if jsonb_array_length(p_items) > 0 then
    perform private.price_cart(p_vendor, p_items);
    if not exists (select 1 from public.vendors where id = p_vendor and status = 'approved' and not paused)
      then raise exception 'STALL_UNAVAILABLE'; end if;
  elsif p_vendor is not null then raise exception 'INVALID_CART'; end if;
  insert into public.carts (user_id) values (auth.uid()) on conflict do nothing;
  update public.carts set vendor_id = p_vendor, items = p_items, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = auth.uid() and revision = p_revision returning * into saved;
  if not found then raise exception 'CART_CHANGED'; end if;
  return to_jsonb(saved);
end;
$$;

-- Payment-channel metadata stays separate from the kitchen's order state.
alter table public.orders drop constraint orders_payment_check;
alter table public.orders add constraint orders_payment_check check (payment in ('demo','counter','duitnow_qr'));
create table public.vendor_payments (
  vendor_id text primary key references public.vendors,
  merchant_name text not null check (length(btrim(merchant_name)) between 1 and 100),
  qr_path text not null check (length(qr_path) between 1 and 250),
  updated_at timestamptz not null default now()
);
alter table public.vendor_payments enable row level security;
revoke all on public.vendor_payments from public, anon, authenticated;
grant select on public.vendor_payments to anon, authenticated;
create policy published_vendor_payment on public.vendor_payments for select to anon, authenticated
  using (exists (select 1 from public.vendors v where v.id = vendor_id and v.status = 'approved')
    or private.has_role('vendor', vendor_id) or private.has_role('admin'));

create table public.order_payments (
  order_id uuid primary key references public.orders,
  status text not null check (status in ('pending','paid','expired','refund_pending','refunded')),
  source text not null check (source in ('customer_claimed_demo','counter')),
  merchant_name text,
  qr_path text,
  expires_at timestamptz,
  paid_at timestamptz,
  refund_reference text,
  refunded_at timestamptz
);
create index pending_payment_expiry_idx on public.order_payments (expires_at) where status = 'pending';
alter table public.order_payments enable row level security;
revoke all on public.order_payments from public, anon, authenticated;
grant select on public.order_payments to authenticated;
create policy order_payment_read on public.order_payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create table private.app_settings (
  id boolean primary key default true check (id),
  qr_demo_enabled boolean not null default false
);
insert into private.app_settings default values;
revoke all on private.app_settings from public, anon, authenticated;

create function public.save_vendor_payment(p_vendor text, p_name text, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role('vendor', p_vendor);
  if p_name is null or length(btrim(p_name)) not between 1 and 100 or p_path is null
    or p_path not like p_vendor || '/%' or p_path !~ '^[a-z0-9-]+/[a-f0-9-]+\.(png|jpg|webp)$'
    then raise exception 'INVALID_PROFILE'; end if;
  insert into public.vendor_payments (vendor_id, merchant_name, qr_path) values (p_vendor, btrim(p_name), p_path)
    on conflict (vendor_id) do update set merchant_name = excluded.merchant_name, qr_path = excluded.qr_path, updated_at = clock_timestamp();
  perform private.log_event('vendor', 'Payment settings updated', p_vendor);
end;
$$;

-- Preserve the established checkout transaction and its retry contract.
alter function public.place_order(uuid,timestamptz,text,uuid) rename to place_order_base;
alter function public.place_order_base(uuid,timestamptz,text,uuid) set schema private;
revoke all on function private.place_order_base(uuid,timestamptz,text,uuid) from public, anon, authenticated;

create function public.place_order(p_quote uuid, p_pickup timestamptz, p_payment text, p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare placed jsonb; prior private.checkout_requests; previous_payment text; q private.checkout_quotes; details public.vendor_payments;
begin
  perform private.require_role('student');
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || auth.uid() || ':' || p_key, 0));
  select * into prior from private.checkout_requests where student_id = auth.uid() and request_key = p_key;
  if found then
    select payment into previous_payment from public.orders where id = prior.order_id;
    if (prior.quote_id, prior.pickup_at, previous_payment) is distinct from (p_quote, p_pickup, p_payment)
      then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return jsonb_build_object('id', prior.order_id);
  end if;
  if p_payment = 'duitnow_qr' then
    if not (select qr_demo_enabled from private.app_settings where id) then raise exception 'PAYMENT_UNAVAILABLE'; end if;
    select * into q from private.checkout_quotes where id = p_quote and student_id = auth.uid();
    if not found then raise exception 'QUOTE_EXPIRED'; end if;
    perform private.lock_vendor(q.vendor_id);
    select * into details from public.vendor_payments where vendor_id = q.vendor_id;
    if not found then raise exception 'PAYMENT_UNAVAILABLE'; end if;
    if p_pickup < clock_timestamp() + interval '5 minutes' +
      make_interval(mins => (select lead_minutes from public.vendors where id = q.vendor_id))
      then raise exception 'SLOT_UNAVAILABLE'; end if;
    placed := private.place_order_base(p_quote, p_pickup, 'demo', p_key);
    update public.orders set payment = 'duitnow_qr' where id = (placed->>'id')::uuid;
    insert into public.order_payments (order_id, status, source, merchant_name, qr_path, expires_at)
      values ((placed->>'id')::uuid, 'pending', 'customer_claimed_demo', details.merchant_name, details.qr_path, clock_timestamp() + interval '5 minutes');
  else
    placed := private.place_order_base(p_quote, p_pickup, p_payment, p_key);
  end if;
  return placed;
end;
$$;

create function public.checkout_cart(p_quote uuid, p_pickup timestamptz, p_payment text, p_key uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cart public.carts; q private.checkout_quotes; placed jsonb;
begin
  perform private.require_role('student');
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || auth.uid() || ':' || p_key, 0));
  if exists (select 1 from private.checkout_requests where student_id = auth.uid() and request_key = p_key) then
    return public.place_order(p_quote, p_pickup, p_payment, p_key);
  end if;
  select * into cart from public.carts where user_id = auth.uid() for update;
  if not found or cart.revision <> p_revision then raise exception 'CART_CHANGED'; end if;
  select * into q from private.checkout_quotes where id = p_quote and student_id = auth.uid();
  if not found or q.vendor_id is distinct from cart.vendor_id or q.cart <> cart.items then raise exception 'CART_CHANGED'; end if;
  placed := public.place_order(p_quote, p_pickup, p_payment, p_key);
  update public.carts set items = '[]', vendor_id = null, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = auth.uid();
  return placed;
end;
$$;

create function public.claim_qr_payment(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders; payment public.order_payments;
begin
  target := private.lock_order(p_id, 'student');
  if target.student_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (select qr_demo_enabled from private.app_settings where id) then raise exception 'PAYMENT_UNAVAILABLE'; end if;
  select * into payment from public.order_payments where order_id = p_id for update;
  if payment.status = 'paid' then return; end if;
  if not found or payment.status <> 'pending' or payment.expires_at <= clock_timestamp()
    or target.status <> 'placed' then raise exception 'PAYMENT_EXPIRED'; end if;
  update public.order_payments set status = 'paid', paid_at = clock_timestamp() where order_id = p_id;
  update public.orders set version = version + 1, updated_at = clock_timestamp() where id = p_id;
  perform private.log_event('student', 'Payment submitted', p_id::text, p_id);
end;
$$;

-- Extend fulfilment without weakening the original authorisation and stock release logic.
alter function public.transition_order(uuid,text,text) rename to transition_order_base;
alter function public.transition_order_base(uuid,text,text) set schema private;
revoke all on function private.transition_order_base(uuid,text,text) from public, anon, authenticated;
create function public.transition_order(p_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.orders; payment public.order_payments; result jsonb;
begin
  -- Same vendor lock used by placement, expiry, payment, and collection.
  select * into target from public.orders where id = p_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  perform private.lock_vendor(target.vendor_id);
  if target.payment = 'duitnow_qr' then
    select * into payment from public.order_payments where order_id = p_id for update;
    if p_status not in ('cancelled','rejected') and payment.status <> 'paid' then raise exception 'PAYMENT_REQUIRED'; end if;
  end if;
  result := private.transition_order_base(p_id, p_status, p_reason);
  if target.payment = 'duitnow_qr' and p_status in ('cancelled','rejected') then
    update public.order_payments set status = case when status = 'paid' then 'refund_pending' else 'expired' end where order_id = p_id;
  end if;
  return result;
end;
$$;

alter table public.cash_entries drop constraint cash_entries_kind_check;
alter table public.cash_entries drop constraint cash_entries_check1;
alter table public.cash_entries add constraint cash_entries_kind_check check (kind in ('demo','counter','duitnow_qr','refund','expense','reversal'));
alter table public.cash_entries add constraint receipt_order_check check ((kind in ('demo','counter','duitnow_qr')) = (order_id is not null));

create function public.record_refund(p_id uuid, p_reference text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.orders;
begin
  select * into target from public.orders where id = p_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not private.has_role('admin') then perform private.require_role('vendor', target.vendor_id); end if;
  perform private.lock_vendor(target.vendor_id);
  if p_reference is null or length(btrim(p_reference)) not between 1 and 120 then raise exception 'REASON_REQUIRED'; end if;
  update public.order_payments set status = 'refunded', refund_reference = btrim(p_reference), refunded_at = clock_timestamp()
    where order_id = p_id and status = 'refund_pending';
  if not found then raise exception 'INVALID_TRANSITION'; end if;
  -- A pre-collection refund settles a payment liability, not collected revenue.
  perform private.log_event(case when private.has_role('admin') then 'admin' else 'vendor' end, 'Refund recorded', p_id::text, p_id, p_reference);
end;
$$;

create function private.expire_qr_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare target public.orders; released integer := 0;
begin
  for target in select o.* from public.orders o join public.order_payments p on p.order_id = o.id
    where o.status = 'placed' and p.status = 'pending' and p.expires_at <= clock_timestamp()
    order by o.vendor_id, o.id loop
    perform private.lock_vendor(target.vendor_id);
    perform 1 from public.orders where id = target.id and status = 'placed' for update;
    if not found then continue; end if;
    update public.order_payments set status = 'expired'
      where order_id = target.id and status = 'pending' and expires_at <= clock_timestamp();
    if not found then continue; end if;
    update public.menu_items m set stock = stock + line.quantity from (
      select "itemId" as id, sum(quantity)::int as quantity from jsonb_to_recordset(target.lines) as l("itemId" text, quantity int)
      group by "itemId"
    ) line where m.id = line.id;
    update public.capacity_slots set reserved_units = reserved_units - target.units
      where vendor_id = target.vendor_id and starts_at = target.pickup_at;
    update public.orders set status = 'cancelled', version = version + 1, updated_at = clock_timestamp() where id = target.id;
    released := released + 1;
  end loop;
  return released;
end;
$$;
revoke all on function private.expire_qr_orders() from public, anon, authenticated;

revoke all on function public.update_profile(text), public.manage_account(uuid,text,jsonb,text),
  public.list_accounts(text,text,text,integer), public.save_cart(text,jsonb,integer),
  public.save_vendor_payment(text,text,text), public.place_order(uuid,timestamptz,text,uuid),
  public.checkout_cart(uuid,timestamptz,text,uuid,integer), public.claim_qr_payment(uuid),
  public.transition_order(uuid,text,text), public.record_refund(uuid,text) from public, anon, authenticated;
grant execute on function public.update_profile(text), public.manage_account(uuid,text,jsonb,text),
  public.list_accounts(text,text,text,integer), public.save_cart(text,jsonb,integer),
  public.save_vendor_payment(text,text,text), public.place_order(uuid,timestamptz,text,uuid),
  public.checkout_cart(uuid,timestamptz,text,uuid,integer), public.claim_qr_payment(uuid),
  public.transition_order(uuid,text,text), public.record_refund(uuid,text) to authenticated;

create function private.guard_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ap-food:account-management', 0));
  if not exists (
    select 1 from public.memberships m join public.profiles p on p.id = m.user_id
    where m.role = 'admin' and p.status = 'active'
  ) then raise exception 'LAST_ADMIN'; end if;
  return null;
end;
$$;
revoke all on function private.guard_last_admin() from public;
create constraint trigger protect_admin_membership after delete or update on public.memberships
  deferrable initially deferred for each row when (old.role = 'admin')
  execute function private.guard_last_admin();
create constraint trigger protect_admin_profile after update on public.profiles
  deferrable initially deferred for each row when (old.status = 'active' and new.status = 'suspended')
  execute function private.guard_last_admin();

create table private.auth_limits (
  key text primary key,
  expires_at timestamptz not null,
  attempts integer not null
);
create function public.consume_auth_request(p_key text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  if p_limit not between 1 and 100 or p_seconds not between 1 and 3600 or length(p_key) <> 64
    then return false; end if;
  delete from private.auth_limits where expires_at < clock_timestamp() - interval '1 day';
  insert into private.auth_limits (key, expires_at, attempts) values (p_key, clock_timestamp() + make_interval(secs => p_seconds), 1)
    on conflict (key) do update set
      attempts = case when private.auth_limits.expires_at < clock_timestamp() then 1 else private.auth_limits.attempts + 1 end,
      expires_at = case when private.auth_limits.expires_at < clock_timestamp() then excluded.expires_at else private.auth_limits.expires_at end
    returning attempts into used;
  return used <= p_limit;
end;
$$;
revoke all on function public.consume_auth_request(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_auth_request(text,integer,integer) to service_role;
