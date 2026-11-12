-- Match the application's vendor-only workspace rule at the RPC/RLS boundary.
-- Existing invitations may retain a student membership when staff access is added.
create or replace function private.has_role(p_role text, p_vendor text default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.profiles p on p.id = m.user_id and p.status = 'active'
    join auth.users u on u.id = m.user_id and u.email_confirmed_at is not null
    where m.user_id = auth.uid() and m.role = p_role and m.vendor_id is not distinct from p_vendor
      and (p_role <> 'student' or not exists (
        select 1 from public.memberships staff
        where staff.user_id = m.user_id and staff.role = 'vendor'
      ))
  );
$$;
