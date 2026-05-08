"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Combo, Category } from "@/types/db";
import { useCart, getCartItemCount } from "@/lib/cart-store";
import { CategoryTabs, type TabKey } from "./category-tabs";
import { ProductGrid } from "./product-grid";
import { ComboGrid } from "./combo-grid";
import { CartSidebar } from "./cart-sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PosShellProps {
  initialProducts: Product[];
  initialCombos: Combo[];
  cashierId: string;
}

export function PosShell({ initialProducts, initialCombos, cashierId }: PosShellProps) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const lines = useCart((s) => s.lines);
  const cartItemCount = getCartItemCount(lines);

  const [activeTab, setActiveTab] = useState<TabKey>("Drinks");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const { data: products = initialProducts } = useQuery({
    queryKey: ["pos", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
    initialData: initialProducts,
  });

  const { data: combos = initialCombos } = useQuery({
    queryKey: ["pos", "combos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combos")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Combo[];
    },
    initialData: initialCombos,
  });

  // Realtime: re-fetch products on any change
  useEffect(() => {
    const channel = supabase
      .channel("pos-products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pos", "products"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  const inStock = products.filter((p) => p.stock_count > 0);
  const outOfStock = products.filter((p) => p.stock_count <= 0);

  function gridForTab(tab: TabKey) {
    if (tab === "Combos") {
      return <ComboGrid combos={combos} products={products} />;
    }
    if (tab === "OutOfStock") {
      return <ProductGrid products={outOfStock} disabled />;
    }
    return (
      <ProductGrid products={inStock.filter((p) => p.category === (tab as Category))} />
    );
  }

  return (
    <div className="flex-1 grid lg:grid-cols-[1fr_400px] min-h-0">
      <div className="flex flex-col min-h-0 overflow-hidden">
        <CategoryTabs
          active={activeTab}
          onChange={setActiveTab}
          outOfStockCount={outOfStock.length}
        />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 lg:pb-6 scrollbar-thin">
          {gridForTab(activeTab)}
        </div>
      </div>

      {/* Desktop: persistent cart sidebar */}
      <aside className="hidden lg:flex flex-col border-l border-stone-200 bg-white min-h-0">
        <CartSidebar cashierId={cashierId} />
      </aside>

      {/* Mobile: floating "View Cart" button */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 p-3 bg-gradient-to-t from-stone-50 via-stone-50 to-transparent z-30">
        <Button
          size="lg"
          className="w-full shadow-lg"
          onClick={() => setMobileCartOpen(true)}
        >
          <ShoppingCart size={20} />
          View Cart {cartItemCount > 0 ? `(${cartItemCount})` : ""}
        </Button>
      </div>

      <Dialog
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        className="max-w-md w-full p-0 max-h-[90vh] flex flex-col"
      >
        <DialogHeader>
          <DialogTitle>Cart</DialogTitle>
        </DialogHeader>
        <DialogBody className="px-0 flex-1 flex flex-col">
          <CartSidebar cashierId={cashierId} onAfterCheckout={() => setMobileCartOpen(false)} />
        </DialogBody>
      </Dialog>
    </div>
  );
}
