import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAuditLogs,
  getAuditLogById,
  generateAuditCsv,
} from "../audit-actions";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("audit-actions", () => {
  const mockManager = {
    id: "mgr-1",
    email: "manager@resto.fr",
    role: "MANAGER" as const,
    firstName: "Alex",
    lastName: "Dupuis",
  };

  const sampleLog = {
    id: "log-1",
    action: "TIME_ENTRY_ARBITRATED",
    tableName: "TimeEntry",
    recordId: "entry-1",
    userId: "mgr-1",
    payloadOld: { qualification: "CONFORME" },
    payloadNew: { qualification: "RETARD" },
    timestamp: new Date("2025-03-03T14:30:00Z"),
    user: {
      id: "mgr-1",
      firstName: "Alex",
      lastName: "Dupuis",
      role: "MANAGER" as const,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue(mockManager);
    vi.mocked(prisma.$transaction).mockImplementation(async (promises: unknown) => {
      if (Array.isArray(promises)) {
        return Promise.all(promises);
      }
      return promises;
    });
  });

  describe("getAuditLogs", () => {
    it("récupère les logs avec comptage et formatage", async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([sampleLog]);

      const result = await getAuditLogs({ action: "TIME_ENTRY_ARBITRATED" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalCount).toBe(1);
        expect(result.data.logs[0].action).toBe("TIME_ENTRY_ARBITRATED");
        expect(result.data.logs[0].userName).toBe("Dupuis Alex");
      }
    });

    it("filtre correctement par userId", async () => {
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      const result = await getAuditLogs({ userId: "user-123" });
      expect(result.success).toBe(true);
      expect(prisma.auditLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ userId: "user-123" }, { recordId: "user-123" }],
          }),
        })
      );
    });
  });

  describe("getAuditLogById", () => {
    it("retourne le détail d'un log existant", async () => {
      vi.mocked(prisma.auditLog.findUnique).mockResolvedValue(sampleLog);

      const result = await getAuditLogById("log-1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("log-1");
        expect(result.data.userName).toBe("Dupuis Alex");
      }
    });

    it("retourne NOT_FOUND si le log n'existe pas", async () => {
      vi.mocked(prisma.auditLog.findUnique).mockResolvedValue(null);

      const result = await getAuditLogById("log-999");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("generateAuditCsv", () => {
    it("génère un export CSV conforme avec BOM UTF-8 et séparateurs point-virgule", () => {
      const logs = [
        {
          id: "log-1",
          action: "TIME_ENTRY_ARBITRATED",
          tableName: "TimeEntry",
          recordId: "entry-1",
          userId: "mgr-1",
          userName: "Dupuis Alex",
          userRole: "MANAGER",
          timestamp: new Date("2025-03-03T14:30:00Z"),
          payloadOld: { qualification: "CONFORME" },
          payloadNew: { qualification: "RETARD" },
        },
      ];

      const csv = generateAuditCsv(logs, "Europe/Paris");
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain('"Date_Heure";"Action";"Table";"Record_Id";"Auteur_Nom";"Auteur_Role";"Payload_Old";"Payload_New"');
      expect(csv).toContain('"TIME_ENTRY_ARBITRATED"');
      expect(csv).toContain('"TimeEntry"');
      expect(csv).toContain('"Dupuis Alex"');
    });
  });
});
