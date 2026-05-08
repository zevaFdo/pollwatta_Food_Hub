"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import type { Combo, Product } from "@/types/db";
import { formatLKR } from "@/lib/format";
import { ComboBuilderDialog } from "./combo-builder-dialog";

interface ComboGridProps {
  combos: Combo[];
  products: Product[];
}

export function ComboGrid({ combos, products }: ComboGridProps) {
  const [selected, setSelected] = useState<Combo | null>(null);

  if (combos.length === 0) {
    return (
      <div className="text-center py-16 text-stone-500">
        <p className="text-lg">No combos available.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {combos.map((c) => {
          const includedNames = c.items
            .map((it) => products.find((p) => p.id === it.product_id)?.name)
            .filter(Boolean) as string[];

          return (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="group flex gap-4 text-left rounded-xl bg-white border border-stone-200 overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-brand-400 hover:-translate-y-0.5 active:scale-[0.99] p-2"
            >
              <div className="w-28 h-28 flex-shrink-0 rounded-lg bg-stone-100 overflow-hidden">
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-stone-300">
                    <Layers size={36} />
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col py-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg leading-tight">
                    {c.name}
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                  {includedNames.join(", ")}
                </p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="font-bold text-brand-700 text-lg">{formatLKR(c.price)}</span>
                  <span className="text-xs text-brand-600 font-medium">Customize →</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <ComboBuilderDialog
          combo={selected}
          products={products}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
