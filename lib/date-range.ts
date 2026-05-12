// Pure helpers for the admin dashboard date range filter. Kept out of the
// "use client" component file so the server component can import them too.

export interface DateRange {
  from: string; // YYYY-MM-DD (local)
  to: string;   // YYYY-MM-DD (local)
}

export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultLast30Days(): DateRange {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 29);
  return { from: toLocalISODate(from), to: toLocalISODate(today) };
}

// Convert a YYYY-MM-DD local date string to an ISO timestamp at the start
// or end of that local day. Used for Supabase .gte / .lte filters.
export function startOfDayISO(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).toISOString();
}

export function endOfDayISO(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).toISOString();
}
