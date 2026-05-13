"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  CUSTOM_INCOME_CATEGORIES,
  type CustomIncomeCategory,
} from "@/types/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatLKR } from "@/lib/format";

interface CustomIncomeDialogProps {
  open: boolean;
  cashierId: string;
  onClose: () => void;
}

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Combine the user-picked YYYY-MM-DD with a sensible time:
// today => use the current local time so the entry sorts correctly with
// other live activity; back-dated => land on noon local so it falls on the
// expected day in any timezone-aware bucketing downstream.
function combineDateWithTime(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = todayLocalISO();
  const isToday = dateStr === today;
  const now = new Date();
  const hh = isToday ? now.getHours() : 12;
  const mm = isToday ? now.getMinutes() : 0;
  const ss = isToday ? now.getSeconds() : 0;
  const ms = isToday ? now.getMilliseconds() : 0;
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, hh, mm, ss, ms);
  return local.toISOString();
}

export function CustomIncomeDialog({
  open,
  cashierId,
  onClose,
}: CustomIncomeDialogProps) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { show } = useToast();
  const today = useMemo(() => todayLocalISO(), []);

  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<CustomIncomeCategory>("Parking");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setDate(todayLocalISO());
    setCategory("Parking");
    setAmount("");
    setDescription("");
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function handleSave() {
    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      show("Enter a valid amount", "error");
      return;
    }
    if (!date) {
      show("Select a date", "error");
      return;
    }
    if (date > today) {
      show("Date cannot be in the future", "error");
      return;
    }

    setSaving(true);

    const insertPayload = {
      total_amount: amountNum,
      items: [],
      payment_method: "Custom",
      customer_phone: null,
      cashier_id: cashierId,
      income_type: "custom",
      income_category: category,
      description: description.trim() || null,
      created_at: combineDateWithTime(date),
    };

    const { error } = await supabase
      .from("sales")
      .insert(insertPayload as never);

    setSaving(false);

    if (error) {
      show(error.message ?? "Could not save custom income", "error");
      return;
    }

    show(`${category} income recorded · ${formatLKR(amountNum)}`, "success");
    queryClient.invalidateQueries({ queryKey: ["admin", "period-sales"] });
    queryClient.invalidateQueries({ queryKey: ["bills", "list"] });
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center">
            <Wallet size={18} />
          </div>
          <DialogTitle>Custom Income</DialogTitle>
        </div>
        <p className="text-sm text-stone-500 mt-1">
          Record non-product income such as parking, tips, or revenue from a
          past day.
        </p>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div>
          <Label htmlFor="ci-date">Date</Label>
          <Input
            id="ci-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="text-xs text-stone-500 mt-1">
            Defaults to today. Pick a past date for previous revenue entries.
          </p>
        </div>
        <div>
          <Label htmlFor="ci-cat">Category</Label>
          <select
            id="ci-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as CustomIncomeCategory)}
            className="flex h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {CUSTOM_INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ci-amount">Amount (LKR)</Label>
          <Input
            id="ci-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="ci-desc">Description</Label>
          <textarea
            id="ci-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional notes (e.g. car plate number, source of revenue)"
            className="flex w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="animate-spin" size={16} />}
          {saving ? "Saving..." : "Add Income"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
