"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Power, Loader2, Layers, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Combo, Product, ComboItemRef } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";

interface CombosManagerProps {
  initialCombos: Combo[];
  products: Product[];
}

export function CombosManager({ initialCombos, products }: CombosManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [editing, setEditing] = useState<Combo | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: combos = initialCombos } = useQuery({
    queryKey: ["admin", "combos", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("combos").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Combo[];
    },
    initialData: initialCombos,
  });

  async function toggleActive(c: Combo) {
    const { error } = await supabase
      .from("combos")
      .update({ is_active: !c.is_active } as never)
      .eq("id", c.id);
    if (error) show(error.message, "error");
    else {
      queryClient.invalidateQueries({ queryKey: ["admin", "combos", "all"] });
      show(`${c.name} ${c.is_active ? "hidden" : "shown"}`, "success");
    }
  }

  async function deleteCombo(c: Combo) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    const { error } = await supabase.from("combos").delete().eq("id", c.id);
    if (error) show(error.message, "error");
    else {
      queryClient.invalidateQueries({ queryKey: ["admin", "combos", "all"] });
      show(`Deleted ${c.name}`, "success");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-600">{combos.length} combos</p>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          New Combo
        </Button>
      </div>

      {combos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-stone-500">
            <Layers size={36} className="mx-auto mb-3 text-stone-300" />
            <p>No combos yet. Create your first BBQ combo!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {combos.map((c) => {
            const includedNames = c.items
              .map((it) => products.find((p) => p.id === it.product_id)?.name)
              .filter(Boolean) as string[];
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0">
                      {c.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-stone-300">
                          <Layers size={28} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-stone-900 leading-tight">{c.name}</h3>
                        {c.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="default">Hidden</Badge>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        {includedNames.join(", ") || "(no items)"}
                      </p>
                      <div className="text-lg font-bold text-brand-700 mt-1">
                        {formatLKR(c.price)}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1.5 mt-3">
                    <Button size="icon" variant="outline" onClick={() => toggleActive(c)} title={c.is_active ? "Hide" : "Show"}>
                      <Power size={14} />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => setEditing(c)} title="Edit">
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => deleteCombo(c)}
                      title="Delete"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(editing || creating) && (
        <ComboDialog
          combo={editing}
          products={products}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "combos", "all"] });
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function ComboDialog({
  combo,
  products,
  onClose,
  onSaved,
}: {
  combo: Combo | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { show } = useToast();
  const [name, setName] = useState(combo?.name ?? "");
  const [price, setPrice] = useState(String(combo?.price ?? ""));
  const [imageUrl, setImageUrl] = useState(combo?.image_url ?? "");
  const [items, setItems] = useState<ComboItemRef[]>(combo?.items ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function setItemQty(productId: string, delta: number) {
    setItems((current) => {
      const existing = current.find((i) => i.product_id === productId);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return current.filter((i) => i.product_id !== productId);
        return current.map((i) =>
          i.product_id === productId ? { ...i, quantity: newQty } : i,
        );
      }
      if (delta > 0) return [...current, { product_id: productId, quantity: 1 }];
      return current;
    });
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `combos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) show(error.message, "error");
    else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      show("Image uploaded", "success");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!name.trim()) {
      show("Name required", "error");
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      show("Invalid price", "error");
      return;
    }
    if (items.length === 0) {
      show("Add at least one item to the combo", "error");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      price: priceNum,
      image_url: imageUrl || null,
      items,
    };

    if (combo) {
      const { error } = await supabase
        .from("combos")
        .update(payload as never)
        .eq("id", combo.id);
      if (error) show(error.message, "error");
      else {
        show("Combo updated", "success");
        onSaved();
      }
    } else {
      const { error } = await supabase.from("combos").insert(payload as never);
      if (error) show(error.message, "error");
      else {
        show("Combo created", "success");
        onSaved();
      }
    }
    setSaving(false);
  }

  return (
    <Dialog open={true} onClose={onClose} className="max-w-xl">
      <DialogHeader>
        <DialogTitle>{combo ? "Edit Combo" : "New Combo"}</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div>
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-price">Price (LKR)</Label>
          <Input
            id="c-price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
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
            </div>
          </div>
        </div>

        <div>
          <Label>Included Items</Label>
          <div className="border border-stone-200 rounded-lg max-h-64 overflow-y-auto scrollbar-thin divide-y divide-stone-100">
            {products.map((p) => {
              const existing = items.find((i) => i.product_id === p.id);
              const qty = existing?.quantity ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between p-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-stone-900 truncate">{p.name}</div>
                    <div className="text-xs text-stone-500">
                      {formatLKR(p.price)} · {p.category}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setItemQty(p.id, -1)}
                      disabled={qty <= 0}
                    >
                      <Minus size={14} />
                    </Button>
                    <span className="w-8 text-center font-semibold">{qty}</span>
                    <Button size="icon" variant="outline" onClick={() => setItemQty(p.id, 1)}>
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || uploading}>
          {saving && <Loader2 className="animate-spin" size={16} />}
          {saving ? "Saving..." : combo ? "Save Changes" : "Create Combo"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
