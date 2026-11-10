import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@prisma/client";
import { loginWithCredentials } from "../auth-actions";
import { prisma } from "@/lib/prisma";
import * as passwordModule from "@/lib/password";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe("loginWithCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne { success: false } si l'email ou le format est invalide", async () => {
    const fd = new FormData();
    fd.append("email", "email-invalide");
    fd.append("password", "secret");

    const result = await loginWithCredentials(fd);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Identifiants incorrects ou compte inactif.");
  });

  it("retourne { success: false } si l'utilisateur n'existe pas en base", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    const fd = new FormData();
    fd.append("email", "inexistant@resto.fr");
    fd.append("password", "secret");

    const result = await loginWithCredentials(fd);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Identifiants incorrects ou compte inactif.");
  });

  it("retourne { success: false } si l'utilisateur est inactif", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "u-1",
      email: "inactif@resto.fr",
      isActive: false,
      passwordHash: "hash123",
      role: "SALARIE",
    } as unknown as User);

    const fd = new FormData();
    fd.append("email", "inactif@resto.fr");
    fd.append("password", "secret");

    const result = await loginWithCredentials(fd);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Identifiants incorrects ou compte inactif.");
  });

  it("retourne { success: false } si passwordHash est nul ou vide", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "u-1",
      email: "nohash@resto.fr",
      isActive: true,
      passwordHash: "",
      role: "SALARIE",
    } as unknown as User);

    const fd = new FormData();
    fd.append("email", "nohash@resto.fr");
    fd.append("password", "secret");

    const result = await loginWithCredentials(fd);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Identifiants incorrects ou compte inactif.");
  });

  it("retourne { success: false } si le mot de passe ne correspond pas", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "u-1",
      email: "valid@resto.fr",
      isActive: true,
      passwordHash: "validhash",
      role: "SALARIE",
    } as unknown as User);

    vi.spyOn(passwordModule, "verifyPassword").mockReturnValueOnce(false);

    const fd = new FormData();
    fd.append("email", "valid@resto.fr");
    fd.append("password", "badpass");

    const result = await loginWithCredentials(fd);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Identifiants incorrects ou compte inactif.");
  });

  it("retourne { success: true, redirectTo: ... } si les identifiants sont valides", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "u-1",
      email: "valid@resto.fr",
      isActive: true,
      passwordHash: "validhash",
      role: "MANAGER",
    } as unknown as User);

    vi.spyOn(passwordModule, "verifyPassword").mockReturnValueOnce(true);

    const fd = new FormData();
    fd.append("email", "valid@resto.fr");
    fd.append("password", "correctpass");

    const result = await loginWithCredentials(fd);
    expect(result.success).toBe(true);
    expect(result.redirectTo).toBe("/manager/planning");
  });
});
