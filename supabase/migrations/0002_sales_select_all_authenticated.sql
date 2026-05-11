-- ============================================================================
-- Polwatta Sip & Script POS - Bills lookup
-- ============================================================================
-- Relax sales SELECT so cashiers and admins can both look up any past bill
-- by ID. Previously cashiers were limited to their own sales from today.
-- ============================================================================

drop policy if exists "sales_select" on public.sales;
create policy "sales_select" on public.sales
  for select using (auth.role() = 'authenticated');
