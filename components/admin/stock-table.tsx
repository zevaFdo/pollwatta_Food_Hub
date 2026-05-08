"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Minus, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StockTable({ initialProducts }: { initialProducts: Product[] }) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [adjustingId, setAdjustingId] = useState<string | null>(null);

  const { data: products = initialProducts } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("stock_count", { ascending: true });
      if (error) throw error;
      return data as Product[];
    },
    initialData: initialProducts,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  async function adjust(p: Product, delta: number) {
    setAdjustingId(p.id);
    const newStock = Math.max(0, p.stock_count + delta);

    const { error } = await supabase
      .from("products")
      .update({ stock_count: newStock } as never)
      .eq("id", p.id);

    if (!error) {
      await supabase.from("inventory_logs").insert({
        product_id: p.id,
        change_amount: delta,
        reason: "manual adjustment",
      } as never);
      show(`Updated ${p.name} stock`, "success");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    } else {
      show(error.message, "error");
    }
    setAdjustingId(null);
  }

  return (
    <Card>
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-900">Stock Levels</h3>
          <p className="text-xs text-stone-500">
            Items with stock below 5 are highlighted in red
          </p>
        </div>
      </div>
      <CardContent className="p-0 overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-stone-50 border-b border-stone-100 text-stone-600 text-xs uppercase">
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-3 py-3 font-medium">Category</th>
              <th className="px-3 py-3 font-medium">Price</th>
              <th className="px-3 py-3 font-medium">Stock</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Adjust</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isLow = p.stock_count < 5;
              const isOut = p.stock_count <= 0;
              return (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b border-stone-100 last:border-0 hover:bg-stone-50",
                    isLow && "bg-red-50/50",
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-9 h-9 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-stone-100" />
                      )}
                      <span
                        className={cn("font-medium", isLow ? "text-red-700" : "text-stone-900")}
                      >
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-stone-600">{p.category}</td>
                  <td className="px-3 py-3 text-stone-600">{formatLKR(p.price)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "font-bold",
                        isOut ? "text-red-700" : isLow ? "text-red-600" : "text-stone-900",
                      )}
                    >
                      {p.stock_count}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {isOut ? (
                      <Badge variant="destructive">Out of Stock</Badge>
                    ) : isLow ? (
                      <Badge variant="destructive">Low</Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => adjust(p, -1)}
                        disabled={adjustingId === p.id || p.stock_count <= 0}
                        aria-label="Decrease stock"
                      >
                        {adjustingId === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Minus size={14} />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => adjust(p, 1)}
                        disabled={adjustingId === p.id}
                        aria-label="Increase stock"
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="p-6 text-center text-sm text-stone-500">No products yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
