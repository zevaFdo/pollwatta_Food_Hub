-- ============================================================================
-- Polwatta Sip & Script POS - In-app Notifications
-- ============================================================================
-- Adds: notifications table (admin-only), auto-insert triggers on sales,
-- expenses, and low-stock product updates, plus realtime publication.
-- RLS reuses the public.is_admin() helper from 0001_init.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title      text not null,
  message    text not null,
  type       text not null check (type in ('sale', 'expense', 'stock')),
  is_read    boolean not null default false
);

create index if not exists notifications_created_at_idx
  on public.notifications (created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (is_read)
  where is_read = false;

-- ----------------------------------------------------------------------------
-- Row Level Security: admin-only read & update; inserts come from triggers
-- ----------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists "notifications_admin_select" on public.notifications;
create policy "notifications_admin_select" on public.notifications
  for select using (public.is_admin());

drop policy if exists "notifications_admin_update" on public.notifications;
create policy "notifications_admin_update" on public.notifications
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "notifications_admin_delete" on public.notifications;
create policy "notifications_admin_delete" on public.notifications
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Trigger: notify on new sale (orders + custom income)
-- ----------------------------------------------------------------------------
create or replace function public.notify_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title   text;
  v_message text;
  v_amount  text;
  v_short   text;
begin
  v_amount := to_char(new.total_amount, 'FM999,999,990.00');

  if coalesce(new.income_type, 'order') = 'custom' then
    v_title := 'Custom income';
    v_message := coalesce(new.income_category, 'Custom') || ' · Rs. ' || v_amount;
  else
    v_short := upper(substring(new.id::text from 1 for 8));
    v_title := 'New sale';
    v_message := 'Order #' || v_short || ' · Rs. ' || v_amount;
  end if;

  insert into public.notifications (title, message, type)
  values (v_title, v_message, 'sale');

  return new;
end;
$$;

drop trigger if exists trg_notify_on_sale on public.sales;
create trigger trg_notify_on_sale
  after insert on public.sales
  for each row execute function public.notify_on_sale();

-- ----------------------------------------------------------------------------
-- Trigger: notify on new expense
-- ----------------------------------------------------------------------------
create or replace function public.notify_on_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount text;
begin
  v_amount := to_char(new.amount, 'FM999,999,990.00');

  insert into public.notifications (title, message, type)
  values (
    'New expense',
    new.category || ' · Rs. ' || v_amount,
    'expense'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_expense on public.expenses;
create trigger trg_notify_on_expense
  after insert on public.expenses
  for each row execute function public.notify_on_expense();

-- ----------------------------------------------------------------------------
-- Trigger: notify when product stock crosses low-stock / out-of-stock
-- thresholds. Mirrors the dashboard's "< 5" cutoff so the alerts line up
-- with the existing Low Stock card on the admin page.
-- ----------------------------------------------------------------------------
create or replace function public.notify_on_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only react to actual stock movement.
  if new.stock_count is null or new.stock_count = old.stock_count then
    return new;
  end if;

  if new.stock_count = 0 and old.stock_count > 0 then
    insert into public.notifications (title, message, type)
    values (
      'Out of stock',
      new.name || ' is out of stock',
      'stock'
    );
  elsif new.stock_count < 5 and old.stock_count >= 5 then
    insert into public.notifications (title, message, type)
    values (
      'Low stock',
      new.name || ' has ' || new.stock_count || ' left',
      'stock'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_stock_change on public.products;
create trigger trg_notify_on_stock_change
  after update of stock_count on public.products
  for each row execute function public.notify_on_stock_change();

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
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end
$$;
