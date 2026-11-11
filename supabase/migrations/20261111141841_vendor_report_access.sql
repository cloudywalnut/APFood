-- Staff can report only the assigned stall's posted ledger; overhead stays admin-only.
create policy vendor_cash_entries on public.cash_entries for select to authenticated
  using (vendor_id is not null and private.has_role('vendor', vendor_id));
