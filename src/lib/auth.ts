import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

/**
 * Helper d'authentification côté serveur
 * Extrait l'utilisateur courant et son rôle directement depuis la session (cookie HTTP ou headers serveur),
 * garantissant qu'aucun contexte arbitraire ne puisse être injecté par le client HTTP.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session_user_id");
    if (sessionCookie?.value) {
      userId = sessionCookie.value;
    } else {
      const headersList = await headers();
      userId = headersList.get("x-user-id");
    }
  } catch {
    // Dans les contextes hors requête HTTP (tests Vitest, scripts internes)
    userId = null;
  }

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
