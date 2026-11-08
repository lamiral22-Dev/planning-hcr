"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function quickLoginByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error(`Utilisateur ${email} introuvable. Veuillez initialiser la base via /api/dev/seed.`);
  }

  const cookieStore = await cookies();
  cookieStore.set("session_user_id", user.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (user.role === "MANAGER" || user.role === "SUPER_ADMIN") {
    redirect("/api/manager/export-paie");
  } else {
    redirect("/salarie/planning");
  }
}
