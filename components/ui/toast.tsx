"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const show = React.useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, kind, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border min-w-[260px] animate-fade-in bg-white",
              t.kind === "success" && "border-emerald-200",
              t.kind === "error" && "border-red-200",
              t.kind === "info" && "border-stone-200",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="text-emerald-600" size={20} />}
            {t.kind === "error" && <AlertCircle className="text-red-600" size={20} />}
            {t.kind === "info" && <Info className="text-stone-600" size={20} />}
            <span className="text-sm text-stone-800">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
