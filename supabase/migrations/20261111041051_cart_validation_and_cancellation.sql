-- A saved cart may contain items whose stock has changed. Checkout revalidates it.
create or replace function public.save_cart(p_vendor text, p_items jsonb, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.carts;
begin
  perform private.require_role('student');
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then raise exception 'INVALID_CART'; end if;
  if jsonb_array_length(p_items) > 0 then
    if not exists (select 1 from public.vendors where id = p_vendor) then raise exception 'STALL_UNAVAILABLE'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_items) as c("itemId" text, quantity int, extra boolean)
      where c."itemId" is null or c."itemId" !~ '^[a-z0-9][a-z0-9-]{0,95}$'
        or c.quantity is null or c.quantity not between 1 and 20 or c.extra is null
    ) or exists (
      select 1 from jsonb_to_recordset(p_items) as c("itemId" text, quantity int, extra boolean)
      group by c."itemId", c.extra having count(*) > 1
    ) then raise exception 'INVALID_CART'; end if;
  elsif p_vendor is not null then raise exception 'INVALID_CART'; end if;
  insert into public.carts (user_id) values (auth.uid()) on conflict do nothing;
  update public.carts set vendor_id = p_vendor, items = p_items, revision = revision + 1, updated_at = clock_timestamp()
    where user_id = auth.uid() and revision = p_revision returning * into saved;
  if not found then raise exception 'CART_CHANGED'; end if;
  return to_jsonb(saved);
end;
$$;

create or replace function private.transition_order_base(p_id uuid, p_status text, p_reason text default null)
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

\n