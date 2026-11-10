create function private.lock_order(p_id uuid, p_access text)
returns public.orders language plpgsql set search_path = '' as $$
declare
  target public.orders;
begin
  select * into target from public.orders where id = p_id;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if not (
    (p_access in ('vendor','cancel') and private.has_role('vendor', target.vendor_id))
    or (p_access = 'cancel' and private.has_role('admin'))
    or (p_access in ('student','cancel') and target.student_id = auth.uid() and private.has_role('student'))
  ) then raise exception 'ORDER_NOT_FOUND'; end if;
  perform private.lock_vendor(target.vendor_id);
  select * into target from public.orders where id = p_id for update;
  return target;
end;
$$;

create function public.transition_order(p_id uuid, p_status text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.orders;
  actor text;
  release_allocation boolean := false;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  target := private.lock_order(p_id, case when p_status = 'cancelled' then 'cancel' else 'vendor' end);
  if private.has_role('vendor', target.vendor_id) then actor := 'vendor';
  elsif p_status = 'cancelled' and private.has_role('admin') then actor := 'admin';
  elsif p_status = 'cancelled' and target.student_id = auth.uid() and private.has_role('student') then actor := 'student';
  else raise exception 'ORDER_NOT_FOUND'; end if;

  if p_status = 'cancelled' then
    if not (target.status in ('placed','accepted') or (actor = 'vendor' and target.status = 'preparing'))
      then raise exception 'INVALID_TRANSITION'; end if;
    if actor = 'student' and clock_timestamp() >= target.pickup_at - interval '5 minutes'
      then raise exception 'CANCELLATION_CLOSED'; end if;
    release_allocation := target.status in ('placed','accepted');
  elsif p_status = 'rejected' and target.status = 'placed' then
    release_allocation := true;
  elsif (target.status, p_status) in (('placed','accepted'),('accepted','preparing'),('preparing','ready')) then
    null;
  else
    raise exception 'INVALID_TRANSITION';
  end if;

  if (p_status = 'rejected' or (p_status = 'cancelled' and actor <> 'student'))
    and nullif(btrim(p_reason), '') is null then raise exception 'REASON_REQUIRED'; end if;
  if release_allocation then
    update public.menu_items m set stock = stock + c.quantity
      from (select "itemId" as id, sum(quantity)::int as quantity
        from jsonb_to_recordset(target.lines) as l("itemId" text, quantity int) group by "itemId") c
      where m.id = c.id;
    update public.capacity_slots set reserved_units = reserved_units - target.units
      where vendor_id = target.vendor_id and starts_at = target.pickup_at;
  end if;
  update public.orders set status = p_status, updated_at = clock_timestamp(), version = version + 1,
    ready_at = case when p_status = 'ready' then clock_timestamp() else ready_at end where id = p_id;
  perform private.log_event(actor, 'Order ' || p_status, p_id::text, p_id, left(p_reason, 250));
  return jsonb_build_object('id', p_id, 'status', p_status);
end;
$$;

create function public.issue_pickup_code(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.orders;
  raw text;
  expiry timestamptz;
begin
  perform private.require_role('student');
  target := private.lock_order(p_id, 'student');
  if target.student_id <> auth.uid() then raise exception 'ORDER_NOT_FOUND'; end if;
  if target.status <> 'ready' then raise exception 'INVALID_TRANSITION'; end if;

  raw := upper(left(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'), 32));
  expiry := clock_timestamp() + interval '5 minutes';
  insert into private.pickup_codes (order_id, code_hash, expires_at)
    values (p_id, sha256(convert_to(raw, 'UTF8')), expiry)
    on conflict (order_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return jsonb_build_object('code', raw, 'expiresAt', expiry);
end;
$$;

create function public.collect_order(p_id uuid, p_code text, p_counter_confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.orders;
  token private.pickup_codes;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  target := private.lock_order(p_id, 'vendor');
  if not private.has_role('vendor', target.vendor_id) then raise exception 'ORDER_NOT_FOUND'; end if;
  if target.status = 'collected' then raise exception 'PICKUP_ALREADY_USED'; end if;
  if target.status <> 'ready' then raise exception 'INVALID_TRANSITION'; end if;
  if target.payment = 'counter' and p_counter_confirmed is distinct from true then
    raise exception 'COUNTER_CONFIRMATION_REQUIRED'; end if;
  select * into token from private.pickup_codes where order_id = p_id;
  if not found or token.expires_at <= clock_timestamp() or p_code is null or btrim(p_code) !~ '^[0-9a-fA-F]{32}$'
    or token.code_hash <> sha256(convert_to(upper(btrim(p_code)), 'UTF8')) then
    raise exception 'PICKUP_CODE_INVALID';
  end if;

  delete from private.pickup_codes where order_id = p_id;
  update public.orders set status = 'collected', collected_at = clock_timestamp(),
    updated_at = clock_timestamp(), version = version + 1 where id = p_id;
  insert into public.cash_entries (vendor_id, zone_id, order_id, kind, amount_sen, label)
    values (target.vendor_id, target.zone_id, p_id, target.payment, target.total_sen, 'Pickup ' || left(p_id::text, 8));
  perform private.log_event('vendor', 'Order collected', p_id::text, p_id);
  return jsonb_build_object('id', p_id, 'status', 'collected');
end;
$$;

revoke all on function private.lock_order(uuid,text) from public;
revoke all on function public.transition_order(uuid,text,text), public.issue_pickup_code(uuid),
  public.collect_order(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.transition_order(uuid,text,text), public.issue_pickup_code(uuid),
  public.collect_order(uuid,text,boolean) to authenticated;
