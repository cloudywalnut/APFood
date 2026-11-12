-- Issue eight-digit collection codes. Existing 32-character tokens remain valid
-- for their original five-minute lifetime during rollout. Codes are hashed at
-- rest, order-scoped, and redeemable once by the assigned stall only.

create or replace function public.issue_pickup_code(p_id uuid)
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

  -- Preserve leading zeroes; generate from cryptographic UUID entropy.
  raw := lpad(((('x' || left(encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex'), 15))::bit(60)::bigint) % 100000000)::text, 8, '0');
  expiry := clock_timestamp() + interval '5 minutes';
  insert into private.pickup_codes (order_id, code_hash, expires_at)
    values (p_id, sha256(convert_to(raw, 'UTF8')), expiry)
    on conflict (order_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return jsonb_build_object('code', raw, 'expiresAt', expiry);
end;
$$;

create or replace function public.collect_order(p_id uuid, p_code text, p_counter_confirmed boolean default false)
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
  if not found or token.expires_at <= clock_timestamp() or p_code is null or btrim(p_code) !~ '^([0-9]{8}|[0-9a-fA-F]{32})$'
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

revoke all on function public.issue_pickup_code(uuid), public.collect_order(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.issue_pickup_code(uuid), public.collect_order(uuid,text,boolean) to authenticated;
