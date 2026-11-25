import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, signSessionUserId, verifySessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const session = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => session.value ? { value: session.value } : undefined,
  })),
}));

describe("session signatures", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret");
    session.value = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs and verifies a session user id", () => {
    const signedValue = signSessionUserId("user-123");

    expect(signedValue).toMatch(/^user-123\.[0-9a-f]{64}$/);
    expect(verifySessionUserId(signedValue)).toBe("user-123");
  });

  it("rejects altered and unsigned session values", () => {
    const signedValue = signSessionUserId("user-123");

    expect(verifySessionUserId(`${signedValue}x`)).toBeNull();
    expect(verifySessionUserId("user-123")).toBeNull();
  });

  it("does not look up a user when the session cookie is falsified", async () => {
    session.value = `${signSessionUserId("user-123")}x`;

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("loads the user only after verifying the cookie signature", async () => {
    session.value = signSessionUserId("user-123");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-123",
      email: "user@example.com",
      role: "SALARIE",
      firstName: "User",
      lastName: "Example",
    } as never);

    await expect(getCurrentUser()).resolves.toMatchObject({ id: "user-123" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user-123" },
    }));
  });
});
