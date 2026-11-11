-- Platform schemas are absent from the embedded PostgreSQL test fixture.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('vendor-qr', 'vendor-qr', true, 2097152, array['image/png','image/jpeg','image/webp'])
      on conflict (id) do update set file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
    execute $policy$create policy ap_food_qr_read on storage.objects for select to anon, authenticated
      using (bucket_id = 'vendor-qr')$policy$;
    execute $policy$create policy ap_food_qr_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'vendor-qr' and private.has_role('vendor', split_part(name, '/', 1)))$policy$;
    execute $policy$create policy ap_food_qr_delete on storage.objects for delete to authenticated
      using (bucket_id = 'vendor-qr' and private.has_role('vendor', split_part(name, '/', 1)))$policy$;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('ap-food-expire-qr-orders', '* * * * *', 'select private.expire_qr_orders()');
  end if;
end;
$$;
