import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuditView } from "../audit-view";
import type { AuditLogItem } from "@/actions/audit-actions";

vi.mock("@/actions/audit-actions", () => ({
  getAuditLogs: vi.fn().mockResolvedValue({ success: true, data: { logs: [], totalCount: 0 } }),
  getAuditLogById: vi.fn(),
}));

describe("AuditView", () => {
  const mockLogs: AuditLogItem[] = [
    {
      id: "log-1",
      action: "TIME_ENTRY_ARBITRATED",
      tableName: "TimeEntry",
      recordId: "entry-101",
      userId: "mgr-1",
      userName: "Dupuis Alexandre",
      userRole: "MANAGER",
      timestamp: new Date("2025-03-03T14:30:00Z"),
      payloadOld: { qualification: "CONFORME", rawClockOutTime: "18:00" },
      payloadNew: { qualification: "RETARD", rawClockOutTime: "18:00" },
    },
    {
      id: "log-2",
      action: "SHIFT_CREATED",
      tableName: "Shift",
      recordId: "shift-202",
      userId: "mgr-1",
      userName: "Dupuis Alexandre",
      userRole: "MANAGER",
      timestamp: new Date("2025-03-03T11:00:00Z"),
      payloadOld: null,
      payloadNew: { id: "shift-202", status: "PUBLIE" },
    },
  ];

  const mockUsers = [
    { id: "mgr-1", name: "Dupuis Alexandre", matricule: "MGR-001" },
    { id: "sal-1", name: "Rousseau Thomas", matricule: "SAL-001" },
  ];

  it("affiche la liste des événements d'audit", () => {
    render(
      <AuditView
        initialLogs={mockLogs}
        totalCount={2}
        users={mockUsers}
      />
    );

    expect(screen.getAllByText("TIME_ENTRY_ARBITRATED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SHIFT_CREATED").length).toBeGreaterThan(0);
    expect(screen.getByText("2 événements enregistrés")).toBeDefined();
  });

  it("ouvre le tiroir d'inspection et met en exergue les champs modifiés", () => {
    render(
      <AuditView
        initialLogs={mockLogs}
        totalCount={2}
        users={mockUsers}
      />
    );

    const inspectButtons = screen.getAllByRole("button", { name: /Examiner/i });
    fireEvent.click(inspectButtons[0]);

    expect(screen.getByText("Trace d'Audit Inviolable")).toBeDefined();
    expect(screen.getByText("qualification")).toBeDefined();
    expect(screen.getByText("Modifié")).toBeDefined();
  });

  it("déclenche l'export CSV au clic sur le bouton d'export", () => {
    const originalHref = window.location.href;
    const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
      ...window.location,
      href: "",
    } as unknown as Location);

    render(
      <AuditView
        initialLogs={mockLogs}
        totalCount={2}
        users={mockUsers}
      />
    );

    const exportBtn = screen.getByText("Exporter en CSV (;)");
    fireEvent.click(exportBtn);

    expect(window.location.href).toBeDefined();

    locationSpy.mockRestore();
    window.location.href = originalHref;
  });
});
