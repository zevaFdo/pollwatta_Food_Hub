import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Layers } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { RevenueCard } from "@/components/admin/revenue-card";
import { TopSellingChart } from "@/components/admin/top-selling-chart";
import { StockTable } from "@/components/admin/stock-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { shortBillCode } from "@/lib/format";
import type { Product, TopSellingItem } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (profile?.role !== "admin") redirect("/pos");

  const [salesTodayRes, productsRes, topItemsRes, recentSalesRes] = await Promise.all([
    supabase
      .from("sales")
      .select("total_amount, created_at")
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from("products").select("*").order("stock_count", { ascending: true }),
    supabase
      .from("v_top_selling_items")
      .select("*")
      .order("units_sold", { ascending: false })
      .limit(10),
    supabase
      .from("sales")
      .select("id, created_at, total_amount, items, customer_phone")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const salesToday = (salesTodayRes.data ?? []) as Array<{ total_amount: number; created_at: string }>;
  const products = (productsRes.data ?? []) as Product[];
  const topItems = (topItemsRes.data ?? []) as TopSellingItem[];
  const recentSales = (recentSalesRes.data ?? []) as Array<{
    id: string;
    created_at: string;
    total_amount: number;
    items: unknown;
    customer_phone: string | null;
  }>;

  const todayTotal = salesToday.reduce((acc, row) => acc + Number(row.total_amount), 0);
  const todayCount = salesToday.length;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <TopBar userEmail={user.email ?? ""} role="admin" current="admin" />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Admin Dashboard</h1>
            <p className="text-sm text-stone-600">Live overview of today&apos;s operations.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/products">
              <Button variant="outline">
                <Package size={16} />
                Manage Products
              </Button>
            </Link>
            <Link href="/admin/combos">
              <Button variant="outline">
                <Layers size={16} />
                Manage Combos
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RevenueCard initialTotal={todayTotal} initialCount={todayCount} />
          <Card>
            <CardContent>
              <div className="text-sm text-stone-500">Active Products</div>
              <div className="text-3xl font-bold text-stone-900 mt-1">
                {products.filter((p) => p.is_active).length}
              </div>
              <div className="text-xs text-stone-500 mt-1">across 4 categories</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="text-sm text-stone-500">Low Stock Items</div>
              <div className="text-3xl font-bold text-red-600 mt-1">
                {products.filter((p) => p.stock_count < 5).length}
              </div>
              <div className="text-xs text-stone-500 mt-1">stock below 5</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TopSellingChart data={topItems} />
          </div>
          <RecentSalesCard sales={recentSales} />
        </div>

        <StockTable initialProducts={products} />
      </main>
    </div>
  );
}

function RecentSalesCard({
  sales,
}: {
  sales: Array<{
    id: string;
    created_at: string;
    total_amount: number;
    items: unknown;
    customer_phone: string | null;
  }>;
}) {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">Recent Sales</h3>
        <Link
          href="/bills"
          className="text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          View all
        </Link>
      </div>
      <CardContent className="p-0">
        {sales.length === 0 ? (
          <div className="p-6 text-center text-sm text-stone-500">No sales yet.</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {sales.map((s) => {
              const t = new Date(s.created_at).toLocaleTimeString("en-LK", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });
              return (
                <li key={s.id}>
                  <Link
                    href={`/bills/${s.id}`}
                    className="flex items-center justify-between px-5 py-3 text-sm hover:bg-stone-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-stone-900">
                        Order #{shortBillCode(s.id)}
                      </div>
                      <div className="text-xs text-stone-500">
                        {t}
                        {s.customer_phone ? ` · ${s.customer_phone}` : ""}
                      </div>
                    </div>
                    <div className="font-bold text-brand-700">
                      Rs. {Number(s.total_amount).toLocaleString()}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
