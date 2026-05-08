import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { PosShell } from "@/components/pos/pos-shell";
import type { Product, Combo } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single<{ role: "cashier" | "admin"; full_name: string | null }>();

  const role = profile?.role ?? "cashier";

  const [productsRes, combosRes] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("combos").select("*").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <TopBar userEmail={user.email ?? ""} role={role} current="pos" />
      <PosShell
        initialProducts={(productsRes.data ?? []) as Product[]}
        initialCombos={(combosRes.data ?? []) as Combo[]}
        cashierId={user.id}
      />
    </div>
  );
}
