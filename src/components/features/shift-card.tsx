import React from "react";

export interface ShiftCardProps {
  employeeName: string;
  startTime: string;
  endTime: string;
}

export function ShiftCard({ employeeName, startTime, endTime }: ShiftCardProps) {
  return (
    <div className="rounded border border-gray-200 p-4 shadow-sm">
      <p className="font-semibold">{employeeName}</p>
      <p className="text-sm text-gray-500">
        {startTime} - {endTime}
      </p>
    </div>
  );
}
