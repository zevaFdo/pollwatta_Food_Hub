import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { CombosManager } from "@/components/admin/combos-manager";
import type { Combo, Product } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminCombosPage() {
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

  const [combosRes, productsRes] = await Promise.all([
    supabase.from("combos").select("*").order("name"),
    supabase.from("products").select("*").order("name"),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <TopBar userEmail={user.email ?? ""} role="admin" current="admin" />
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={16} />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-stone-900">Combos</h1>
        </div>
        <CombosManager
          initialCombos={(combosRes.data ?? []) as Combo[]}
          products={(productsRes.data ?? []) as Product[]}
        />
      </main>
    </div>
  );
}
