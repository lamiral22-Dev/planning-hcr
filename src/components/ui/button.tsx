import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "danger" | "success" | "secondary";
  size?: "sm" | "default" | "lg" | "xl";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
          // Variants
          variant === "default" && "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
          variant === "outline" && "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100",
          variant === "danger" && "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
          variant === "success" && "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800",
          variant === "secondary" && "bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300",
          // Sizes
          size === "sm" && "text-xs px-3 py-1.5 h-8",
          size === "default" && "text-sm px-4 py-2 h-10",
          size === "lg" && "text-base px-5 py-3 h-12",
          size === "xl" && "text-lg px-6 py-4 h-16 w-full font-bold shadow-md",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
