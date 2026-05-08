"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, BarChart3, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface TopBarProps {
  userEmail: string;
  role: "cashier" | "admin";
  current: "pos" | "admin";
}

export function TopBar({ userEmail, role, current }: TopBarProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-sm">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">
            P
          </div>
          <div className="hidden sm:block">
            <div className="font-semibold text-stone-900 leading-tight">Polwatta Sip & Script</div>
            <div className="text-xs text-stone-500">{role === "admin" ? "Admin" : "Cashier"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === "admin" && (
            <>
              <Link href="/pos">
                <Button variant={current === "pos" ? "primary" : "ghost"} size="sm">
                  <ShoppingBag size={16} />
                  <span className="hidden sm:inline">POS</span>
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant={current === "admin" ? "primary" : "ghost"} size="sm">
                  <BarChart3 size={16} />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            </>
          )}
          <span className="hidden md:inline text-sm text-stone-600 ml-2">{userEmail}</span>
          <Button variant="ghost" size="sm" onClick={signOut} title="Sign out">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
