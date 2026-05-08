"use client";

import { Coffee, Drumstick, Cookie, Cake, Layers, Ban, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabKey = "Drinks" | "Short-eats" | "Sweets" | "BBQ" | "Combos" | "OutOfStock";

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: "Drinks", label: "Drinks", icon: Coffee },
  { key: "Short-eats", label: "Short-eats", icon: Cookie },
  { key: "Sweets", label: "Sweets", icon: Cake },
  { key: "BBQ", label: "BBQ", icon: Drumstick },
  { key: "Combos", label: "Combos", icon: Layers },
  { key: "OutOfStock", label: "Out of Stock", icon: Ban },
];

export function CategoryTabs({
  active,
  onChange,
  outOfStockCount,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  outOfStockCount: number;
}) {
  return (
    <nav className="px-3 sm:px-6 py-3 border-b border-stone-200 bg-white">
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          const showBadge = key === "OutOfStock" && outOfStockCount > 0;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                "flex items-center gap-2 px-4 sm:px-5 h-14 rounded-xl border whitespace-nowrap font-semibold text-sm sm:text-base transition-all",
                isActive
                  ? "bg-brand-600 text-white border-brand-600 shadow-md scale-[1.02]"
                  : "bg-white text-stone-700 border-stone-200 hover:border-brand-300 hover:bg-brand-50",
              )}
            >
              <Icon size={20} />
              {label}
              {showBadge && (
                <span
                  className={cn(
                    "ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-bold",
                    isActive ? "bg-white text-brand-700" : "bg-red-100 text-red-700",
                  )}
                >
                  {outOfStockCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
