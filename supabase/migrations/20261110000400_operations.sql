create function public.update_vendor_settings(p_id text, p_capacity integer, p_lead integer,
  p_opens time, p_closes time, p_paused boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role('vendor', p_id);
  perform private.lock_vendor(p_id);
  update public.vendors set capacity = coalesce(p_capacity, capacity), lead_minutes = coalesce(p_lead, lead_minutes),
    opens_at = coalesce(p_opens, opens_at), closes_at = coalesce(p_closes, closes_at),
    paused = coalesce(p_paused, paused) where id = p_id;
  -- Existing buckets retain their original capacity. Only newly created buckets use the new setting.
  perform private.log_event('vendor', 'Updated stall settings', p_id);
end;
$$;

create function public.save_menu_item(p_vendor text, p_id text, p_name text, p_description text, p_price integer,
  p_stock integer, p_active boolean, p_units integer, p_expected_stock integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.menu_items;
begin
  perform private.require_role('vendor', p_vendor);
  perform private.lock_vendor(p_vendor);
  select * into previous from public.menu_items where id = p_id;
  if found then
    if previous.vendor_id <> p_vendor then raise exception 'ITEM_UNAVAILABLE'; end if;
    if previous.stock is distinct from p_expected_stock then raise exception 'STOCK_CHANGED'; end if;
    update public.menu_items set name = p_name, description = p_description, price_sen = p_price,
      discount_sen = case when discount_sen < p_price then discount_sen else 0 end,
      stock = p_stock, active = p_active, work_units = p_units where id = p_id;
  else
    insert into public.menu_items (id, vendor_id, name, description, price_sen, stock, active, work_units)
      values (p_id, p_vendor, p_name, p_description, p_price, p_stock, p_active, p_units);
  end if;
  perform private.log_event('vendor', 'Saved menu item', p_id);
end;
$$;

create function public.admin_manage_vendor(p_id text, p_status text, p_zone text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_role('admin');
  if nullif(btrim(p_reason), '') is null then raise exception 'REASON_REQUIRED'; end if;
  perform private.lock_vendor(p_id);
  update public.vendors set status = coalesce(p_status, status), zone_id = coalesce(p_zone, zone_id) where id = p_id;
  if not found then raise exception 'STALL_UNAVAILABLE'; end if;
  perform private.log_event('admin', 'Updated stall', p_id, null, left(p_reason, 250));
end;
$$;

create function public.record_expense(p_vendor text, p_amount integer, p_label text, p_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  entry_id uuid;
  prior public.cash_entries;
  label text := left(btrim(p_label), 150);
  expense_zone text;
begin
  perform private.require_role('admin');
  if p_key is null or p_amount is null or p_amount not between 1 and 10000000 or nullif(label, '') is null then
    raise exception 'INVALID_EXPENSE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('expense:' || p_key, 0));
  select * into prior from public.cash_entries where expense_request_key = p_key;
  if found then
    if (prior.vendor_id, prior.amount_sen, prior.label) is distinct from (p_vendor, p_amount, label)
      then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return prior.id;
  end if;
  if p_vendor is not null then
    select zone_id into expense_zone from public.vendors where id = p_vendor;
    if not found then raise exception 'STALL_UNAVAILABLE'; end if;
  end if;
  insert into public.cash_entries (vendor_id, zone_id, kind, amount_sen, label, expense_request_key)
  values (p_vendor, expense_zone, 'expense', p_amount, label, p_key) returning id into entry_id;
  perform private.log_event('admin', 'Recorded expense', entry_id::text, null, label);
  return entry_id;
end;
$$;

create function public.reverse_expense(p_entry uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  original public.cash_entries;
  entry_id uuid;
begin
  perform private.require_role('admin');
  if nullif(btrim(p_reason), '') is null then raise exception 'REASON_REQUIRED'; end if;
  select * into original from public.cash_entries where id = p_entry and kind = 'expense' for update;
  if not found or exists (select 1 from public.cash_entries where reverses_id = p_entry) then
    raise exception 'EXPENSE_UNAVAILABLE';
  end if;
  insert into public.cash_entries (vendor_id, zone_id, kind, amount_sen, label, reverses_id)
    values (original.vendor_id, original.zone_id, 'reversal', original.amount_sen, original.label || ' reversal', original.id)
    returning id into entry_id;
  perform private.log_event('admin', 'Reversed expense', original.id::text, null, left(p_reason, 250));
  return entry_id;
end;
$$;

create function public.pickup_activity()
returns table(vendor_id text, starts_at timestamptz, pickup_count bigint, reserved_units integer, total_units integer)
language sql stable security definer set search_path = '' as $$
  select v.id, s.t, coalesce(o.pickup_count, 0), coalesce(c.reserved_units, 0),
    coalesce(c.total_units, v.capacity)
  from public.vendors v
  cross join generate_series(date_bin(interval '15 minutes', now(), timestamptz '2000-01-01 UTC'),
    now() + interval '2 hours', interval '15 minutes') as s(t)
  left join public.capacity_slots c on c.vendor_id = v.id and c.starts_at = s.t
  left join lateral (
    select count(*) as pickup_count from public.orders a where a.vendor_id = v.id and a.pickup_at = s.t
      and a.status in ('placed', 'accepted', 'preparing', 'ready')
  ) o on true
  where v.status = 'approved' and (
    c.reserved_units > 0 or private.slot_fits(v, s.t, 0)
  )
  order by v.id, s.t;
$$;

revoke all on function public.update_vendor_settings(text,integer,integer,time,time,boolean),
  public.save_menu_item(text,text,text,text,integer,integer,boolean,integer,integer),
  public.admin_manage_vendor(text,text,text,text), public.record_expense(text,integer,text,uuid),
  public.reverse_expense(uuid,text), public.pickup_activity() from public, anon, authenticated;
grant execute on function public.update_vendor_settings(text,integer,integer,time,time,boolean),
  public.save_menu_item(text,text,text,text,integer,integer,boolean,integer,integer),
  public.admin_manage_vendor(text,text,text,text), public.record_expense(text,integer,text,uuid),
  public.reverse_expense(uuid,text) to authenticated;
grant execute on function public.pickup_activity() to anon, authenticated;
