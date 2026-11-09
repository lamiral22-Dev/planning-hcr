import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Nettoyage ordonné des données existantes
    await prisma.auditLog.deleteMany();
    await prisma.shiftSwap.deleteMany();
    await prisma.timeEntry.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.masterTemplate.deleteMany();
    await prisma.user.deleteMany();

    // 2. Création des comptes
    const manager = await prisma.user.create({
      data: {
        matricule: "MGR-001",
        email: "manager@resto.fr",
        passwordHash: "demo_hash_mgr",
        firstName: "Alexandre",
        lastName: "Dupuis",
        role: "MANAGER",
        contractWeeklyHours: 39.0,
      },
    });

    const thomas = await prisma.user.create({
      data: {
        matricule: "SAL-001",
        email: "thomas@resto.fr",
        passwordHash: "demo_hash_thomas",
        firstName: "Thomas",
        lastName: "Rousseau",
        role: "SALARIE",
        contractWeeklyHours: 35.0,
      },
    });

    const sarah = await prisma.user.create({
      data: {
        matricule: "SAL-002",
        email: "sarah@resto.fr",
        passwordHash: "demo_hash_sarah",
        firstName: "Sarah",
        lastName: "Benali",
        role: "SALARIE",
        contractWeeklyHours: 35.0,
      },
    });

    const now = new Date();

    // 3. Shifts pour Thomas :
    // A. Un shift aujourd'hui (pour tester le pointage tactile)
    const todayStart = new Date(now);
    todayStart.setHours(12, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(15, 0, 0, 0);

    await prisma.shift.create({
      data: {
        userId: thomas.id,
        startTime: todayStart,
        endTime: todayEnd,
        status: "PUBLIE",
        isLateModification: false,
        planningVersion: 1,
      },
    });

    // B. Un shift pour Thomas dans 3 jours avec statut EN_ATTENTE_DEROGATION et isLateModification = true (pour tester la dérogation tardive)
    const inThreeDaysStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    inThreeDaysStart.setHours(18, 0, 0, 0);
    const inThreeDaysEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    inThreeDaysEnd.setHours(23, 0, 0, 0);

    await prisma.shift.create({
      data: {
        userId: thomas.id,
        startTime: inThreeDaysStart,
        endTime: inThreeDaysEnd,
        status: "EN_ATTENTE_DEROGATION",
        isLateModification: true,
        derogationRequestedAt: now,
        planningVersion: 2,
      },
    });

    // 4. Shift pour Sarah le même jour qu'un shift de Thomas (pour tester la bourse et le blocage anti-collision)
    const sarahStart = new Date(inThreeDaysStart);
    sarahStart.setHours(19, 0, 0, 0);
    const sarahEnd = new Date(inThreeDaysEnd);
    sarahEnd.setHours(0, 0, 0, 0);
    sarahEnd.setDate(sarahEnd.getDate() + 1);

    await prisma.shift.create({
      data: {
        userId: sarah.id,
        startTime: sarahStart,
        endTime: sarahEnd,
        status: "PUBLIE",
        isLateModification: false,
        planningVersion: 1,
      },
    });

    // 5. Création d'une grille complète de Planning Type (MasterTemplate)
    // Semaine 1 et Semaine 2, du Lundi (1) au Dimanche (7)
    // Créneaux Midi (11:30 - 15:00) et Soir (18:30 - 23:00) pour la salle et la cuisine
    const masterTemplatesData = [
      // Semaine 1
      { weekNumber: 1, dayOfWeek: 1, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 1, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 2, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 2, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 3, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 3, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 4, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 4, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 5, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 5, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 6, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 6, startTime: "18:30", endTime: "23:30", name: "Service Soir Week-end", roleTarget: "SALARIE" as const },
      { weekNumber: 1, dayOfWeek: 7, startTime: "11:30", endTime: "15:30", name: "Brunch Dimanche", roleTarget: "SALARIE" as const },

      // Semaine 2
      { weekNumber: 2, dayOfWeek: 1, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 1, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 2, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 2, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 3, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 3, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 4, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 4, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 5, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 5, startTime: "18:30", endTime: "23:00", name: "Service Soir - Cuisine", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 6, startTime: "11:30", endTime: "15:00", name: "Service Midi - Salle", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 6, startTime: "18:30", endTime: "23:30", name: "Service Soir Week-end", roleTarget: "SALARIE" as const },
      { weekNumber: 2, dayOfWeek: 7, startTime: "11:30", endTime: "15:30", name: "Brunch Dimanche", roleTarget: "SALARIE" as const },
    ];

    for (const item of masterTemplatesData) {
      await prisma.masterTemplate.create({
        data: {
          ...item,
          isActive: true,
        },
      });
    }

    // 6. Deux pointages passés :
    // A. Un conforme (il y a 7 jours, 08:00 - 16:00)
    const pastDay1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    pastDay1.setHours(8, 0, 0, 0);
    const pastDay1End = new Date(pastDay1);
    pastDay1End.setHours(16, 0, 0, 0);

    const pastShift1 = await prisma.shift.create({
      data: {
        userId: thomas.id,
        startTime: pastDay1,
        endTime: pastDay1End,
        status: "PUBLIE",
        acknowledgedAt: pastDay1,
        planningVersion: 1,
      },
    });

    await prisma.timeEntry.create({
      data: {
        shiftId: pastShift1.id,
        userId: thomas.id,
        clockInTime: pastDay1,
        rawClockOutTime: pastDay1End,
        roundedClockOutTime: pastDay1End,
        qualification: "CONFORME",
      },
    });

    // B. Un retard avec motif (il y a 6 jours, 12:25 au lieu de 12:00 - 20:00)
    const pastDay2 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    pastDay2.setHours(12, 0, 0, 0);
    const pastDay2End = new Date(pastDay2);
    pastDay2End.setHours(20, 0, 0, 0);

    const pastShift2 = await prisma.shift.create({
      data: {
        userId: thomas.id,
        startTime: pastDay2,
        endTime: pastDay2End,
        status: "PUBLIE",
        acknowledgedAt: pastDay2,
        planningVersion: 1,
      },
    });

    const clockInRetard = new Date(pastDay2);
    clockInRetard.setMinutes(25);

    await prisma.timeEntry.create({
      data: {
        shiftId: pastShift2.id,
        userId: thomas.id,
        clockInTime: clockInRetard,
        rawClockOutTime: pastDay2End,
        roundedClockOutTime: pastDay2End,
        correctedClockInTime: clockInRetard,
        correctedClockOutTime: pastDay2End,
        qualification: "RETARD",
        discrepancyReason: "Panne de transport signalée",
        arbitrationReason: "Retard validé de 25 minutes",
        managerId: manager.id,
        arbitratedAt: new Date(pastDay2.getTime() + 9 * 60 * 60 * 1000),
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Initialisation - HCR</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f3f4f6; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 450px; }
            h1 { color: #059669; font-size: 1.5rem; margin-bottom: 1rem; }
            p { color: #4b5563; font-size: 0.95rem; line-height: 1.5; }
            a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; }
            a:hover { background: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>✅ Données de démonstration chargées avec succès</h1>
            <p>Les comptes Manager, Thomas et Sarah ont été initialisés avec leurs créneaux et pointages de test.</p>
            <a href="/login">Retourner à la page de connexion</a>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.stack || err.message : String(err);
    console.error("❌ Erreur lors de l'initialisation de la base (/api/dev/seed) :", errorDetails);

    const isDbUnreachable =
      errorDetails.includes("Can't reach database") ||
      errorDetails.includes("P1001") ||
      errorDetails.includes("Environment variable not found: DATABASE_URL") ||
      errorDetails.includes("does not exist in the current database");

    const userMessage = isDbUnreachable
      ? "Impossible de contacter la base de données ou tables manquantes. Assurez-vous que DATABASE_URL est configurée et que le schéma Prisma a été déployé."
      : "Une erreur est survenue lors du chargement des données de test.";

    const errorHtml = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Erreur d'initialisation - HCR</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #fef2f2; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 500px; border: 1px solid #fecaca; }
            h1 { color: #dc2626; font-size: 1.4rem; margin-bottom: 1rem; }
            p { color: #4b5563; font-size: 0.95rem; line-height: 1.5; }
            pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.8rem; text-align: left; overflow-x: auto; color: #b91c1c; }
            a { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #dc2626; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; }
            a:hover { background: #b91c1c; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>❌ Erreur d'initialisation de la base</h1>
            <p>${userMessage}</p>
            <pre>${err instanceof Error ? err.message : String(err)}</pre>
            <a href="/api/dev/seed">Réessayer l'initialisation</a>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }
}
