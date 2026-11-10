create function private.require_role(p_role text, p_vendor text default null)
returns void language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not private.has_role(p_role, p_vendor) then raise exception 'FORBIDDEN'; end if;
end;
$$;

create function private.price_cart(p_vendor text, p_cart jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  priced jsonb;
  entries integer;
begin
  if p_cart is null or jsonb_typeof(p_cart) <> 'array' then raise exception 'INVALID_CART'; end if;
  entries := jsonb_array_length(p_cart);
  if entries not between 1 and 20 then raise exception 'INVALID_CART'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_cart) as c("itemId" text, quantity int, extra boolean)
    where c."itemId" is null or c.quantity is null or c.quantity not between 1 and 20 or c.extra is null
  ) or exists (
    select 1 from jsonb_to_recordset(p_cart) as c("itemId" text, quantity int, extra boolean)
    group by c."itemId", c.extra having count(*) > 1
  ) then raise exception 'INVALID_CART'; end if;

  select jsonb_agg(jsonb_build_object(
    'itemId', m.id, 'name', m.name, 'quantity', c.quantity, 'extra', c.extra,
    'unit', m.price_sen - m.discount_sen + case when c.extra then 200 else 0 end,
    'work', m.work_units
  ) order by m.id, c.extra) into priced
  from jsonb_to_recordset(p_cart) as c("itemId" text, quantity int, extra boolean)
  join public.menu_items m on m.id = c."itemId" and m.vendor_id = p_vendor and m.active;

  if priced is null or jsonb_array_length(priced) <> entries then raise exception 'ITEM_UNAVAILABLE'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_cart) as c("itemId" text, quantity int, extra boolean)
    join public.menu_items m on m.id = c."itemId"
    group by m.id, m.stock having sum(c.quantity) > m.stock
  ) then raise exception 'OUT_OF_STOCK'; end if;
  return priced;
end;
$$;

create function private.units(p_lines jsonb)
returns integer language sql immutable set search_path = '' as $$
  select sum(quantity * work)::int from jsonb_to_recordset(p_lines) as l(quantity int, work int);
$$;
create function private.total_sen(p_lines jsonb)
returns integer language sql immutable set search_path = '' as $$
  select sum(quantity * unit)::int from jsonb_to_recordset(p_lines) as l(quantity int, unit int);
$$;
create function private.slot_fits(v public.vendors, p_start timestamptz, p_units int, p_now timestamptz default now())
returns boolean language sql stable set search_path = '' as $$
  select v.status = 'approved' and not v.paused
    and p_start >= p_now + make_interval(mins => v.lead_minutes)
    and p_start <= p_now + interval '2 hours'
    and p_start = date_bin(interval '15 minutes', p_start, timestamptz '2000-01-01 UTC')
    and (p_start at time zone 'Asia/Kuala_Lumpur')::time >= v.opens_at
    and (p_start at time zone 'Asia/Kuala_Lumpur') + interval '15 minutes'
      <= (p_start at time zone 'Asia/Kuala_Lumpur')::date + v.closes_at
    and p_units <= coalesce(
      (select s.total_units - s.reserved_units from public.capacity_slots s
       where s.vendor_id = v.id and s.starts_at = p_start), v.capacity);
$$;

create function public.quote_checkout(p_vendor text, p_cart jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.vendors;
  priced jsonb;
  windows timestamptz[];
  q private.checkout_quotes;
begin
  perform private.require_role('student');
  select * into v from public.vendors where id = p_vendor and status = 'approved' and not paused;
  if not found then raise exception 'STALL_UNAVAILABLE'; end if;
  priced := private.price_cart(v.id, p_cart);
  select array_agg(t order by t) into windows
  from generate_series(date_bin(interval '15 minutes', now(), timestamptz '2000-01-01 UTC'),
    now() + interval '2 hours', interval '15 minutes') as s(t)
  where private.slot_fits(v, t, private.units(priced));
  if windows is null then raise exception 'SLOT_UNAVAILABLE'; end if;
  delete from private.checkout_quotes where student_id = auth.uid() and expires_at <= now();
  insert into private.checkout_quotes (student_id, vendor_id, cart, lines, slots, expires_at)
  values (auth.uid(), v.id, p_cart, priced, windows, now() + interval '120 seconds') returning * into q;
  return jsonb_build_object('quoteId', q.id, 'expiresAt', q.expires_at, 'totalSen', private.total_sen(priced),
    'slots', to_jsonb(windows), 'lines', priced);
end;
$$;

create function private.lock_vendor(p_vendor text)
returns void language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('vendor:' || p_vendor, 0));
$$;
create function private.log_event(p_role text, p_action text, p_target text, p_order uuid default null, p_reason text default null)
returns void language sql set search_path = '' as $$
  insert into public.audit_events (actor_id, actor_role, action, target, order_id, reason)
  values (auth.uid(), p_role, p_action, p_target, p_order, p_reason);
$$;

create function public.place_order(p_quote uuid, p_pickup timestamptz, p_payment text, p_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.vendors;
  q private.checkout_quotes;
  prior private.checkout_requests;
  priced jsonb;
  required_units integer;
  placed public.orders;
begin
  perform private.require_role('student');
  if p_key is null or p_quote is null or p_pickup is null or p_payment is null or p_payment not in ('demo','counter')
  then raise exception 'INVALID_CHECKOUT'; end if;

  perform pg_advisory_xact_lock(hashtextextended('checkout:' || auth.uid() || ':' || p_key, 0));
  select * into prior from private.checkout_requests where student_id = auth.uid() and request_key = p_key;
  if found then
    if (prior.quote_id, prior.pickup_at, prior.payment) is distinct from (p_quote, p_pickup, p_payment)
    then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return jsonb_build_object('id', prior.order_id);
  end if;

  select * into q from private.checkout_quotes where id = p_quote and student_id = auth.uid();
  if not found or q.expires_at <= clock_timestamp() then raise exception 'QUOTE_EXPIRED'; end if;
  if not (p_pickup = any(q.slots)) then raise exception 'SLOT_UNAVAILABLE'; end if;

  perform private.lock_vendor(q.vendor_id);
  if exists (select 1 from private.checkout_requests where quote_id = q.id) then raise exception 'QUOTE_USED'; end if;
  if q.expires_at <= clock_timestamp() then raise exception 'QUOTE_EXPIRED'; end if;
  select * into v from public.vendors where id = q.vendor_id and status = 'approved' and not paused;
  if not found then raise exception 'STALL_UNAVAILABLE'; end if;
  priced := private.price_cart(v.id, q.cart);
  if priced <> q.lines then raise exception 'PRICE_CHANGED'; end if;
  required_units := private.units(priced);
  if not private.slot_fits(v, p_pickup, required_units, clock_timestamp()) then raise exception 'SLOT_UNAVAILABLE'; end if;

  insert into public.capacity_slots (vendor_id, starts_at, total_units) values (v.id, p_pickup, v.capacity)
  on conflict (vendor_id, starts_at) do nothing;
  update public.capacity_slots set reserved_units = reserved_units + required_units
    where vendor_id = v.id and starts_at = p_pickup;
  update public.menu_items m set stock = stock - c.quantity
  from (
    select "itemId" as id, sum(quantity)::int as quantity
    from jsonb_to_recordset(priced) as l("itemId" text, quantity int) group by "itemId"
  ) c where m.id = c.id;

  insert into public.orders (student_id, vendor_id, zone_id, pickup_at, payment, lines, total_sen, units)
  values (auth.uid(), v.id, v.zone_id, p_pickup, p_payment, priced, private.total_sen(priced), required_units)
  returning * into placed;
  insert into private.checkout_requests values (auth.uid(), p_key, q.id, p_pickup, p_payment, placed.id);
  perform private.log_event('student', 'Order placed', placed.id::text, placed.id);
  return jsonb_build_object('id', placed.id);
end;
$$;

revoke all on function private.require_role(text,text), private.price_cart(text,jsonb),
  private.units(jsonb), private.total_sen(jsonb),
  private.slot_fits(public.vendors,timestamptz,integer,timestamptz), private.lock_vendor(text),
  private.log_event(text,text,text,uuid,text) from public;
revoke all on function public.quote_checkout(text,jsonb), public.place_order(uuid,timestamptz,text,uuid)
  from public, anon, authenticated;
grant execute on function public.quote_checkout(text,jsonb), public.place_order(uuid,timestamptz,text,uuid)
  to authenticated;
