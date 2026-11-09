import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserActiveStatus,
} from "../user-actions";
import { prisma } from "@/lib/prisma";
import * as auth from "@/lib/auth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe("user-actions", () => {
  const mockManager = {
    id: "mgr-1",
    email: "manager@resto.fr",
    role: "MANAGER" as const,
    firstName: "Alex",
    lastName: "Dupuis",
  };

  const mockEmployee = {
    id: "sal-1",
    matricule: "SAL-001",
    email: "thomas@resto.fr",
    passwordHash: "hashed_pwd",
    firstName: "Thomas",
    lastName: "Rousseau",
    role: "SALARIE" as const,
    contractWeeklyHours: 35.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "requireUserWithRoles").mockResolvedValue(mockManager);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: unknown) => {
      if (typeof cb === "function") {
        return cb(prisma);
      }
      return cb;
    });
  });

  describe("getUsers", () => {
    it("retourne la liste des utilisateurs pour un manager", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([mockEmployee]);

      const result = await getUsers();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].matricule).toBe("SAL-001");
      }
    });

    it("échoue si l'utilisateur n'a pas les droits requis", async () => {
      vi.spyOn(auth, "requireUserWithRoles").mockRejectedValue(
        new Error("FORBIDDEN: Privilèges insuffisants")
      );

      const result = await getUsers();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("FORBIDDEN");
      }
    });
  });

  describe("createUser", () => {
    it("crée un collaborateur et enregistre un AuditLog USER_CREATED", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockEmployee);

      const result = await createUser({
        matricule: "SAL-001",
        firstName: "Thomas",
        lastName: "Rousseau",
        email: "thomas@resto.fr",
        role: "SALARIE",
        contractWeeklyHours: 35.0,
        isActive: true,
      });

      expect(result.success).toBe(true);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "USER_CREATED",
            tableName: "User",
            userId: mockManager.id,
          }),
        })
      );
    });

    it("bloque la création si le matricule existe déjà", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockEmployee);

      const result = await createUser({
        matricule: "SAL-001",
        firstName: "Thomas",
        lastName: "Rousseau",
        email: "different@resto.fr",
        role: "SALARIE",
        contractWeeklyHours: 35.0,
        isActive: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("MATRICULE_ALREADY_EXISTS");
      }
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("bloque la création si l'email existe déjà", async () => {
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(null) // matricule check
        .mockResolvedValueOnce(mockEmployee); // email check

      const result = await createUser({
        matricule: "SAL-002",
        firstName: "Thomas",
        lastName: "Rousseau",
        email: "thomas@resto.fr",
        role: "SALARIE",
        contractWeeklyHours: 35.0,
        isActive: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("EMAIL_ALREADY_EXISTS");
      }
    });
  });

  describe("updateUser", () => {
    it("met à jour les informations et génère un AuditLog USER_UPDATED avec payloadOld/New", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockEmployee);
      const updatedUser = { ...mockEmployee, firstName: "Thomas Updated" };
      vi.mocked(prisma.user.update).mockResolvedValue(updatedUser);

      const result = await updateUser({
        id: "sal-1",
        firstName: "Thomas Updated",
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "USER_UPDATED",
            tableName: "User",
            payloadOld: expect.objectContaining({ firstName: "Thomas" }),
            payloadNew: expect.objectContaining({ firstName: "Thomas Updated" }),
          }),
        })
      );
    });
  });

  describe("toggleUserActiveStatus", () => {
    it("désactive un profil sans suppression physique et trace USER_DEACTIVATED", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockEmployee);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...mockEmployee, isActive: false });

      const result = await toggleUserActiveStatus({
        userId: "sal-1",
        isActive: false,
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sal-1" },
          data: { isActive: false },
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "USER_DEACTIVATED",
            payloadOld: { isActive: true },
            payloadNew: { isActive: false },
          }),
        })
      );
    });

    it("bloque la désactivation si le manager tente de se désactiver lui-même (garde-fou)", async () => {
      const result = await toggleUserActiveStatus({
        userId: mockManager.id, // ID du manager connecté
        isActive: false,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("CANNOT_DEACTIVATE_SELF");
      }
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
