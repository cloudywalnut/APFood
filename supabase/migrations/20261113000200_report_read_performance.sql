-- Evaluate account-wide role checks once per statement. Ownership and
-- stall-specific vendor authorization remain identical to the existing policy.
alter policy scoped_orders on public.orders using (
  (select private.has_role('admin'))
  or (student_id = (select auth.uid()) and (select private.has_role('student')))
  or private.has_role('vendor', vendor_id)
);

alter policy admin_cash_entries on public.cash_entries
  using ((select private.has_role('admin')));

create index orders_created_report_idx on public.orders (created_at, id);
create index orders_collected_report_idx on public.orders (collected_at, id)
  where collected_at is not null;
