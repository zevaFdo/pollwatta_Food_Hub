"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatLKR } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

interface RevenueCardProps {
  initialTotal: number;
  initialCount: number;
}

export function RevenueCard({ initialTotal, initialCount }: RevenueCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [total, setTotal] = useState(initialTotal);
  const [count, setCount] = useState(initialCount);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel("admin-sales")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales" },
        (payload: { new: { total_amount: number; created_at: string } }) => {
          const newTotal = Number(payload.new.total_amount);
          const created = new Date(payload.new.created_at);
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          if (created >= startOfDay) {
            setTotal((prev) => prev + newTotal);
            setCount((prev) => prev + 1);
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
            <div className="text-xs text-stone-500 mt-1">
              {count} order{count === 1 ? "" : "s"} today
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-100 grid place-items-center text-emerald-700">
            <TrendingUp size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
