import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-stone-100 text-stone-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-800",
  outline: "border border-stone-300 text-stone-700",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
