import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET as seedGet } from "../seed/route";
import { quickLoginByEmail } from "@/actions/auth-actions";

describe("Protection des endpoints & fonctions Démo", () => {
  const originalEnv = process.env.ENABLE_DEMO_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.ENABLE_DEMO_MODE = originalEnv;
  });

  describe("GET /api/dev/seed", () => {
    it("retourne 403 Forbidden si ENABLE_DEMO_MODE n'est pas activé", async () => {
      delete process.env.ENABLE_DEMO_MODE;

      const response = await seedGet();
      expect(response.status).toBe(403);

      const body = await response.json();
      expect(body.error).toContain("Forbidden: Demo mode is disabled");
    });

    it("retourne 403 Forbidden si ENABLE_DEMO_MODE est explicitement 'false'", async () => {
      process.env.ENABLE_DEMO_MODE = "false";

      const response = await seedGet();
      expect(response.status).toBe(403);
    });
  });

  describe("quickLoginByEmail", () => {
    it("rejette immédiatement si ENABLE_DEMO_MODE n'est pas 'true'", async () => {
      process.env.ENABLE_DEMO_MODE = "false";

      await expect(quickLoginByEmail("thomas@resto.fr")).rejects.toThrow(
        "FORBIDDEN: La connexion rapide en 1 clic est désactivée"
      );
    });
  });
});
