# Database Backup — 2026-05-13 09:22:54

Snapshot taken before clearing transactional data.

## Files

| File | Table | Rows | Action taken after backup |
|---|---|---|---|
| `auth_users.json` | `auth.users` (subset) | 3 | KEPT |
| `profiles.json` | `public.profiles` | 3 | KEPT |
| `products.json` | `public.products` | 12 | KEPT |
| `combos.json` | `public.combos` | 4 | KEPT |
| `sales.json` | `public.sales` | 14 | **CLEARED** |
| `inventory_logs.json` | `public.inventory_logs` | 14 | **CLEARED** |
| `expenses.json` | `public.expenses` | 1 | **CLEARED** |

## Restore (transactional tables)

To restore the cleared tables, use the JSON files with PostgreSQL's `jsonb_to_recordset`:

```sql
-- Example: restore sales
insert into public.sales (id, created_at, total_amount, items, payment_method, customer_phone, cashier_id)
select id, created_at, total_amount, items, payment_method, customer_phone, cashier_id
from jsonb_to_recordset(:'sales_json'::jsonb) as x(
  id uuid, created_at timestamptz, total_amount numeric,
  items jsonb, payment_method text, customer_phone text, cashier_id uuid
);
```

> Note: the `sales` insert trigger `apply_sale_stock_changes` re-decrements stock and writes new `inventory_logs` rows. Disable the trigger before bulk-restoring sales:
>
> ```sql
> alter table public.sales disable trigger trg_sales_stock_changes;
> -- restore sales + inventory_logs
> alter table public.sales enable trigger trg_sales_stock_changes;
> ```
