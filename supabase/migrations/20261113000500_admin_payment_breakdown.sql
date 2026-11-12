-- Preserve payment-channel and unpaid-counter visibility alongside the new overview.
create function public.admin_payment_summary(p_since timestamptz,p_until timestamptz,p_vendor text default null,p_zone text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_role('admin');
  if p_since is null or p_until is null or p_since>=p_until or p_until-p_since>interval '91 days' or p_until>now()+interval '1 minute' then raise exception 'INVALID_INPUT'; end if;
  with scoped as (select id from public.vendors where (p_vendor is null or id=p_vendor) and (p_zone is null or zone_id=p_zone)),
  entries as (select e.* from public.cash_entries e where e.vendor_id in(select id from scoped) and e.created_at>=p_since and e.created_at<p_until and (p_zone is null or e.zone_id=p_zone))
  select jsonb_build_object(
    'counterSen',coalesce((select sum(amount_sen::bigint) from entries where kind='counter'),0),
    'duitnowSen',coalesce((select sum(amount_sen::bigint) from entries where kind='duitnow_qr'),0),
    'demoSen',coalesce((select sum(amount_sen::bigint) from entries where kind='demo'),0),
    'outstandingCounterSen',coalesce((select sum(total_sen::bigint) from public.orders where vendor_id in(select id from scoped) and payment='counter' and status in('placed','accepted','preparing','ready')),0)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_payment_summary(timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.admin_payment_summary(timestamptz,timestamptz,text,text) to authenticated;
