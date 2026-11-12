-- Apply the confirmed proposal in one transaction with the same stall lock used
-- by checkout/menu editing. Never use a service-role second write for discounts.
create function public.apply_vendor_copilot_action(p_vendor text, p_action jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  item public.menu_items;
  stall public.vendors;
  changes jsonb := p_action->'changes';
  entry record;
  next_price integer;
  next_discount integer;
begin
  perform private.require_role('vendor', p_vendor);
  perform private.lock_vendor(p_vendor);
  if jsonb_typeof(changes) is distinct from 'object' or changes = '{}'::jsonb then
    raise exception 'INVALID_ACTION';
  end if;
  if p_action->>'type' = 'update_menu_item' then
    select * into item from public.menu_items where id = p_action->>'itemId' and vendor_id = p_vendor for update;
    if not found then raise exception 'ITEM_UNAVAILABLE'; end if;
    if p_action->'before' is distinct from jsonb_build_object(
      'stock', item.stock, 'priceSen', item.price_sen, 'discountSen', item.discount_sen, 'active', item.active)
      or p_action->'expectedStock' is distinct from to_jsonb(item.stock) then raise exception 'ACTION_CHANGED'; end if;
    for entry in select key, value from jsonb_each(changes) loop
      if entry.key = 'active' then
        if jsonb_typeof(entry.value) <> 'boolean' then raise exception 'INVALID_ACTION'; end if;
      elsif entry.key in ('stock', 'priceSen', 'discountSen') then
        if jsonb_typeof(entry.value) <> 'number' or entry.value::text !~ '^[0-9]+$' then raise exception 'INVALID_ACTION'; end if;
        if (entry.key = 'stock' and entry.value::text::numeric not between 0 and 5000)
          or (entry.key = 'priceSen' and entry.value::text::numeric not between 50 and 50000)
          or (entry.key = 'discountSen' and entry.value::text::numeric not between 0 and 49950)
          then raise exception 'INVALID_ACTION'; end if;
      else raise exception 'INVALID_ACTION'; end if;
    end loop;
    next_price := coalesce((changes->>'priceSen')::integer, item.price_sen);
    next_discount := coalesce((changes->>'discountSen')::integer, item.discount_sen);
    if next_price - next_discount < 50 then raise exception 'INVALID_ACTION'; end if;
    update public.menu_items set price_sen = next_price, discount_sen = next_discount,
      stock = coalesce((changes->>'stock')::integer, stock), active = coalesce((changes->>'active')::boolean, active)
      where id = item.id;
    perform private.log_event('vendor', 'Applied FIF menu update', item.id);
  elsif p_action->>'type' = 'update_stall_settings' then
    select * into stall from public.vendors where id = p_vendor for update;
    if not found then raise exception 'STALL_UNAVAILABLE'; end if;
    if p_action->'before' is distinct from jsonb_build_object(
      'paused', stall.paused, 'capacity', stall.capacity, 'leadMinutes', stall.lead_minutes)
      then raise exception 'ACTION_CHANGED'; end if;
    for entry in select key, value from jsonb_each(changes) loop
      if entry.key = 'paused' then
        if jsonb_typeof(entry.value) <> 'boolean' then raise exception 'INVALID_ACTION'; end if;
      elsif entry.key in ('capacity', 'leadMinutes') then
        if jsonb_typeof(entry.value) <> 'number' or entry.value::text !~ '^[0-9]+$' then raise exception 'INVALID_ACTION'; end if;
        if (entry.key = 'capacity' and entry.value::text::numeric not between 1 and 300)
          or (entry.key = 'leadMinutes' and entry.value::text::numeric not between 1 and 120)
          then raise exception 'INVALID_ACTION'; end if;
      else raise exception 'INVALID_ACTION'; end if;
    end loop;
    update public.vendors set paused = coalesce((changes->>'paused')::boolean, paused),
      capacity = coalesce((changes->>'capacity')::integer, capacity),
      lead_minutes = coalesce((changes->>'leadMinutes')::integer, lead_minutes) where id = p_vendor;
    perform private.log_event('vendor', 'Applied FIF stall update', p_vendor);
  else raise exception 'INVALID_ACTION'; end if;
end;
$$;
revoke all on function public.apply_vendor_copilot_action(text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_vendor_copilot_action(text,jsonb) to authenticated;
