-- Broadcast only invalidation hints. Clients refetch through order RLS.
create policy ap_food_order_broadcast on realtime.messages
  for select to authenticated
  using (
    extension = 'broadcast' and topic = (select realtime.topic()) and (
      ((select private.has_role('student')) and (select realtime.topic()) = 'ap-food:student:' || (select auth.uid())::text)
      or (left((select realtime.topic()), 15) = 'ap-food:vendor:' and private.has_role('vendor', substr((select realtime.topic()), 16)))
    )
  );

create function private.broadcast_order_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.version is distinct from old.version then
    perform realtime.send('{}'::jsonb, 'order_changed', 'ap-food:student:' || new.student_id, true);
    perform realtime.send('{}'::jsonb, 'order_changed', 'ap-food:vendor:' || new.vendor_id, true);
  end if;
  return new;
exception when others then
  raise warning 'AP Food realtime invalidation failed (%).', sqlstate;
  return new;
end;
$$;
revoke all on function private.broadcast_order_change() from public;
create trigger ap_food_order_changed after insert or update on public.orders
  for each row execute function private.broadcast_order_change();
