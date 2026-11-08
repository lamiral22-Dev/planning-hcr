import React from "react";
import { cn } from "@/lib/utils";

export interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "flex p-1 bg-gray-100 rounded-xl space-x-1 select-none",
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2",
              isActive
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-bold",
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-200 text-gray-600"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
