import React from "react";
import { cn } from "@/lib/utils";

export interface AlertBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: React.ReactNode;
}

export function AlertBanner({
  className,
  variant = "info",
  title,
  children,
  ...props
}: AlertBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl p-4 border flex flex-col gap-1 shadow-xs",
        variant === "info" && "bg-blue-50 border-blue-200 text-blue-900",
        variant === "warning" && "bg-amber-50 border-amber-300 text-amber-900",
        variant === "danger" && "bg-rose-50 border-rose-300 text-rose-900",
        variant === "success" && "bg-emerald-50 border-emerald-200 text-emerald-900",
        className
      )}
      {...props}
    >
      {title && <h4 className="font-semibold text-sm">{title}</h4>}
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
