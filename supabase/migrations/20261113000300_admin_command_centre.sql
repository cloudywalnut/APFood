-- Admin-only aggregate reporting. No policies or existing write operations are changed.
create function public.admin_overview(p_days integer default 7, p_vendor text default null, p_zone text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  moment timestamptz := now();
  start_at timestamptz;
  previous_start timestamptz;
  previous_end timestamptz;
  result jsonb;
begin
  perform private.require_role('admin');
  if p_days not in (1,7,14,30,90) then raise exception 'INVALID_PERIOD'; end if;
  if p_vendor is not null and not exists(select 1 from public.vendors where id=p_vendor and (p_zone is null or zone_id=p_zone)) then raise exception 'STALL_UNAVAILABLE'; end if;
  if p_zone is not null and not exists(select 1 from public.zones where id=p_zone) then raise exception 'INVALID_ZONE'; end if;
  start_at := (date_trunc('day',moment at time zone 'Asia/Kuala_Lumpur') - (p_days-1)*interval '1 day') at time zone 'Asia/Kuala_Lumpur';
  previous_start := start_at-p_days*interval '1 day';
  previous_end := moment-p_days*interval '1 day';
  with
  stalls as materialized (select v.* from public.vendors v where (p_vendor is null or v.id=p_vendor) and (p_zone is null or v.zone_id=p_zone)),
  records as materialized (select o.* from public.orders o join stalls s on s.id=o.vendor_id where o.created_at>=previous_start and o.created_at<moment),
  current_orders as materialized (select * from records where created_at>=start_at),
  previous_orders as (select * from records where created_at<previous_end),
  live as materialized (select o.vendor_id,o.status,o.pickup_at from public.orders o join stalls s on s.id=o.vendor_id where o.status in ('placed','accepted','preparing','ready')),
  entries as materialized (
    select e.*,case when e.kind in ('demo','counter','duitnow_qr','reversal') then e.amount_sen::bigint else -e.amount_sen::bigint end signed_sen
    from public.cash_entries e where e.created_at>=previous_start and e.created_at<moment
      and ((e.vendor_id in (select id from stalls) and (p_zone is null or e.zone_id=p_zone)) or (e.vendor_id is null and p_vendor is null and p_zone is null))
  ),
  current_cash as materialized (select * from entries where created_at>=start_at),
  menu as materialized (select m.* from public.menu_items m join stalls s on s.id=m.vendor_id),
  product_sales as (
    select o.vendor_id,line->>'itemId' item_id,sum((line->>'quantity')::bigint) units,sum((line->>'quantity')::bigint*(line->>'unit')::bigint) value_sen
    from public.orders o join stalls s on s.id=o.vendor_id cross join lateral jsonb_array_elements(o.lines) line
    where o.status='collected' and o.collected_at>=start_at and o.collected_at<moment group by o.vendor_id,line->>'itemId'
  ),
  vendor_rows as (
    select s.id,s.name,s.zone_id,s.status,s.paused,
      coalesce(c.receipts,0) "receiptsSen",coalesce(c.net,0) "netSen",coalesce(c.expenses,0) "expenseSen",coalesce(c.refunds,0) "refundSen",
      coalesce(o.orders,0) orders,coalesce(o.collected,0) collected,coalesce(o.cancelled,0) cancelled,coalesce(o.closed,0) closed,
      coalesce(o.ready_count,0) "readyCount",coalesce(o.on_time,0) "onTimeCount",
      coalesce(l.active,0) "activeCount",coalesce(l.ready,0) "readyWaiting",coalesce(l.overdue,0) "overdueCount",
      coalesce(m.low,0) "lowStockCount",coalesce(m.sold_out,0) "soldOutCount",
      coalesce(p.orders,0) "previousOrders",coalesce(p.collected,0) "previousCollected",coalesce(p.closed,0) "previousClosed",
      coalesce(pc.net,0) "previousNetSen",coalesce(pc.receipts,0) "previousReceiptsSen"
    from stalls s
    left join lateral(select count(*) orders,count(*) filter(where status='collected') collected,count(*) filter(where status in ('cancelled','rejected')) cancelled,count(*) filter(where status in ('collected','cancelled','rejected')) closed,count(*) filter(where ready_at is not null) ready_count,count(*) filter(where ready_at<=pickup_at) on_time from current_orders where vendor_id=s.id)o on true
    left join lateral(select count(*) orders,count(*) filter(where status='collected') collected,count(*) filter(where status in ('collected','cancelled','rejected')) closed from previous_orders where vendor_id=s.id)p on true
    left join lateral(select sum(amount_sen::bigint) filter(where kind in ('demo','counter','duitnow_qr')) receipts,sum(signed_sen) net,sum(amount_sen::bigint) filter(where kind='expense') expenses,sum(amount_sen::bigint) filter(where kind='refund') refunds from current_cash where vendor_id=s.id)c on true
    left join lateral(select sum(signed_sen) net,sum(amount_sen::bigint) filter(where kind in ('demo','counter','duitnow_qr')) receipts from entries where created_at<previous_end and vendor_id=s.id)pc on true
    left join lateral(select count(*) active,count(*) filter(where status='ready') ready,count(*) filter(where status<>'ready' and pickup_at<moment) overdue from live where vendor_id=s.id)l on true
    left join lateral(select count(*) filter(where active and stock between 1 and 5) low,count(*) filter(where active and stock=0) sold_out from menu where vendor_id=s.id)m on true
  ),
  days as (select generate_series((start_at at time zone 'Asia/Kuala_Lumpur')::date,(moment at time zone 'Asia/Kuala_Lumpur')::date,interval '1 day')::date as day),
  daily_rows as (
    select d.day::text as day,coalesce(c.receipts,0) "receiptsSen",coalesce(c.costs,0) "costsSen",coalesce(c.net,0) "netSen",coalesce(o.orders,0) orders
    from days d
    left join lateral(select sum(amount_sen::bigint) filter(where kind in ('demo','counter','duitnow_qr')) receipts,sum(case when kind in ('expense','refund') then amount_sen::bigint when kind='reversal' then -amount_sen::bigint else 0 end) costs,sum(signed_sen) net from current_cash where (created_at at time zone 'Asia/Kuala_Lumpur')::date=d.day)c on true
    left join lateral(select count(*) orders from current_orders where (created_at at time zone 'Asia/Kuala_Lumpur')::date=d.day)o on true
  ),
  demand as (select extract(isodow from pickup_at at time zone 'Asia/Kuala_Lumpur')::int weekday,extract(hour from pickup_at at time zone 'Asia/Kuala_Lumpur')::int as hour,count(*) orders from current_orders where status not in ('cancelled','rejected') group by 1,2)
  select jsonb_build_object(
    'asOf',moment,'since',start_at,'previousSince',previous_start,'previousAsOf',previous_end,'days',p_days,'source','demo',
    'summary',jsonb_build_object(
      'netSen',coalesce((select sum(signed_sen) from current_cash),0),
      'receiptsSen',coalesce((select sum(amount_sen::bigint) from current_cash where kind in ('demo','counter','duitnow_qr')),0),
      'expenseSen',coalesce((select sum(amount_sen::bigint) from current_cash where kind='expense'),0),
      'refundSen',coalesce((select sum(amount_sen::bigint) from current_cash where kind='refund'),0),
      'reversalSen',coalesce((select sum(amount_sen::bigint) from current_cash where kind='reversal'),0),
      'sharedNetSen',coalesce((select sum(signed_sen) from current_cash where vendor_id is null),0),
      'orders',(select count(*) from current_orders),'collected',(select count(*) from current_orders where status='collected'),
      'closed',(select count(*) from current_orders where status in ('collected','cancelled','rejected')),
      'active',(select count(*) from live),'attention',(select count(*) from vendor_rows where "overdueCount">0 or "readyWaiting">0 or "lowStockCount">0 or "soldOutCount">0 or status<>'approved' or paused)
    ),
    'previous',jsonb_build_object('available',exists(select 1 from previous_orders) or exists(select 1 from entries where created_at<previous_end),
      'netSen',coalesce((select sum(signed_sen) from entries where created_at<previous_end),0),
      'receiptsSen',coalesce((select sum(amount_sen::bigint) from entries where created_at<previous_end and kind in ('demo','counter','duitnow_qr')),0),
      'orders',(select count(*) from previous_orders),'collected',(select count(*) from previous_orders where status='collected'),'closed',(select count(*) from previous_orders where status in ('collected','cancelled','rejected'))),
    'vendors',coalesce((select jsonb_agg(to_jsonb(v) order by v."netSen" desc,v.name) from vendor_rows v),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from daily_rows d),'[]'::jsonb),
    'demand',coalesce((select jsonb_agg(to_jsonb(d)) from demand d),'[]'::jsonb),
    'statuses',coalesce((select jsonb_agg(jsonb_build_object('status',s.status,'count',s.n)) from (select status,count(*) n from current_orders group by status)s),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'vendorId',m.vendor_id,'name',m.name,'stock',m.stock,'active',m.active,'priceSen',m.price_sen-m.discount_sen,'units',coalesce(p.units,0),'revenueSen',coalesce(p.value_sen,0)) order by coalesce(p.value_sen,0) desc,m.id) from menu m left join product_sales p on p.item_id=m.id and p.vendor_id=m.vendor_id),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_overview(integer,text,text) from public,anon;
grant execute on function public.admin_overview(integer,text,text) to authenticated;
create index orders_admin_active_idx on public.orders(vendor_id,pickup_at) where status in ('placed','accepted','preparing','ready');
create index cash_entries_vendor_report_idx on public.cash_entries(vendor_id,created_at);

create function public.admin_vendor_overview(p_vendor text,p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_role('admin');
  result := public.admin_overview(p_days,p_vendor,null);
  return result || jsonb_build_object(
    'staff',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'status',p.status)) from public.memberships m join public.profiles p on p.id=m.user_id where m.role='vendor' and m.vendor_id=p_vendor),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e)) from (select id,actor_role,action,target,reason,created_at from public.audit_events where target=p_vendor order by created_at desc,id limit 20)e),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_vendor_overview(text,integer) from public,anon;
grant execute on function public.admin_vendor_overview(text,integer) to authenticated;

create function public.admin_audit_page(p_page integer default 1,p_search text default '',p_actor text default null,p_target text default null,p_since timestamptz default null,p_until timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_role('admin');
  if p_page not between 1 and 10000 or length(p_search)>100 or (p_actor is not null and p_actor not in ('student','vendor','admin')) then raise exception 'INVALID_INPUT'; end if;
  with filtered as materialized(select id,actor_role,action,target,reason,created_at from public.audit_events
    where (p_actor is null or actor_role=p_actor) and (p_target is null or target=p_target)
    and (p_since is null or created_at>=p_since) and (p_until is null or created_at<p_until)
    and (p_search='' or concat_ws(' ',action,target,reason) ilike '%'||p_search||'%'))
  select jsonb_build_object('total',(select count(*) from filtered),'events',coalesce((select jsonb_agg(to_jsonb(e)) from (select * from filtered order by created_at desc,id limit 50 offset (p_page-1)*50)e),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.admin_audit_page(integer,text,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_audit_page(integer,text,text,text,timestamptz,timestamptz) to authenticated;

create function public.admin_vendor_accounts(p_vendor text,p_page integer default 1,p_search text default '',p_status text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform private.require_role('admin');
  if p_page not between 1 and 10000 or length(p_search)>100 or p_status not in ('','active','suspended') then raise exception 'INVALID_INPUT'; end if;
  with people as materialized(select p.*,u.email,u.email_confirmed_at,
    coalesce((select jsonb_agg(jsonb_build_object('role',m.role,'vendor_id',m.vendor_id)) from public.memberships m where m.user_id=p.id),'[]'::jsonb) memberships
    from public.profiles p join auth.users u on u.id=p.id
    where exists(select 1 from public.memberships m where m.user_id=p.id and m.vendor_id=p_vendor and m.role='vendor')
    and (p_status='' or p.status=p_status) and (p_search='' or concat_ws(' ',p.display_name,u.email) ilike '%'||p_search||'%'))
  select jsonb_build_object('total',(select count(*) from people),'users',coalesce((select jsonb_agg(to_jsonb(p)) from (select * from people order by display_name,id limit 20 offset (p_page-1)*20)p),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.admin_vendor_accounts(text,integer,text,text) from public,anon;
grant execute on function public.admin_vendor_accounts(text,integer,text,text) to authenticated;


