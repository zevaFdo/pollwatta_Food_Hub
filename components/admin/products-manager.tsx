"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Power } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Category } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES: Category[] = ["Drinks", "Short-eats", "Sweets", "BBQ"];

interface ProductsManagerProps {
  initialProducts: Product[];
}

export function ProductsManager({ initialProducts }: ProductsManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: products = initialProducts } = useQuery({
    queryKey: ["admin", "products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    initialData: initialProducts,
  });

  async function toggleActive(p: Product) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: !p.is_active } as never)
      .eq("id", p.id);
    if (error) {
      show(error.message, "error");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin", "products", "all"] });
      show(`${p.name} ${p.is_active ? "hidden" : "shown"}`, "success");
    }
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      show(error.message, "error");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin", "products", "all"] });
      show(`Deleted ${p.name}`, "success");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-600">{products.length} products</p>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          New Product
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-stone-50 border-b border-stone-100 text-stone-600 text-xs uppercase">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Stock</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
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
                      <span className="font-medium text-stone-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-stone-600">{p.category}</td>
                  <td className="px-3 py-3 text-stone-600">{formatLKR(p.price)}</td>
                  <td className="px-3 py-3">
                    <span className={cn("font-bold", p.stock_count < 5 ? "text-red-600" : "text-stone-900")}>
                      {p.stock_count}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {p.is_active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Hidden</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => toggleActive(p)}
                        title={p.is_active ? "Hide" : "Show"}
                      >
                        <Power size={14} />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => setEditing(p)} title="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => deleteProduct(p)}
                        title="Delete"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="p-8 text-center text-sm text-stone-500">No products yet.</div>
          )}
        </CardContent>
      </Card>

      {(editing || creating) && (
        <ProductDialog
          product={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "products", "all"] });
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function ProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { show } = useToast();
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [category, setCategory] = useState<Category>(product?.category ?? "Drinks");
  const [stockCount, setStockCount] = useState(String(product?.stock_count ?? "0"));
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      show(error.message, "error");
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      show("Image uploaded", "success");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      show("Name is required", "error");
      return;
    }
    const priceNum = Number(price);
    const stockNum = Number(stockCount);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      show("Invalid price", "error");
      return;
    }
    if (Number.isNaN(stockNum) || stockNum < 0) {
      show("Invalid stock count", "error");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      price: priceNum,
      category,
      stock_count: stockNum,
      image_url: imageUrl || null,
    };

    if (product) {
      const { error } = await supabase
        .from("products")
        .update(payload as never)
        .eq("id", product.id);
      if (error) show(error.message, "error");
      else {
        show("Product updated", "success");
        onSaved();
      }
    } else {
      const { error } = await supabase.from("products").insert(payload as never);
      if (error) show(error.message, "error");
      else {
        show("Product created", "success");
        onSaved();
      }
    }
    setSaving(false);
  }

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div>
          <Label htmlFor="p-name">Name</Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-price">Price (LKR)</Label>
            <Input
              id="p-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="p-stock">Stock</Label>
            <Input
              id="p-stock"
              type="number"
              min="0"
              value={stockCount}
              onChange={(e) => setStockCount(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="p-cat">Category</Label>
          <select
            id="p-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="flex h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Image</Label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-stone-300 text-xs">
                  No image
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Image URL or upload below"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
                className="text-xs"
                disabled={uploading}
              />
              {uploading && <p className="text-xs text-stone-500">Uploading...</p>}
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || uploading}>
          {saving && <Loader2 className="animate-spin" size={16} />}
          {saving ? "Saving..." : product ? "Save Changes" : "Create Product"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
