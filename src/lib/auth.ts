import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

function sessionSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return "planning-hcr-local-session-secret";
  }
  throw new Error("AUTH_SECRET ou SESSION_SECRET est requis pour les sessions.");
}

export function signSessionUserId(userId: string): string {
  const signature = createHmac("sha256", sessionSecret()).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

export function verifySessionUserId(value: string): string | null {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const userId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!/^[0-9a-f]{64}$/.test(signature)) return null;
  try {
    const expected = createHmac("sha256", sessionSecret()).update(userId).digest();
    return timingSafeEqual(Buffer.from(signature, "hex"), expected) ? userId : null;
  } catch {
    return null;
  }
}

/**
 * Helper d'authentification côté serveur
 * Extrait l'utilisateur courant depuis le cookie de session signé.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  let sessionValue: string | undefined;
  try {
    const cookieStore = await cookies();
    sessionValue = cookieStore.get("session_user_id")?.value;
  } catch {
    return null;
  }

  const userId = sessionValue ? verifySessionUserId(sessionValue) : null;
  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
    },
  });

  return user;
}

/**
 * Assure qu'un utilisateur est authentifié et possède l'un des rôles requis
 */
export async function requireUserWithRoles(
  allowedRoles: Role[]
): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED: Utilisateur non authentifié");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN: Privilèges insuffisants");
  }

  return user;
}
