"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { verifyPassword } from "@/lib/password";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function quickLoginByEmail(email: string) {
  if (!isDemoModeEnabled()) {
    throw new Error("FORBIDDEN: La connexion rapide en 1 clic est désactivée en environnement de production.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    throw new Error(`Utilisateur ${email} introuvable ou inactif.`);
  }

  const cookieStore = await cookies();
  cookieStore.set("session_user_id", user.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (user.role === "MANAGER" || user.role === "SUPER_ADMIN") {
    redirect("/manager/planning");
  } else {
    redirect("/salarie/planning");
  }
}

export async function loginWithCredentials(formData: FormData) {
  const emailRaw = formData.get("email");
  const passwordRaw = formData.get("password");

  const validation = credentialsSchema.safeParse({
    email: typeof emailRaw === "string" ? emailRaw.trim() : "",
    password: typeof passwordRaw === "string" ? passwordRaw : "",
  });

  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message || "Identifiants invalides");
  }

  const { email, password } = validation.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    throw new Error("Identifiants incorrects ou compte inactif");
  }

  const isMatch = verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    throw new Error("Identifiants incorrects ou compte inactif");
  }

  const cookieStore = await cookies();
  cookieStore.set("session_user_id", user.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (user.role === "MANAGER" || user.role === "SUPER_ADMIN") {
    redirect("/manager/planning");
  } else {
    redirect("/salarie/planning");
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("session_user_id");
  redirect("/login");
}
