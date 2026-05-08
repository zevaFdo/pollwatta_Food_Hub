import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SaleLine } from "@/types/db";

export type CartLine =
  | {
      kind: "product";
      productId: string;
      name: string;
      price: number;
      qty: number;
      imageUrl?: string | null;
    }
  | {
      kind: "combo";
      lineId: string; // unique per combo+addons selection
      comboId: string;
      name: string;
      price: number;
      qty: number;
      imageUrl?: string | null;
      addons: Array<{
        productId: string;
        name: string;
        price: number;
        qty: number;
      }>;
    };

interface CartState {
  lines: CartLine[];
  customerPhone: string;
  addProduct: (p: {
    productId: string;
    name: string;
    price: number;
    imageUrl?: string | null;
  }) => void;
  addCombo: (c: {
    comboId: string;
    name: string;
    basePrice: number;
    imageUrl?: string | null;
    addons: Array<{ productId: string; name: string; price: number; qty: number }>;
  }) => void;
  incrementProduct: (productId: string) => void;
  decrementProduct: (productId: string) => void;
  incrementCombo: (lineId: string) => void;
  decrementCombo: (lineId: string) => void;
  removeLine: (key: string) => void;
  setCustomerPhone: (phone: string) => void;
  clear: () => void;
}

let comboLineCounter = 0;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      customerPhone: "",

      addProduct: ({ productId, name, price, imageUrl }) =>
        set((state) => {
          const existing = state.lines.find(
            (l) => l.kind === "product" && l.productId === productId,
          );
          if (existing && existing.kind === "product") {
            return {
              lines: state.lines.map((l) =>
                l.kind === "product" && l.productId === productId
                  ? { ...l, qty: l.qty + 1 }
                  : l,
              ),
            };
          }
          return {
            lines: [
              ...state.lines,
              { kind: "product", productId, name, price, qty: 1, imageUrl },
            ],
          };
        }),

      addCombo: ({ comboId, name, basePrice, imageUrl, addons }) =>
        set((state) => {
          comboLineCounter += 1;
          const lineId = `${comboId}-${Date.now()}-${comboLineCounter}`;
          const addonsTotal = addons.reduce((acc, a) => acc + a.price * a.qty, 0);
          return {
            lines: [
              ...state.lines,
              {
                kind: "combo",
                lineId,
                comboId,
                name,
                price: basePrice + addonsTotal,
                qty: 1,
                imageUrl,
                addons,
              },
            ],
          };
        }),

      incrementProduct: (productId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.kind === "product" && l.productId === productId
              ? { ...l, qty: l.qty + 1 }
              : l,
          ),
        })),

      decrementProduct: (productId) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.kind === "product" && l.productId === productId
                ? { ...l, qty: l.qty - 1 }
                : l,
            )
            .filter((l) => !(l.kind === "product" && l.qty <= 0)),
        })),

      incrementCombo: (lineId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.kind === "combo" && l.lineId === lineId ? { ...l, qty: l.qty + 1 } : l,
          ),
        })),

      decrementCombo: (lineId) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.kind === "combo" && l.lineId === lineId
                ? { ...l, qty: l.qty - 1 }
                : l,
            )
            .filter((l) => !(l.kind === "combo" && l.qty <= 0)),
        })),

      removeLine: (key) =>
        set((state) => ({
          lines: state.lines.filter((l) =>
            l.kind === "product" ? l.productId !== key : l.lineId !== key,
          ),
        })),

      setCustomerPhone: (phone) => set({ customerPhone: phone }),

      clear: () => set({ lines: [], customerPhone: "" }),
    }),
    {
      name: "polwatta-cart-v1",
    },
  ),
);

export function getCartTotal(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.price * l.qty, 0);
}

export function getCartItemCount(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.qty, 0);
}

/**
 * Convert cart lines into the flat SaleLine[] shape stored in sales.items.
 * Combos are flattened into one combo line + N addon lines.
 */
export function cartToSaleLines(lines: CartLine[]): SaleLine[] {
  const out: SaleLine[] = [];
  for (const l of lines) {
    if (l.kind === "product") {
      out.push({
        type: "product",
        id: l.productId,
        name: l.name,
        price: l.price,
        quantity: l.qty,
      });
    } else {
      const addonTotal = l.addons.reduce((acc, a) => acc + a.price * a.qty, 0);
      const baseComboPrice = l.price - addonTotal;
      out.push({
        type: "combo",
        id: l.comboId,
        name: l.name,
        price: baseComboPrice,
        quantity: l.qty,
      });
      for (const a of l.addons) {
        out.push({
          type: "addon",
          id: a.productId,
          name: a.name,
          price: a.price,
          quantity: a.qty * l.qty,
        });
      }
    }
  }
  return out;
}
