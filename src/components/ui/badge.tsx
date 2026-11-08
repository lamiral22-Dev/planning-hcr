import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "secondary" | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide",
        variant === "default" && "bg-blue-100 text-blue-800 border border-blue-200",
        variant === "success" && "bg-emerald-100 text-emerald-800 border border-emerald-200",
        variant === "warning" && "bg-amber-100 text-amber-800 border border-amber-200",
        variant === "danger" && "bg-rose-100 text-rose-800 border border-rose-200",
        variant === "secondary" && "bg-gray-100 text-gray-800 border border-gray-200",
        variant === "outline" && "border border-gray-300 text-gray-700 bg-white",
        className
      )}
      {...props}
    />
  );
}
