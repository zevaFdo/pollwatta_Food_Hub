"use client";

import { useState } from "react";
import { Trash2, Plus, Minus, ShoppingBag, Loader2, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  useCart,
  getCartTotal,
  cartToSaleLines,
  type CartLine,
} from "@/lib/cart-store";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Sale } from "@/types/db";
import { OrderSuccessDialog } from "./order-success-dialog";
import { CustomIncomeDialog } from "./custom-income-dialog";
import { cn } from "@/lib/utils";

interface CartSidebarProps {
  cashierId: string;
  onAfterCheckout?: () => void;
}

export function CartSidebar({ cashierId, onAfterCheckout }: CartSidebarProps) {
  const lines = useCart((s) => s.lines);
  const customerPhone = useCart((s) => s.customerPhone);
  const setCustomerPhone = useCart((s) => s.setCustomerPhone);
  const incrementProduct = useCart((s) => s.incrementProduct);
  const decrementProduct = useCart((s) => s.decrementProduct);
  const incrementCombo = useCart((s) => s.incrementCombo);
  const decrementCombo = useCart((s) => s.decrementCombo);
  const removeLine = useCart((s) => s.removeLine);
  const clear = useCart((s) => s.clear);
  const { show } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);

  const total = getCartTotal(lines);

  async function handleCheckout() {
    if (lines.length === 0) return;
    setSubmitting(true);

    const saleItems = cartToSaleLines(lines);
    const supabase = createClient();

    const insertPayload = {
      total_amount: total,
      items: saleItems,
      payment_method: "Cash",
      customer_phone: customerPhone || null,
      cashier_id: cashierId,
    };

    const { data, error } = await supabase
      .from("sales")
      .insert(insertPayload as never)
      .select()
      .single<Sale>();

    setSubmitting(false);

    if (error || !data) {
      show(error?.message ?? "Could not complete order", "error");
      return;
    }

    setCompletedSale(data);
    clear();
  }

  function handleSuccessClose() {
    setCompletedSale(null);
    onAfterCheckout?.();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2 flex-wrap">
        <ShoppingBag size={20} className="text-brand-600" />
        <h2 className="font-semibold text-lg text-stone-900">Order</h2>
        <span className="text-sm text-stone-500">· {lines.length} items</span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => setIncomeOpen(true)}
          title="Record non-product income (parking, tips, etc.)"
        >
          <PlusCircle size={14} />
          Custom Income
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 scrollbar-thin">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-stone-500 py-12">
            <ShoppingBag size={48} className="mb-2 text-stone-300" />
            <p className="font-medium">Cart is empty</p>
            <p className="text-sm">Tap items to add them.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {lines.map((l) => (
              <CartLineRow
                key={l.kind === "product" ? l.productId : l.lineId}
                line={l}
                onIncrement={() =>
                  l.kind === "product" ? incrementProduct(l.productId) : incrementCombo(l.lineId)
                }
                onDecrement={() =>
                  l.kind === "product" ? decrementProduct(l.productId) : decrementCombo(l.lineId)
                }
                onRemove={() =>
                  removeLine(l.kind === "product" ? l.productId : l.lineId)
                }
              />
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 py-4 border-t border-stone-200 bg-stone-50/50 space-y-3">
        <div>
          <Label htmlFor="phone">Customer Phone (for WhatsApp receipt)</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="0771234567"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between text-stone-700">
          <span>Subtotal</span>
          <span>{formatLKR(total)}</span>
        </div>
        <div className="flex items-center justify-between text-2xl font-bold text-stone-900">
          <span>Total</span>
          <span className="text-brand-700">{formatLKR(total)}</span>
        </div>

        <Button
          variant="success"
          size="xl"
          className={cn("w-full", lines.length === 0 && "opacity-60")}
          disabled={lines.length === 0 || submitting}
          onClick={handleCheckout}
        >
          {submitting ? <Loader2 className="animate-spin" size={20} /> : null}
          {submitting ? "Processing..." : "Complete Order"}
        </Button>

        {lines.length > 0 && (
          <button
            onClick={() => clear()}
            className="block w-full text-center text-xs text-stone-500 hover:text-red-600"
          >
            Clear cart
          </button>
        )}
      </div>

      {completedSale && (
        <OrderSuccessDialog sale={completedSale} onClose={handleSuccessClose} />
      )}

      <CustomIncomeDialog
        open={incomeOpen}
        cashierId={cashierId}
        onClose={() => setIncomeOpen(false)}
      />
    </div>
  );
}

function CartLineRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const lineTotal = line.price * line.qty;

  return (
    <li className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-start gap-3">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={line.imageUrl}
            alt={line.name}
            className="w-12 h-12 rounded-md object-cover flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-stone-100 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-stone-900 text-sm leading-tight truncate">
              {line.name}
              {line.kind === "combo" && (
                <span className="ml-1.5 text-xs font-normal text-brand-600">(Combo)</span>
              )}
            </p>
            <button
              onClick={onRemove}
              className="text-stone-400 hover:text-red-600 flex-shrink-0"
              aria-label="Remove"
            >
              <Trash2 size={16} />
            </button>
          </div>
          {line.kind === "combo" && line.addons.length > 0 && (
            <ul className="text-xs text-stone-500 mt-0.5">
              {line.addons.map((a) => (
                <li key={a.productId}>
                  + {a.name} x{a.qty}
                </li>
              ))}
            </ul>
          )}
          <div className="text-xs text-stone-500 mt-1">{formatLKR(line.price)} each</div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={onDecrement} aria-label="Decrease">
                <Minus size={14} />
              </Button>
              <span className="w-7 text-center font-semibold">{line.qty}</span>
              <Button size="icon" variant="outline" onClick={onIncrement} aria-label="Increase">
                <Plus size={14} />
              </Button>
            </div>
            <span className="font-bold text-brand-700">{formatLKR(lineTotal)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}
