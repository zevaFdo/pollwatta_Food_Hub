-- ============================================================================
-- Polwatta Sip & Script POS - Expense date
-- ============================================================================
-- Adds an explicit `expense_date` column so users can record expenses that
-- occurred on a past date (the existing `created_at` continues to track when
-- the row was inserted, for audit purposes).
-- ============================================================================

alter table public.expenses
  add column if not exists expense_date date not null default current_date;

create index if not exists expenses_expense_date_idx
  on public.expenses (expense_date desc);
