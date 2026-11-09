import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function main() {
  console.log("🌱 Début du seed de test...");

  // Nettoyage préalable dans l'ordre des contraintes de clés étrangères
  await prisma.auditLog.deleteMany();
  await prisma.shiftSwap.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.masterTemplate.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = hashPassword("password123");

  // 1. Création des utilisateurs
  // Manager
  const manager = await prisma.user.create({
    data: {
      matricule: "MGR-001",
      email: "manager@resto.fr",
      passwordHash: defaultPasswordHash,
      firstName: "Alexandre",
      lastName: "Dupuis",
      role: "MANAGER",
      contractWeeklyHours: 39.0,
    },
  });

  // Salarié 1 (Thomas)
  const thomas = await prisma.user.create({
    data: {
      matricule: "SAL-001",
      email: "thomas@resto.fr",
      passwordHash: defaultPasswordHash,
      firstName: "Thomas",
      lastName: "Rousseau",
      role: "SALARIE",
      contractWeeklyHours: 35.0,
    },
  });

  // Salarié 2 (Sarah)
  const sarah = await prisma.user.create({
    data: {
      matricule: "SAL-002",
      email: "sarah@resto.fr",
      passwordHash: defaultPasswordHash,
      firstName: "Sarah",
      lastName: "Benali",
      role: "SALARIE",
      contractWeeklyHours: 35.0,
    },
  });

  console.log("👥 Utilisateurs créés : Manager, Thomas, Sarah");

  const now = new Date();

  // 2. Shifts pour la semaine en cours
  // A. Un shift pour Thomas aujourd'hui (pour tester le widget de pointage)
  const todayStart = new Date(now);
  todayStart.setHours(12, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(15, 0, 0, 0);

  const shiftTodayThomas = await prisma.shift.create({
    data: {
      userId: thomas.id,
      startTime: todayStart,
      endTime: todayEnd,
      status: "PUBLIE",
      isLateModification: false,
      planningVersion: 1,
    },
  });

  // B. Un shift pour Thomas dans 3 jours avec statut EN_ATTENTE_DEROGATION et isLateModification = true (pour tester le modal J < 8)
  const inThreeDaysStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  inThreeDaysStart.setHours(18, 0, 0, 0);
  const inThreeDaysEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  inThreeDaysEnd.setHours(23, 0, 0, 0);

  const shiftLateThomas = await prisma.shift.create({
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

  // C. Un shift pour Sarah le même jour qu'un shift de Thomas (pour tester le blocage anti-collision de swap)
  // Même jour (dans 3 jours), chevauchement partiel ou complet : 19h00 à 00h00
  const sarahCollisionStart = new Date(inThreeDaysStart);
  sarahCollisionStart.setHours(19, 0, 0, 0);
  const sarahCollisionEnd = new Date(inThreeDaysEnd);
  sarahCollisionEnd.setHours(0, 0, 0, 0);
  sarahCollisionEnd.setDate(sarahCollisionEnd.getDate() + 1);

  const shiftSarah = await prisma.shift.create({
    data: {
      userId: sarah.id,
      startTime: sarahCollisionStart,
      endTime: sarahCollisionEnd,
      status: "PUBLIE",
      isLateModification: false,
      planningVersion: 1,
    },
  });

  console.log("📅 Shifts de la semaine créés (Pointage, J<8 Dérogation, Anti-collision)");

  // 3. Création des créneaux de référence pour MasterTemplate (Planning Type Quinzaine)
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

  console.log("📋 Planning type (MasterTemplate quinzaine midi/soir) initialisé");

  // 4. Pointages passés complets avec écarts et arbitrages managers (pour tester l'export Paie CSV)
  // Semaine passée :
  const pastDay1 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  pastDay1.setHours(8, 0, 0, 0);
  const pastDay1End = new Date(pastDay1);
  pastDay1End.setHours(16, 0, 0, 0);

  // Shift passé 1 pour Thomas
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

  // Pointage 1 : Conforme (08:00 - 16:00)
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

  // Shift passé 2 pour Thomas (le lendemain)
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

  // Pointage 2 : Retard avec arbitrage managérial (arrivée 12:25, départ 20:00)
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
      arbitratedAt: new Date(pastDay2.getTime() + 10 * 60 * 60 * 1000),
    },
  });

  // Shift passé 3 pour Sarah (Maladie - neutralisé à 0h pour export paie)
  const pastDay3 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  pastDay3.setHours(9, 0, 0, 0);
  const pastDay3End = new Date(pastDay3);
  pastDay3End.setHours(17, 0, 0, 0);

  const pastShift3 = await prisma.shift.create({
    data: {
      userId: sarah.id,
      startTime: pastDay3,
      endTime: pastDay3End,
      status: "PUBLIE",
      planningVersion: 1,
    },
  });

  // Pointage 3 : Absence Maladie enregistrée par manager (0 heure)
  await prisma.timeEntry.create({
    data: {
      shiftId: pastShift3.id,
      userId: sarah.id,
      clockInTime: pastDay3,
      rawClockOutTime: pastDay3,
      roundedClockOutTime: pastDay3,
      qualification: "MALADIE",
      discrepancyReason: "Arrêt de travail reçu",
      arbitrationReason: "Maladie justifiée (arrêt 48h)",
      managerId: manager.id,
      arbitratedAt: pastDay3,
    },
  });

  console.log("⏱️ Pointages passés créés (Conforme, Retard arbitré, Maladie neutralisée 0.00)");
  console.log("✅ Seed terminé avec succès !");
}

main()
  .catch((e) => {
    console.error("❌ Erreur pendant le seed :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
