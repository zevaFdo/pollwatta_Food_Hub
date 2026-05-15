-- ============================================================================
-- Polwatta Sip & Script POS - Notification actor + per-user dismissals
-- ============================================================================
-- Adds:
--   * notifications.actor_id     - who triggered the notification
--   * notification_dismissals    - per-user "I've cleared this" join table
-- Updates:
--   * notify_on_sale, notify_on_expense, notify_on_stock_change triggers
--     to populate actor_id.
--   * notifications_admin_select RLS so admins do NOT see their own actions
--     and do NOT see notifications they have already dismissed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add actor_id to notifications
-- ----------------------------------------------------------------------------
alter table public.notifications
  add column if not exists actor_id uuid references public.profiles(id) on delete set null;

create index if not exists notifications_actor_idx
  on public.notifications (actor_id);

-- ----------------------------------------------------------------------------
-- 2. Per-user dismissals table
-- ----------------------------------------------------------------------------
create table if not exists public.notification_dismissals (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  dismissed_at    timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notification_dismissals_user_idx
  on public.notification_dismissals (user_id);

alter table public.notification_dismissals enable row level security;

drop policy if exists "dismissals_self_select" on public.notification_dismissals;
create policy "dismissals_self_select" on public.notification_dismissals
  for select using (user_id = auth.uid());

drop policy if exists "dismissals_self_insert" on public.notification_dismissals;
create policy "dismissals_self_insert" on public.notification_dismissals
  for insert with check (user_id = auth.uid() and public.is_admin());

drop policy if exists "dismissals_self_delete" on public.notification_dismissals;
create policy "dismissals_self_delete" on public.notification_dismissals
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. Tighten notifications_admin_select:
--    hide self-actions and rows the current admin has dismissed.
-- ----------------------------------------------------------------------------
drop policy if exists "notifications_admin_select" on public.notifications;
create policy "notifications_admin_select" on public.notifications
  for select using (
    public.is_admin()
    and (actor_id is null or actor_id is distinct from auth.uid())
    and not exists (
      select 1
      from public.notification_dismissals d
      where d.notification_id = notifications.id
        and d.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Re-define trigger functions to populate actor_id
-- ----------------------------------------------------------------------------

-- 4a. notify_on_sale: actor = sales.cashier_id
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

  insert into public.notifications (title, message, type, actor_id)
  values (v_title, v_message, 'sale', new.cashier_id);

  return new;
end;
$$;

-- 4b. notify_on_expense: actor = expenses.created_by
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

  insert into public.notifications (title, message, type, actor_id)
  values (
    'New expense',
    new.category || ' · Rs. ' || v_amount,
    'expense',
    new.created_by
  );

  return new;
end;
$$;

-- 4c. notify_on_stock_change: actor = auth.uid() of the admin doing the UPDATE.
-- The function is SECURITY DEFINER but auth.uid() still resolves to the
-- caller's JWT, so this works for stock adjustments performed via PostgREST
-- (e.g. from components/admin/stock-table.tsx).
create or replace function public.notify_on_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if new.stock_count is null or new.stock_count = old.stock_count then
    return new;
  end if;

  if new.stock_count = 0 and old.stock_count > 0 then
    insert into public.notifications (title, message, type, actor_id)
    values (
      'Out of stock',
      new.name || ' is out of stock',
      'stock',
      v_actor
    );
  elsif new.stock_count < 5 and old.stock_count >= 5 then
    insert into public.notifications (title, message, type, actor_id)
    values (
      'Low stock',
      new.name || ' has ' || new.stock_count || ' left',
      'stock',
      v_actor
    );
  end if;

  return new;
end;
$$;
