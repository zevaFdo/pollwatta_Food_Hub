"use client";

import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  defaultLast30Days,
  toLocalISODate,
  type DateRange,
} from "@/lib/date-range";

export type { DateRange } from "@/lib/date-range";

type PresetId = "today" | "7d" | "30d" | "month" | "custom";

interface Preset {
  id: PresetId;
  label: string;
  compute: (today: Date) => DateRange;
}

const PRESETS: Preset[] = [
  {
    id: "today",
    label: "Today",
    compute: (today) => ({
      from: toLocalISODate(today),
      to: toLocalISODate(today),
    }),
  },
  {
    id: "7d",
    label: "Last 7 days",
    compute: (today) => {
      const from = new Date(today);
      from.setDate(today.getDate() - 6);
      return { from: toLocalISODate(from), to: toLocalISODate(today) };
    },
  },
  {
    id: "30d",
    label: "Last 30 days",
    compute: () => defaultLast30Days(),
  },
  {
    id: "month",
    label: "This month",
    compute: (today) => {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toLocalISODate(from), to: toLocalISODate(today) };
    },
  },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

function detectPreset(range: DateRange): PresetId {
  const today = new Date();
  for (const p of PRESETS) {
    const c = p.compute(today);
    if (c.from === range.from && c.to === range.to) return p.id;
  }
  return "custom";
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const active = detectPreset(value);

  function applyPreset(p: Preset) {
    onChange(p.compute(new Date()));
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 p-3 rounded-xl border border-stone-200 bg-white",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-stone-500 text-sm pr-1">
        <Calendar size={16} />
        <span className="hidden sm:inline">Range</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={active === p.id ? "primary" : "outline"}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <input
          type="date"
          value={value.from}
          max={value.to}
          onChange={(e) =>
            onChange({ from: e.target.value || value.from, to: value.to })
          }
          className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="From date"
        />
        <span className="text-stone-400 text-sm">to</span>
        <input
          type="date"
          value={value.to}
          min={value.from}
          onChange={(e) =>
            onChange({ from: value.from, to: e.target.value || value.to })
          }
          className="h-9 rounded-lg border border-stone-300 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="To date"
        />
      </div>
    </div>
  );
}
