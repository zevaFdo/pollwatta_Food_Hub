"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import type { Combo, Product } from "@/types/db";
import { useCart } from "@/lib/cart-store";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ComboBuilderDialogProps {
  combo: Combo;
  products: Product[];
  onClose: () => void;
}

export function ComboBuilderDialog({ combo, products, onClose }: ComboBuilderDialogProps) {
  const addCombo = useCart((s) => s.addCombo);
  const { show } = useToast();

  const [addonQty, setAddonQty] = useState<Record<string, number>>({});

  const includedItems = combo.items
    .map((it) => {
      const p = products.find((prod) => prod.id === it.product_id);
      return p ? { product: p, quantity: it.quantity } : null;
    })
    .filter(Boolean) as { product: Product; quantity: number }[];

  // Eligible add-ons: in-stock products NOT already in the combo
  const includedIds = new Set(combo.items.map((it) => it.product_id));
  const addonCandidates = products.filter(
    (p) => p.stock_count > 0 && !includedIds.has(p.id),
  );

  const addonsTotal = Object.entries(addonQty).reduce((acc, [pid, q]) => {
    const p = products.find((prod) => prod.id === pid);
    return acc + (p?.price ?? 0) * q;
  }, 0);

  const total = combo.price + addonsTotal;

  function increment(productId: string) {
    setAddonQty((m) => ({ ...m, [productId]: (m[productId] ?? 0) + 1 }));
  }

  function decrement(productId: string) {
    setAddonQty((m) => {
      const next = { ...m };
      const q = (next[productId] ?? 0) - 1;
      if (q <= 0) delete next[productId];
      else next[productId] = q;
      return next;
    });
  }

  function handleAdd() {
    const addons = Object.entries(addonQty).map(([pid, q]) => {
      const p = products.find((prod) => prod.id === pid)!;
      return { productId: pid, name: p.name, price: p.price, qty: q };
    });

    addCombo({
      comboId: combo.id,
      name: combo.name,
      basePrice: combo.price,
      imageUrl: combo.image_url,
      addons,
    });

    show(`Added ${combo.name}`, "success");
    onClose();
  }

  return (
    <Dialog open={true} onClose={onClose} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{combo.name}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-stone-900 mb-2">Included</h4>
          <ul className="rounded-lg border border-stone-200 divide-y divide-stone-100">
            {includedItems.map((it) => (
              <li key={it.product.id} className="flex items-center justify-between p-3 text-sm">
                <span className="text-stone-800">
                  {it.product.name}{" "}
                  {it.quantity > 1 && <span className="text-stone-500">x{it.quantity}</span>}
                </span>
                <span className="text-stone-500">included</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-stone-900 mb-2">
            Add Extra Side Items <span className="text-stone-500 font-normal">(optional)</span>
          </h4>
          {addonCandidates.length === 0 ? (
            <p className="text-sm text-stone-500">No additional sides available.</p>
          ) : (
            <ul className="rounded-lg border border-stone-200 divide-y divide-stone-100 max-h-72 overflow-y-auto scrollbar-thin">
              {addonCandidates.map((p) => {
                const qty = addonQty[p.id] ?? 0;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-stone-900 truncate">{p.name}</div>
                      <div className="text-stone-500 text-xs">
                        {formatLKR(p.price)} · {p.category}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => decrement(p.id)}
                        disabled={qty <= 0}
                        aria-label={`Decrease ${p.name}`}
                      >
                        <Minus size={16} />
                      </Button>
                      <span className="w-8 text-center font-semibold text-stone-900">{qty}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => increment(p.id)}
                        aria-label={`Increase ${p.name}`}
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-brand-50 border border-brand-200 p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">Total</span>
          <span className="text-2xl font-bold text-brand-800">{formatLKR(total)}</span>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleAdd}>Add Combo to Cart</Button>
      </DialogFooter>
    </Dialog>
  );
}
