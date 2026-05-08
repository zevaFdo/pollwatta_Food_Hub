"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopSellingItem } from "@/types/db";
import { Card, CardContent } from "@/components/ui/card";

export function TopSellingChart({ data }: { data: TopSellingItem[] }) {
  const chartData = data.map((d) => ({
    name: d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name,
    units: Number(d.units_sold),
  }));

  return (
    <Card className="h-full">
      <div className="px-5 py-4 border-b border-stone-100">
        <h3 className="font-semibold text-stone-900">Top Selling Items</h3>
        <p className="text-xs text-stone-500">Last 30 days</p>
      </div>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-72 grid place-items-center text-sm text-stone-500">
            No sales data yet.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis type="number" stroke="#78716c" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#78716c"
                  width={120}
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e7e5e4",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value} units`, "Sold"]}
                />
                <Bar dataKey="units" fill="#ea580c" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
