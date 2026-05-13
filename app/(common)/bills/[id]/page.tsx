import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { BillDetail } from "@/components/bills/bill-detail";
import type { Sale } from "@/types/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BillDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!UUID_RE.test(params.id)) notFound();

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

  const { data: sale } = await supabase
    .from("sales")
    .select(
      "id, created_at, total_amount, items, payment_method, customer_phone, cashier_id, income_type, income_category, description",
    )
    .eq("id", params.id)
    .maybeSingle<Sale>();

  // Custom-income rows live in `sales` but are not receipts; treat as missing
  // here so a stray UUID in the URL doesn't render an empty bill.
  if (!sale || sale.income_type !== "order") notFound();

  let cashierName: string | null = null;
  if (sale.cashier_id) {
    const { data: cashier } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", sale.cashier_id)
      .maybeSingle<{ full_name: string | null }>();
    cashierName = cashier?.full_name ?? null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <div className="print:hidden">
        <TopBar userEmail={user.email ?? ""} role={role} current="bills" />
      </div>
      <main className="flex-1 p-4 sm:p-6 max-w-3xl w-full mx-auto">
        <BillDetail sale={sale} cashierName={cashierName} />
      </main>
    </div>
  );
}
