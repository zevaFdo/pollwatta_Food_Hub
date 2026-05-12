-- ============================================================================
-- Polwatta Sip & Script POS - Expense Management
-- ============================================================================
-- Adds: expenses table (admin-only), realtime publication, and a private
-- 'expense-receipts' storage bucket for receipt images. RLS reuses the
-- existing public.is_admin() helper from 0001_init.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- expenses
-- ----------------------------------------------------------------------------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  category    text not null check (category in (
    'Ingredients', 'Utilities', 'Salaries', 'Rent',
    'Maintenance', 'Marketing', 'Other'
  )),
  amount      numeric(10, 2) not null check (amount >= 0),
  description text,
  image_url   text,
  created_by  uuid references public.profiles(id) on delete set null
);

create index if not exists expenses_created_at_idx
  on public.expenses (created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security: admin-only read & write
-- ----------------------------------------------------------------------------
alter table public.expenses enable row level security;

drop policy if exists "expenses_admin_select" on public.expenses;
create policy "expenses_admin_select" on public.expenses
  for select using (public.is_admin());

drop policy if exists "expenses_admin_insert" on public.expenses;
create policy "expenses_admin_insert" on public.expenses
  for insert with check (public.is_admin());

drop policy if exists "expenses_admin_update_delete" on public.expenses;
create policy "expenses_admin_update_delete" on public.expenses
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'expenses'
  ) then
    execute 'alter publication supabase_realtime add table public.expenses';
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- Private storage bucket for receipt images (admin-only read & write)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "expense_receipts_admin_read" on storage.objects;
create policy "expense_receipts_admin_read" on storage.objects
  for select using (bucket_id = 'expense-receipts' and public.is_admin());

drop policy if exists "expense_receipts_admin_write" on storage.objects;
create policy "expense_receipts_admin_write" on storage.objects
  for all using (bucket_id = 'expense-receipts' and public.is_admin())
  with check (bucket_id = 'expense-receipts' and public.is_admin());
