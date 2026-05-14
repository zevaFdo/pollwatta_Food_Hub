"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ShoppingBag, Wallet, Package } from "lucide-react";
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/db";

const DROPDOWN_LIMIT = 10;

export function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Initial fetch: latest 10 notifications + total unread count.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [listRes, countRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(DROPDOWN_LIMIT),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("is_read", false),
      ]);

      if (cancelled) return;

      if (listRes.data) setItems(listRes.data as Notification[]);
      if (typeof countRes.count === "number") setUnreadCount(countRes.count);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Realtime: react to inserts (new notification) and updates (mark-as-read).
  useEffect(() => {
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: RealtimePostgresInsertPayload<Notification>) => {
          const incoming = payload.new;
          setItems((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, DROPDOWN_LIMIT);
          });
          if (!incoming.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload: RealtimePostgresUpdatePayload<Notification>) => {
          const updated = payload.new;
          // The notifications table does not use REPLICA IDENTITY FULL, so
          // payload.old only contains the primary key. Derive the previous
          // is_read value from the locally cached row instead.
          setItems((prev) => {
            const prior = prev.find((n) => n.id === updated.id);
            if (prior && prior.is_read !== updated.is_read) {
              setUnreadCount((c) =>
                updated.is_read ? Math.max(0, c - 1) : c + 1,
              );
            }
            return prev.map((n) =>
              n.id === updated.id ? { ...n, ...updated } : n,
            );
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0 || marking) return;
    setMarking(true);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
    setMarking(false);
    if (error) return;

    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [marking, supabase, unreadCount]);

  const displayCount = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg",
          "text-stone-700 hover:bg-stone-100 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        )}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1",
              "rounded-full bg-red-600 text-white text-[10px] font-bold leading-[18px]",
              "ring-2 ring-white text-center",
            )}
          >
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 mt-2 w-80 sm:w-96 z-50",
            "rounded-xl border border-stone-200 bg-white shadow-lg",
            "overflow-hidden",
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <div className="font-semibold text-stone-900 text-sm">
              Notifications
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0 || marking}
              className={cn(
                "text-xs font-medium",
                unreadCount === 0 || marking
                  ? "text-stone-400 cursor-not-allowed"
                  : "text-brand-700 hover:text-brand-800",
              )}
            >
              Mark all as read
            </button>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-stone-500">
              No notifications yet.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-stone-100">
              {items.map((n) => (
                <NotificationRow key={n.id} notification={n} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const tone = TYPE_TONES[notification.type];
  const Icon = tone.icon;

  return (
    <li
      className={cn(
        "flex gap-3 px-4 py-3",
        !notification.is_read && "bg-brand-50/60",
      )}
    >
      <div
        className={cn(
          "mt-0.5 w-8 h-8 rounded-full grid place-items-center flex-shrink-0",
          tone.iconBg,
          tone.iconFg,
        )}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-stone-900 truncate">
            {notification.title}
          </span>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-stone-600 mt-0.5 break-words">
          {notification.message}
        </p>
        <p className="text-[11px] text-stone-400 mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </li>
  );
}

const TYPE_TONES: Record<
  NotificationType,
  {
    icon: typeof ShoppingBag;
    iconBg: string;
    iconFg: string;
  }
> = {
  sale: {
    icon: ShoppingBag,
    iconBg: "bg-emerald-100",
    iconFg: "text-emerald-700",
  },
  expense: {
    icon: Wallet,
    iconBg: "bg-red-100",
    iconFg: "text-red-700",
  },
  stock: {
    icon: Package,
    iconBg: "bg-amber-100",
    iconFg: "text-amber-700",
  },
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(iso).toLocaleDateString("en-LK", {
    month: "short",
    day: "numeric",
  });
}
