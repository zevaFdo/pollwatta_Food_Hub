import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { BillsList } from "@/components/bills/bills-list";
import type { Sale } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: "cashier" | "admin" }>();

  const role = profile?.role ?? "cashier";

  const { data: salesData } = await supabase
    .from("sales")
    .select("id, created_at, total_amount, items, payment_method, customer_phone, cashier_id")
    .order("created_at", { ascending: false })
    .limit(100);

  const sales = (salesData ?? []) as Sale[];

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <TopBar userEmail={user.email ?? ""} role={role} current="bills" />
      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Bills</h1>
          <p className="text-sm text-stone-600">
            Search by bill code (e.g. <span className="font-mono">4F2A1B7C</span>) or customer phone.
          </p>
        </div>
        <BillsList initialSales={sales} />
      </main>
    </div>
  );
}
