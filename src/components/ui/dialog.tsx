import React from "react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            {description && (
              <p className="text-sm text-gray-500 mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="text-gray-400 hover:text-gray-600 rounded-full p-1"
          >
            ✕
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
}
