-- ============================================================================
-- Polwatta Sip & Script POS - Initial Schema
-- ============================================================================
-- Creates: profiles, products, combos, sales, inventory_logs
-- Includes: stock-decrement trigger, RLS policies, realtime publication, seed data
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'cashier' check (role in ('cashier', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile when a new auth.users row is inserted
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'cashier'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  category text not null check (category in ('Drinks', 'Short-eats', 'Sweets', 'BBQ')),
  stock_count integer not null default 0 check (stock_count >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_category_active_idx
  on public.products (category, is_active);

-- ----------------------------------------------------------------------------
-- combos (BBQ combos with embedded items list)
-- ----------------------------------------------------------------------------
create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null check (price >= 0),
  items jsonb not null default '[]'::jsonb,
  -- items shape: [{ "product_id": "...", "quantity": 1 }, ...]
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- sales
-- ----------------------------------------------------------------------------
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  items jsonb not null default '[]'::jsonb,
  -- items shape: [{ "type":"product"|"combo"|"addon", "id":"...", "name":"...", "price":..., "quantity":... }, ...]
  payment_method text not null default 'Cash',
  customer_phone text,
  cashier_id uuid references public.profiles(id) on delete set null
);

create index if not exists sales_created_at_idx on public.sales (created_at desc);
create index if not exists sales_cashier_idx on public.sales (cashier_id);

-- ----------------------------------------------------------------------------
-- inventory_logs (stock-change audit trail)
-- ----------------------------------------------------------------------------
create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  change_amount integer not null,
  reason text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_logs_product_idx
  on public.inventory_logs (product_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Stock-decrement trigger on sales
-- Walks the items jsonb array, expands combo items, and deducts product stock.
-- Writes one inventory_logs row per affected product.
-- ----------------------------------------------------------------------------
create or replace function public.apply_sale_stock_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  combo_item jsonb;
  combo_def public.combos%rowtype;
  pid uuid;
  qty integer;
begin
  for line in select * from jsonb_array_elements(new.items)
  loop
    qty := coalesce((line->>'quantity')::int, 1);

    if line->>'type' = 'product' or line->>'type' = 'addon' then
      pid := (line->>'id')::uuid;
      update public.products
        set stock_count = greatest(stock_count - qty, 0)
        where id = pid;
      insert into public.inventory_logs (product_id, change_amount, reason, actor_id)
        values (pid, -qty, 'sale', new.cashier_id);

    elsif line->>'type' = 'combo' then
      select * into combo_def from public.combos where id = (line->>'id')::uuid;
      if found then
        for combo_item in select * from jsonb_array_elements(combo_def.items)
        loop
          pid := (combo_item->>'product_id')::uuid;
          update public.products
            set stock_count = greatest(
              stock_count - qty * coalesce((combo_item->>'quantity')::int, 1),
              0
            )
            where id = pid;
          insert into public.inventory_logs (product_id, change_amount, reason, actor_id)
            values (
              pid,
              -qty * coalesce((combo_item->>'quantity')::int, 1),
              'sale (combo)',
              new.cashier_id
            );
        end loop;
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_sales_stock_changes on public.sales;
create trigger trg_sales_stock_changes
  after insert on public.sales
  for each row execute function public.apply_sale_stock_changes();

-- ----------------------------------------------------------------------------
-- Helper: is_admin() - used in RLS policies
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.products       enable row level security;
alter table public.combos         enable row level security;
alter table public.sales          enable row level security;
alter table public.inventory_logs enable row level security;

-- profiles: users read their own profile; admins read all
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- products: any authenticated user can read; only admins can write
drop policy if exists "products_authenticated_select" on public.products;
create policy "products_authenticated_select" on public.products
  for select using (auth.role() = 'authenticated');

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- combos: same as products
drop policy if exists "combos_authenticated_select" on public.combos;
create policy "combos_authenticated_select" on public.combos
  for select using (auth.role() = 'authenticated');

drop policy if exists "combos_admin_write" on public.combos;
create policy "combos_admin_write" on public.combos
  for all using (public.is_admin()) with check (public.is_admin());

-- sales: cashiers insert their own; admins read all; cashiers read today's own
drop policy if exists "sales_cashier_insert" on public.sales;
create policy "sales_cashier_insert" on public.sales
  for insert with check (
    auth.role() = 'authenticated'
    and (cashier_id is null or cashier_id = auth.uid())
  );

drop policy if exists "sales_select" on public.sales;
create policy "sales_select" on public.sales
  for select using (
    public.is_admin()
    or (cashier_id = auth.uid() and created_at::date = current_date)
  );

drop policy if exists "sales_admin_write" on public.sales;
create policy "sales_admin_write" on public.sales
  for update using (public.is_admin()) with check (public.is_admin());

-- inventory_logs: admin-only read; trigger inserts via security definer
drop policy if exists "inv_logs_admin_select" on public.inventory_logs;
create policy "inv_logs_admin_select" on public.inventory_logs
  for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Top-selling items view (last 30 days)
-- ----------------------------------------------------------------------------
create or replace view public.v_top_selling_items as
select
  (item->>'name') as name,
  sum(coalesce((item->>'quantity')::int, 1)) as units_sold,
  sum(coalesce((item->>'quantity')::int, 1) * coalesce((item->>'price')::numeric, 0)) as revenue
from public.sales,
     lateral jsonb_array_elements(items) item
where created_at >= now() - interval '30 days'
  and item->>'type' in ('product', 'addon', 'combo')
group by 1
order by units_sold desc
limit 10;

grant select on public.v_top_selling_items to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Realtime publication
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

alter publication supabase_realtime add table public.sales;
alter publication supabase_realtime add table public.products;

-- ----------------------------------------------------------------------------
-- Storage bucket for product images
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects
  for all using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

-- ----------------------------------------------------------------------------
-- Seed data
-- ----------------------------------------------------------------------------
insert into public.products (name, price, category, stock_count, image_url) values
  ('Iced Coffee',           450.00, 'Drinks',     30, 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=400'),
  ('Fresh Lime Juice',      350.00, 'Drinks',     25, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400'),
  ('Bottled Water',         150.00, 'Drinks',     50, 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400'),

  ('Vegetable Roti',        180.00, 'Short-eats', 20, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400'),
  ('Fish Bun',              200.00, 'Short-eats', 18, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400'),
  ('Chicken Pastry',        220.00, 'Short-eats',  3, 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=400'),

  ('Chocolate Cake Slice',  450.00, 'Sweets',     12, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400'),
  ('Watalappan',            300.00, 'Sweets',      8, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400'),
  ('Ice Cream Cup',         250.00, 'Sweets',      0, 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400'),

  ('BBQ Chicken Wings',     850.00, 'BBQ',        15, 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400'),
  ('Grilled Pork Skewer',   950.00, 'BBQ',        10, 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400'),
  ('Garlic Bread Side',     250.00, 'BBQ',        20, 'https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400')
on conflict do nothing;

-- Seed combos referencing seeded products by name
insert into public.combos (name, price, items, image_url)
select
  'BBQ Wings Combo',
  1100.00,
  jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where name = 'BBQ Chicken Wings' limit 1), 'quantity', 1),
    jsonb_build_object('product_id', (select id from public.products where name = 'Iced Coffee' limit 1),       'quantity', 1)
  ),
  'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400'
where not exists (select 1 from public.combos where name = 'BBQ Wings Combo');

insert into public.combos (name, price, items, image_url)
select
  'Pork Skewer Feast',
  1300.00,
  jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where name = 'Grilled Pork Skewer' limit 1), 'quantity', 1),
    jsonb_build_object('product_id', (select id from public.products where name = 'Garlic Bread Side' limit 1),   'quantity', 1),
    jsonb_build_object('product_id', (select id from public.products where name = 'Bottled Water' limit 1),       'quantity', 1)
  ),
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400'
where not exists (select 1 from public.combos where name = 'Pork Skewer Feast');
