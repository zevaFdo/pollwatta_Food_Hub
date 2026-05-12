"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { formatLKR } from "@/lib/format";

interface AmountRow {
  amount: number;
  created_at: string;
}

interface SalesRow {
  total_amount: number;
  created_at: string;
}

interface RevenueVsExpensesChartProps {
  sales: SalesRow[];
  expenses: AmountRow[];
  /** Inclusive YYYY-MM-DD range used to seed empty buckets. */
  from: string;
  to: string;
}

function localDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function eachDayInclusive(from: string, to: string): string[] {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(fy, (fm ?? 1) - 1, fd ?? 1);
  const end = new Date(ty, (tm ?? 1) - 1, td ?? 1);
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const day = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${day}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export function RevenueVsExpensesChart({
  sales,
  expenses,
  from,
  to,
}: RevenueVsExpensesChartProps) {
  const data = useMemo(() => {
    const buckets = new Map<string, { revenue: number; expenses: number }>();
    for (const day of eachDayInclusive(from, to)) {
      buckets.set(day, { revenue: 0, expenses: 0 });
    }
    for (const s of sales) {
      const key = localDateKey(s.created_at);
      const b = buckets.get(key) ?? { revenue: 0, expenses: 0 };
      b.revenue += Number(s.total_amount);
      buckets.set(key, b);
    }
    for (const e of expenses) {
      const key = localDateKey(e.created_at);
      const b = buckets.get(key) ?? { revenue: 0, expenses: 0 };
      b.expenses += Number(e.amount);
      buckets.set(key, b);
    }
    return Array.from(buckets.entries()).map(([date, v]) => ({
      date,
      label: new Date(date).toLocaleDateString("en-LK", {
        month: "short",
        day: "numeric",
      }),
      revenue: v.revenue,
      expenses: v.expenses,
    }));
  }, [sales, expenses, from, to]);

  const empty = data.every((d) => d.revenue === 0 && d.expenses === 0);

  return (
    <Card className="h-full">
      <div className="px-5 py-4 border-b border-stone-100">
        <h3 className="font-semibold text-stone-900">Revenue vs Expenses</h3>
        <p className="text-xs text-stone-500">
          Daily totals over the selected range
        </p>
      </div>
      <CardContent>
        {empty ? (
          <div className="h-72 grid place-items-center text-sm text-stone-500">
            No data for the selected period.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis
                  dataKey="label"
                  stroke="#78716c"
                  fontSize={12}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  stroke="#78716c"
                  fontSize={12}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e7e5e4",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    formatLKR(value),
                    name === "revenue" ? "Revenue" : "Expenses",
                  ]}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value: string) =>
                    value === "revenue" ? "Revenue" : "Expenses"
                  }
                />
                <Bar
                  dataKey="revenue"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
