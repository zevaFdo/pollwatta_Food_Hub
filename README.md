# POLWATTA FOOD HUB POS

A mobile-responsive Cafe & BBQ point-of-sale and admin dashboard, built with Next.js 14, Tailwind CSS, and Supabase.

## Features

- **POS Interface** with large category tabs (Drinks, Short-eats, Sweets, BBQ, Combos, Out of Stock).
- **Auto-hides 0-stock items** in the regular grid; a dedicated **Out of Stock** tab shows them.
- **BBQ Combo Builder**: pick a combo, then add extra side items (add-ons) before sending it to the cart.
- **Visual Cart Sidebar** with qty controls, customer phone field, and a large **Complete Order** button.
- **WhatsApp / SMS Receipt**: after a sale, send a pre-filled receipt to the customer (LK +94 normalized).
- **Realtime Admin Dashboard**: Today's Revenue card updates the moment a sale is recorded, Top Selling chart (Recharts), Stock Levels table with red highlighting for stock < 5, plus inline +/- stock adjust.
- **Admin CRUD** pages for products and combos with Supabase Storage image upload.
- **Role-based auth** via Supabase: `cashier` only sees POS, `admin` sees both POS and Admin.

## Stack

- Next.js 14 (App Router), React 18, TypeScript
- Tailwind CSS 3
- Supabase (Postgres, Auth, Realtime, Storage)
- TanStack Query, Zustand, Recharts, lucide-react

---

## 1. Local Setup

### Prerequisites
- Node.js 22+
- npm 10+
- A Supabase project ([create one here](https://supabase.com))

### Install

```bash
npm install --ignore-scripts
```

> **Why `--ignore-scripts`?** A transitive dependency (`unrs-resolver`) has a postinstall step that fails on Windows paths containing `&` characters. Skipping the postinstall just skips downloading optional native binaries; everything still works fine.

### Configure environment

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

You can find these under **Project Settings → API** in the Supabase dashboard.

### Run the database migration

In the Supabase dashboard, open **SQL Editor** and run the entire contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

This creates all tables, RLS policies, the stock-decrement trigger, the `v_top_selling_items` view, the `product-images` storage bucket, the realtime publication, and seeds 12 sample products + 2 combos.

### Create your first admin user

1. In **Authentication → Users**, click **Add user → Send invite** (or **Create new user** with a password).
2. After the user is created, run this in the SQL Editor (replace the email):

```sql
update public.profiles
set role = 'admin', full_name = 'Manager'
where id = (select id from auth.users where email = 'manager@polwatta.lk');
```

3. Subsequent users created in the dashboard will default to `cashier`. To promote one, repeat the SQL above.

### Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000` and sign in.

---

## 2. Production Build

```bash
npm run build
npm start
```

---

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. In **Project Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Set the **Install Command** override to:

   ```
   npm install --ignore-scripts
   ```

   (Vercel runs Linux so the `&`-in-path issue doesn't apply, but `--ignore-scripts` keeps installs deterministic.)

5. Click **Deploy**. Vercel will give you a public URL like `https://polwatta-pos.vercel.app`.

6. Back in Supabase, go to **Authentication → URL Configuration** and add your Vercel domain to the **Site URL** and **Redirect URLs** so login works in production.

---

## 4. How the Realtime Sync Works

The migration adds the `sales` and `products` tables to the `supabase_realtime` publication.

- The **POS** subscribes to `products` changes, so when stock is decremented (by a sale or a manual admin adjust), the grid updates everywhere within ~1 second.
- The **Admin Dashboard** subscribes to `sales` inserts, so the *Today's Revenue* card pulses and increments live the moment any cashier completes a sale.

---

## 5. WhatsApp Receipt

When a sale is completed and a customer phone is entered, the `OrderSuccessDialog` renders a **Send via WhatsApp** button using `wa.me`. The receipt is built in [`lib/format.ts`](lib/format.ts) and includes:

- Brand header
- Order number (first 8 chars of UUID)
- Date/time
- Each line item with quantity and line total
- Grand total + payment method

Phone numbers are normalized to Sri Lankan E.164 format (`+94...`). Local format `0771234567` becomes `94771234567`.

---

## 6. Project Structure

```
app/
  (auth)/login/             — login form
  (pos)/pos/                — cashier POS page
  (admin)/admin/            — dashboard + sub-pages
    products/               — product CRUD
    combos/                 — combo CRUD
  layout.tsx, page.tsx
components/
  pos/                      — POS-specific components
  admin/                    — admin-specific components
  ui/                       — small primitives (Button, Card, Dialog, ...)
  top-bar.tsx               — shared top nav
lib/
  supabase/                 — browser/server/middleware clients
  cart-store.ts             — Zustand cart
  format.ts                 — LKR + WhatsApp helpers
  utils.ts                  — cn() helper
types/db.ts                 — Database / table types
supabase/migrations/        — SQL migration
middleware.ts               — auth + route guards
```

---

## 7. Out of Scope (future)

- Card / digital payments (currently Cash only).
- Receipt printer integration.
- Multi-outlet / multi-tenant support.
- Refunds / void sales UI.
