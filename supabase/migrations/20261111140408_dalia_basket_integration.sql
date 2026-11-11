-- Keep existing carts and order URLs; optional vendorId adds cross-stall lines.
create or replace function public.save_cart(p_vendor text, p_items jsonb, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved public.carts;
begin
  perform private.require_role('student');
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then raise exception 'INVALID_CART'; end if;
  if jsonb_array_length(p_items) > 0 then
    if not exists (select 1 from public.vendors where id = p_vendor) then raise exception 'STALL_UNAVAILABLE'; end if;
    if exists (
      select 1 from jsonb_to_recordset(p_items) as c("itemId" text, "vendorId" text, quantity int, extra boolean)
      left join public.menu_items m on m.id = c."itemId" and m.vendor_id = coalesce(c."vendorId", p_vendor)
      where m.id is null or c.quantity is null or c.quantity not between 1 and 20 or c.extra is null
    ) or exists (
      select 1 from jsonb_to_recordset(p_items) as c("itemId" text, extra boolean)
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

create table private.basket_requests (
  student_id uuid not null references auth.users on delete cascade,
  request_key uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (student_id, request_key)
);
revoke all on private.basket_requests from public, anon, authenticated;

create function public.checkout_basket(p_orders jsonb, p_key uuid, p_revision integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saved public.carts;
  previous private.basket_requests;
  entry jsonb;
  quote private.checkout_quotes;
  expected jsonb;
  placed jsonb;
  result jsonb := '[]';
  stall text;
begin
  perform private.require_role('student');
  if p_key is null or p_orders is null or jsonb_typeof(p_orders) <> 'array'
    or jsonb_array_length(p_orders) not between 1 and 10 then raise exception 'INVALID_CHECKOUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('basket:' || auth.uid() || ':' || p_key, 0));
  select * into previous from private.basket_requests where student_id = auth.uid() and request_key = p_key;
  if found then
    if previous.payload <> jsonb_build_object('orders', p_orders, 'revision', p_revision) then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return previous.result;
  end if;
  select * into saved from public.carts where user_id = auth.uid() for update;
  if not found or saved.revision <> p_revision or jsonb_array_length(saved.items) = 0 then raise exception 'CART_CHANGED'; end if;
  if (select count(distinct coalesce(item->>'vendorId', saved.vendor_id)) from jsonb_array_elements(saved.items) item) <> jsonb_array_length(p_orders)
    or (select count(distinct item->>'vendorId') from jsonb_array_elements(p_orders) item) <> jsonb_array_length(p_orders)
    then raise exception 'INVALID_CHECKOUT'; end if;
  -- Acquire every stall lock in the same order before any reservation is changed.
  for stall in select item->>'vendorId' from jsonb_array_elements(p_orders) item order by item->>'vendorId' loop
    perform private.lock_vendor(stall);
  end loop;
  for entry in select item from jsonb_array_elements(p_orders) item order by item->>'vendorId' loop
    select * into quote from private.checkout_quotes where id = (entry->>'quoteId')::uuid and student_id = auth.uid();
    select jsonb_agg(item - 'vendorId' order by ordinal) into expected
      from jsonb_array_elements(saved.items) with ordinality as lines(item, ordinal)
      where coalesce(item->>'vendorId', saved.vendor_id) = entry->>'vendorId';
    if not found or quote.vendor_id is distinct from entry->>'vendorId' or expected is null or quote.cart is distinct from expected
      then raise exception 'CART_CHANGED'; end if;
    if exists (select 1 from private.checkout_requests where student_id = auth.uid() and request_key = (entry->>'idempotencyKey')::uuid)
      then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    placed := public.place_order((entry->>'quoteId')::uuid, (entry->>'pickupAt')::timestamptz,
      entry->>'payment', (entry->>'idempotencyKey')::uuid);
    result := result || jsonb_build_array(placed);
  end loop;
  update public.carts set items = '[]', vendor_id = null, revision = revision + 1, updated_at = clock_timestamp() where user_id = auth.uid();
  result := jsonb_build_object('orders', result);
  insert into private.basket_requests (student_id, request_key, payload, result)
    values (auth.uid(), p_key, jsonb_build_object('orders', p_orders, 'revision', p_revision), result);
  return result;
end;
$$;
revoke all on function public.checkout_basket(jsonb,uuid,integer) from public, anon;
grant execute on function public.checkout_basket(jsonb,uuid,integer) to authenticated;
