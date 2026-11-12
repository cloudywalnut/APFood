-- Quantify unsuccessful-order value without exposing customer/order identities.
create function public.admin_intelligence_evidence(
  p_since timestamptz, p_until timestamptz,
  p_vendor text default null, p_zone text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_role('admin');
  if p_since is null or p_until is null or p_since >= p_until
    or p_until - p_since > interval '91 days' or p_until > now() + interval '1 minute'
  then raise exception 'INVALID_INPUT'; end if;

  with stalls as (
    select id from public.vendors
    where (p_vendor is null or id = p_vendor) and (p_zone is null or zone_id = p_zone)
  ), unsuccessful as (
    select o.vendor_id, sum(o.total_sen::bigint) value_sen
    from public.orders o join stalls s on s.id = o.vendor_id
    where o.created_at >= p_since and o.created_at < p_until
      and o.status in ('cancelled', 'rejected') and (p_zone is null or o.zone_id = p_zone)
    group by o.vendor_id
  ), receipts as (
    select e.vendor_id, count(*) receipts, round(avg(e.amount_sen)) average_sen
    from public.cash_entries e join stalls s on s.id = e.vendor_id
    where e.created_at >= p_since and e.created_at < p_until
      and e.kind in ('demo', 'counter', 'duitnow_qr') and (p_zone is null or e.zone_id = p_zone)
    group by e.vendor_id
  )
  select jsonb_build_object('vendors', coalesce(jsonb_agg(jsonb_build_object(
    'vendorId', s.id, 'unsuccessfulValueSen', coalesce(u.value_sen, 0),
    'receiptedOrders', coalesce(r.receipts, 0), 'averageReceiptSen', coalesce(r.average_sen, 0)
  ) order by s.id), '[]'::jsonb)) into result
  from stalls s left join unsuccessful u on u.vendor_id = s.id left join receipts r on r.vendor_id = s.id;
  return result;
end;
$$;
revoke all on function public.admin_intelligence_evidence(timestamptz,timestamptz,text,text) from public,anon;
grant execute on function public.admin_intelligence_evidence(timestamptz,timestamptz,text,text) to authenticated;
