-- Add optional dish image column to menu_items, menu-images storage bucket, and make save_menu_item work_units optional.
alter table public.menu_items add column if not exists image text not null default '';

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('menu-images', 'menu-images', true, 2097152, array['image/png','image/jpeg','image/webp'])
      on conflict (id) do update set file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    execute $policy$create policy ap_food_menu_image_read on storage.objects for select to anon, authenticated
      using (bucket_id = 'menu-images')$policy$;
    execute $policy$create policy ap_food_menu_image_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'menu-images' and private.has_role('vendor', split_part(name, '/', 1)))$policy$;
    execute $policy$create policy ap_food_menu_image_delete on storage.objects for delete to authenticated
      using (bucket_id = 'menu-images' and private.has_role('vendor', split_part(name, '/', 1)))$policy$;
  end if;
end;
$$;

drop function public.save_menu_item(text,text,text,text,integer,integer,boolean,integer,integer);

create function public.save_menu_item(
  p_vendor text, p_id text, p_name text, p_description text, p_price integer,
  p_stock integer, p_active boolean, p_units integer default 1, p_expected_stock integer default null,
  p_image text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.menu_items;
  effective_units integer := coalesce(p_units, 1);
begin
  perform private.require_role('vendor', p_vendor);
  perform private.lock_vendor(p_vendor);
  select * into previous from public.menu_items where id = p_id;
  if found then
    if previous.vendor_id <> p_vendor then raise exception 'ITEM_UNAVAILABLE'; end if;
    if previous.stock is distinct from p_expected_stock then raise exception 'STOCK_CHANGED'; end if;
    update public.menu_items set name = p_name, description = p_description, price_sen = p_price,
      discount_sen = case when discount_sen < p_price then discount_sen else 0 end,
      stock = p_stock, active = p_active, work_units = effective_units,
      image = coalesce(p_image, previous.image)
      where id = p_id;
  else
    insert into public.menu_items (id, vendor_id, name, description, price_sen, stock, active, work_units, image)
      values (p_id, p_vendor, p_name, p_description, p_price, p_stock, p_active, effective_units, coalesce(p_image, ''));
  end if;
  perform private.log_event('vendor', 'Saved menu item', p_id);
end;
$$;

revoke all on function public.save_menu_item(text,text,text,text,integer,integer,boolean,integer,integer,text) from public, anon, authenticated;
grant execute on function public.save_menu_item(text,text,text,text,integer,integer,boolean,integer,integer,text) to authenticated;
