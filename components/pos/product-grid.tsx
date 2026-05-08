"use client";

import { Plus } from "lucide-react";
import type { Product } from "@/types/db";
import { useCart } from "@/lib/cart-store";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: Product[];
  disabled?: boolean;
}

export function ProductGrid({ products, disabled = false }: ProductGridProps) {
  const addProduct = useCart((s) => s.addProduct);
  const { show } = useToast();

  if (products.length === 0) {
    return (
      <div className="text-center py-16 text-stone-500">
        <p className="text-lg">No items in this section.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      {products.map((p) => (
        <button
          key={p.id}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            addProduct({
              productId: p.id,
              name: p.name,
              price: p.price,
              imageUrl: p.image_url,
            });
            show(`Added ${p.name}`, "success");
          }}
          className={cn(
            "group relative flex flex-col text-left rounded-xl bg-white border border-stone-200 overflow-hidden shadow-sm transition-all",
            !disabled && "hover:shadow-md hover:border-brand-400 hover:-translate-y-0.5 active:scale-[0.98]",
            disabled && "opacity-60 cursor-not-allowed",
          )}
        >
          <div className="aspect-square w-full bg-stone-100 overflow-hidden">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.image_url}
                alt={p.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-4xl text-stone-300">?</div>
            )}
          </div>

          <div className="p-3 flex-1 flex flex-col gap-1">
            <div className="font-semibold text-sm sm:text-base text-stone-900 line-clamp-2">
              {p.name}
            </div>
            <div className="flex items-center justify-between mt-auto pt-1">
              <span className="font-bold text-brand-700 text-base sm:text-lg">
                {formatLKR(p.price)}
              </span>
              <StockBadge stock={p.stock_count} />
            </div>
          </div>

          {!disabled && (
            <div className="absolute top-2 right-2 w-9 h-9 rounded-full bg-brand-600 text-white grid place-items-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus size={20} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="destructive">Out</Badge>;
  if (stock < 5) return <Badge variant="warning">Low ({stock})</Badge>;
  return <Badge variant="default">{stock} in stock</Badge>;
}
