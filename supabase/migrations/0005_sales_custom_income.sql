-- ============================================================================
-- Polwatta Sip & Script POS - Custom Income
-- ============================================================================
-- Allows the `sales` table to also record non-product income (Parking,
-- Previous Revenue, Tips, Donation, Other). Custom income rows are inserted
-- with items=[] so the existing apply_sale_stock_changes trigger and the
-- v_top_selling_items view ignore them automatically.
-- ============================================================================

alter table public.sales
  add column if not exists income_type text not null default 'order'
    check (income_type in ('order', 'custom')),
  add column if not exists income_category text,
  add column if not exists description text;

create index if not exists sales_income_type_idx
  on public.sales (income_type, created_at desc);
