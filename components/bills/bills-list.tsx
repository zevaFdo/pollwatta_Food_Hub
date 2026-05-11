"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Receipt as ReceiptIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { formatLKR, shortBillCode } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Sale } from "@/types/db";

interface BillsListProps {
  initialSales: Sale[];
}

export function BillsList({ initialSales }: BillsListProps) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: sales = initialSales } = useQuery({
    queryKey: ["bills", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, created_at, total_amount, items, payment_method, customer_phone, cashier_id")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Sale[];
    },
    initialData: initialSales,
  });

  useEffect(() => {
    const channel = supabase
      .channel("bills-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["bills", "list"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) => {
      if (s.id.toLowerCase().startsWith(q)) return true;
      if (shortBillCode(s.id).toLowerCase().includes(q)) return true;
      if (s.customer_phone?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [sales, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
        />
        <Input
          type="search"
          placeholder="Search by bill code or phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
          autoFocus
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-stone-500 py-16">
              <ReceiptIcon size={48} className="mb-2 text-stone-300" />
              <p className="font-medium">
                {sales.length === 0 ? "No bills yet." : "No bills match your search."}
              </p>
              {sales.length > 0 && query && (
                <p className="text-xs mt-1">
                  Tip: bill codes look like <span className="font-mono">4F2A1B7C</span>.
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filtered.map((s) => {
                const date = new Date(s.created_at);
                const dateStr = date.toLocaleDateString("en-LK", {
                  month: "short",
                  day: "2-digit",
                });
                const timeStr = date.toLocaleTimeString("en-LK", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                });
                const itemCount = Array.isArray(s.items)
                  ? s.items.reduce((acc, it) => acc + (it.quantity ?? 0), 0)
                  : 0;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/bills/${s.id}`}
                      className="flex items-center justify-between px-5 py-4 text-sm hover:bg-stone-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 font-mono">
                          #{shortBillCode(s.id)}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5 truncate">
                          {dateStr} · {timeStr}
                          {s.customer_phone ? ` · ${s.customer_phone}` : ""}
                          {itemCount > 0 ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}
                        </div>
                      </div>
                      <div className="font-bold text-brand-700 ml-3 flex-shrink-0">
                        {formatLKR(Number(s.total_amount))}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-stone-500 text-center">
        Showing the {sales.length === 100 ? "latest 100" : sales.length} bill
        {sales.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
