"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Receipt as ReceiptIcon, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Expense, ExpenseCategory } from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";

const CATEGORIES: ExpenseCategory[] = [
  "Ingredients",
  "Utilities",
  "Salaries",
  "Rent",
  "Maintenance",
  "Marketing",
  "Other",
];

const RECEIPTS_BUCKET = "expense-receipts";

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatExpenseDate(dateStr: string) {
  // expense_date is a plain YYYY-MM-DD string; parse without timezone shifts.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface ExpensesManagerProps {
  initialExpenses: Expense[];
}

export function ExpensesManager({ initialExpenses }: ExpensesManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: expenses = initialExpenses } = useQuery({
    queryKey: ["admin", "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    initialData: initialExpenses,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-expenses")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin", "expenses"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  async function deleteExpense(e: Expense) {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    setDeletingId(e.id);
    // Best-effort: also remove receipt object from storage if present.
    if (e.image_url) {
      await supabase.storage.from(RECEIPTS_BUCKET).remove([e.image_url]);
    }
    const { error } = await supabase.from("expenses").delete().eq("id", e.id);
    if (error) {
      show(error.message, "error");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin", "expenses"] });
      show("Expense deleted", "success");
    }
    setDeletingId(null);
  }

  const total = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-stone-600">
          {expenses.length} expense{expenses.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-stone-900">{formatLKR(total)}</span>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          New Expense
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-stone-50 border-b border-stone-100 text-stone-600 text-xs uppercase">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Description</th>
                <th className="px-3 py-3 font-medium">Receipt</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-5 py-3 text-stone-700 whitespace-nowrap">
                    {formatExpenseDate(e.expense_date)}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="default">{e.category}</Badge>
                  </td>
                  <td className="px-3 py-3 font-semibold text-stone-900 whitespace-nowrap">
                    {formatLKR(Number(e.amount))}
                  </td>
                  <td className="px-3 py-3 text-stone-600 max-w-xs">
                    <div className="truncate" title={e.description ?? ""}>
                      {e.description || (
                        <span className="text-stone-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <ReceiptThumb path={e.image_url} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => deleteExpense(e)}
                        disabled={deletingId === e.id}
                        title="Delete"
                        className="text-red-600 hover:bg-red-50"
                      >
                        {deletingId === e.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 && (
            <div className="p-10 text-center text-sm text-stone-500">
              <ReceiptIcon size={32} className="mx-auto mb-3 text-stone-300" />
              <p>No expenses recorded yet.</p>
              <p className="text-xs mt-1">
                Click &ldquo;New Expense&rdquo; to add your first one.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {creating && (
        <ExpenseDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "expenses"] });
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function ReceiptThumb({ path }: { path: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, path]);

  if (!path) {
    return <span className="text-stone-300 text-xs">—</span>;
  }
  if (!url) {
    return (
      <div className="w-10 h-10 rounded-md bg-stone-100 grid place-items-center text-stone-300">
        <ImageIcon size={14} />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Receipt"
        className="w-10 h-10 rounded-md object-cover border border-stone-200 hover:opacity-80 transition-opacity"
      />
    </a>
  );
}

function ExpenseDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { show } = useToast();
  const today = useMemo(() => todayLocalISO(), []);
  const [category, setCategory] = useState<ExpenseCategory>("Ingredients");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .upload(path, file);
    if (error) {
      show(error.message, "error");
    } else {
      setImagePath(path);
      const { data: signed } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .createSignedUrl(path, 3600);
      setPreviewUrl(signed?.signedUrl ?? null);
      show("Receipt uploaded", "success");
    }
    setUploading(false);
  }

  async function handleSave() {
    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      show("Enter a valid amount", "error");
      return;
    }
    if (!expenseDate) {
      show("Select a date", "error");
      return;
    }
    if (expenseDate > today) {
      show("Date cannot be in the future", "error");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("expenses").insert({
      category,
      amount: amountNum,
      description: description.trim() || null,
      image_url: imagePath,
      expense_date: expenseDate,
      created_by: user?.id ?? null,
    } as never);

    if (error) {
      show(error.message, "error");
    } else {
      show("Expense recorded", "success");
      onSaved();
    }
    setSaving(false);
  }

  return (
    <Dialog open={true} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>New Expense</DialogTitle>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div>
          <Label htmlFor="e-date">Date</Label>
          <Input
            id="e-date"
            type="date"
            value={expenseDate}
            max={today}
            onChange={(ev) => setExpenseDate(ev.target.value)}
          />
          <p className="text-xs text-stone-500 mt-1">
            Pick a past date if you&rsquo;re recording an older expense.
          </p>
        </div>
        <div>
          <Label htmlFor="e-cat">Category</Label>
          <select
            id="e-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
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
          <Label htmlFor="e-amount">Amount (LKR)</Label>
          <Input
            id="e-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <Label htmlFor="e-desc">Description</Label>
          <textarea
            id="e-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional notes about this expense"
            className="flex w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>
        <div>
          <Label>Receipt (optional)</Label>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-lg bg-stone-100 overflow-hidden flex-shrink-0 border border-stone-200">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-stone-300">
                  <ImageIcon size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
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
              {uploading && (
                <p className="text-xs text-stone-500">Uploading...</p>
              )}
              {imagePath && !uploading && (
                <p className="text-xs text-emerald-700">
                  Receipt attached
                </p>
              )}
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
          {saving ? "Saving..." : "Add Expense"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
