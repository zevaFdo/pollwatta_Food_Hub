"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatLKR } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import type { IncomeType } from "@/types/db";

interface RevenueCardProps {
  initialTotal: number;
  initialOrderCount: number;
  initialCustomCount: number;
}

export function RevenueCard({
  initialTotal,
  initialOrderCount,
  initialCustomCount,
}: RevenueCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [total, setTotal] = useState(initialTotal);
  const [orderCount, setOrderCount] = useState(initialOrderCount);
  const [customCount, setCustomCount] = useState(initialCustomCount);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("admin-sales")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales" },
        (payload: {
          new: {
            total_amount: number;
            created_at: string;
            income_type: IncomeType | null;
          };
        }) => {
          const newTotal = Number(payload.new.total_amount);
          const created = new Date(payload.new.created_at);
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (created >= startOfDay) {
            setTotal((prev) => prev + newTotal);
            if (payload.new.income_type === "custom") {
              setCustomCount((prev) => prev + 1);
            } else {
              setOrderCount((prev) => prev + 1);
            }
            setPulse(true);
            setTimeout(() => setPulse(false), 800);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const subtitle =
    customCount > 0
      ? `${orderCount} order${orderCount === 1 ? "" : "s"} · ${customCount} custom`
      : `${orderCount} order${orderCount === 1 ? "" : "s"} today`;

  return (
    <Card className={pulse ? "ring-2 ring-emerald-400 transition-all" : "transition-all"}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-stone-500 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Today&apos;s Revenue (Live)
            </div>
            <div className="text-3xl font-bold text-stone-900 mt-1">{formatLKR(total)}</div>
            <div className="text-xs text-stone-500 mt-1">{subtitle}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 grid place-items-center text-emerald-700">
            <TrendingUp size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
