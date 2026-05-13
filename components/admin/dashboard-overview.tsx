"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatLKR } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/admin/date-range-picker";
import {
  defaultLast30Days,
  startOfDayISO,
  endOfDayISO,
  type DateRange,
} from "@/lib/date-range";
import { RevenueVsExpensesChart } from "@/components/admin/revenue-vs-expenses-chart";
import { cn } from "@/lib/utils";

interface SalesRow {
  total_amount: number;
  created_at: string;
}

interface ExpenseRow {
  amount: number;
  expense_date: string;
}

interface DashboardOverviewProps {
  initialSales: SalesRow[];
  initialExpenses: ExpenseRow[];
  initialRange: DateRange;
}

export function DashboardOverview({
  initialSales,
  initialExpenses,
  initialRange,
}: DashboardOverviewProps) {
  const supabase = useMemo(() => createClient(), []);
  const [range, setRange] = useState<DateRange>(initialRange ?? defaultLast30Days());

  const fromISO = startOfDayISO(range.from);
  const toISO = endOfDayISO(range.to);
  const isInitialRange =
    range.from === initialRange.from && range.to === initialRange.to;

  const salesQuery = useQuery({
    queryKey: ["admin", "period-sales", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("total_amount, created_at")
        .gte("created_at", fromISO)
        .lte("created_at", toISO);
      if (error) throw error;
      return (data ?? []) as SalesRow[];
    },
    initialData: isInitialRange ? initialSales : undefined,
  });

  const expensesQuery = useQuery({
    queryKey: ["admin", "period-expenses", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, expense_date")
        // expense_date is a plain DATE column; compare against the picker's
        // YYYY-MM-DD strings directly so past-dated entries land on the day
        // they occurred rather than the day they were inserted.
        .gte("expense_date", range.from)
        .lte("expense_date", range.to);
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
    initialData: isInitialRange ? initialExpenses : undefined,
  });

  const sales = salesQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];
  const loading = salesQuery.isFetching || expensesQuery.isFetching;

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <section className="space-y-4">
      <DateRangePicker value={range} onChange={setRange} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Revenue"
          value={formatLKR(totalRevenue)}
          sub={`${sales.length} order${sales.length === 1 ? "" : "s"}`}
          icon={<TrendingUp size={24} />}
          tone="emerald"
          loading={loading}
        />
        <SummaryCard
          label="Total Expenses"
          value={formatLKR(totalExpenses)}
          sub={`${expenses.length} entr${expenses.length === 1 ? "y" : "ies"}`}
          icon={<TrendingDown size={24} />}
          tone="red"
          loading={loading}
        />
        <SummaryCard
          label="Net Profit"
          value={formatLKR(netProfit)}
          sub={netProfit >= 0 ? "In the green" : "In the red"}
          icon={<Wallet size={24} />}
          tone={netProfit >= 0 ? "emerald" : "red"}
          loading={loading}
        />
      </div>

      <RevenueVsExpensesChart
        sales={sales}
        expenses={expenses}
        from={range.from}
        to={range.to}
      />
    </section>
  );
}

type Tone = "emerald" | "red";

const TONES: Record<
  Tone,
  { iconBg: string; iconFg: string; valueText: string }
> = {
  emerald: {
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-700",
    valueText: "text-stone-900",
  },
  red: {
    iconBg: "bg-red-100",
    iconFg: "text-red-700",
    valueText: "text-red-700",
  },
};

function SummaryCard({
  label,
  value,
  sub,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone: Tone;
  loading: boolean;
}) {
  const t = TONES[tone];
  return (
    <Card className={cn(loading && "opacity-70 transition-opacity")}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-stone-500">{label}</div>
            <div className={cn("text-3xl font-bold mt-1", t.valueText)}>
              {value}
            </div>
            <div className="text-xs text-stone-500 mt-1">{sub}</div>
          </div>
          <div
            className={cn(
              "w-12 h-12 rounded-xl grid place-items-center",
              t.iconBg,
              t.iconFg,
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
