"use server";

import { prisma } from "@/lib/prisma";
import { requireUserWithRoles, getCurrentUser } from "@/lib/auth";
import { RestaurantSlotSchema, AssignRestaurantSlotSchema } from "@/schemas/restaurant-planning";
import { fromAppTime, shiftDatesForDay, toAppTime } from "@/lib/time-utils";
import {
  checkNoticePeriod,
  validateConsecutiveShiftsDailyRest,
  validateMaxConsecutiveWorkedDays,
  validateWeeklyHours,
  validateWeeklyRestDays,
} from "@/lib/hcr-rules";
import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";
import { Prisma, type RestaurantSlot, type Shift, type ShiftReplacementRequest } from "@prisma/client";

export type RestaurantActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function saveRestaurantSlot(input: unknown): Promise<RestaurantActionResult<RestaurantSlot>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const slot = RestaurantSlotSchema.parse(input);
    const result = await prisma.$transaction(async (tx) => {
      const current = slot.id
        ? await tx.restaurantSlot.findUnique({ where: { id: slot.id } })
        : null;
      if (slot.id && !current) throw new Error("Créneau introuvable.");
      const updated = current
        ? await tx.restaurantSlot.update({
            where: { id: current.id },
            data: { name: slot.name, startTime: slot.startTime, endTime: slot.endTime, closedDays: slot.closedDays, isActive: slot.isActive },
          })
        : await tx.restaurantSlot.create({
            data: { name: slot.name, startTime: slot.startTime, endTime: slot.endTime, closedDays: slot.closedDays, isActive: slot.isActive },
          });
      await tx.auditLog.create({
        data: {
          action: current ? "RESTAURANT_SLOT_UPDATED" : "RESTAURANT_SLOT_CREATED",
          tableName: "RestaurantSlot",
          recordId: updated.id,
          userId: actor.id,
          payloadOld: current ? json(current) : Prisma.JsonNull,
          payloadNew: json(updated),
        },
      });
      return updated;
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}

export async function toggleRestaurantClosure(
  slotId: string,
  date: string,
): Promise<RestaurantActionResult<{ closed: boolean }>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const parsedDate = new Date(`${date}T12:00:00`);
    if (!slotId || !AssignRestaurantSlotSchema.shape.date.safeParse(date).success || Number.isNaN(parsedDate.getTime())) {
      return { success: false, error: "Date ou créneau invalide." };
    }
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`restaurant-slot:${slotId}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${slotId}:${date}`}, 0))`;
      await tx.$queryRaw`SELECT id FROM "RestaurantSlot" WHERE id = ${slotId} FOR UPDATE`;
      const closureDate = new Date(Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()));
      const slot = await tx.restaurantSlot.findUnique({ where: { id: slotId } });
      if (!slot) return { success: false as const, error: "Créneau introuvable." };
      const current = await tx.restaurantClosure.findUnique({
        where: { slotId_date: { slotId, date: closureDate } },
      });
      const dayNumber = ((parsedDate.getDay() + 6) % 7) + 1;
      const closed = current ? !current.isClosed : !slot.closedDays.includes(dayNumber);
      const changed = current
        ? await tx.restaurantClosure.update({ where: { id: current.id }, data: { isClosed: closed } })
        : await tx.restaurantClosure.create({ data: { slotId, date: closureDate, isClosed: closed } });
      await tx.auditLog.create({
        data: {
          action: closed ? "RESTAURANT_SLOT_CLOSED" : "RESTAURANT_SLOT_REOPENED",
          tableName: "RestaurantClosure",
          recordId: current?.id ?? changed.id,
          userId: actor.id,
          payloadOld: current ? json(current) : Prisma.JsonNull,
          payloadNew: json(changed),
        },
      });
      return { success: true as const, data: { closed } };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}

function validateAssignment(existing: { startTime: Date; endTime: Date }[], next: { startTime: Date; endTime: Date }) {
  const combined = [...existing, next];
  const dailyRest = validateConsecutiveShiftsDailyRest(combined);
  if (!dailyRest.isValid) {
    return { error: dailyRest.reason === "overlap"
      ? "Le créneau chevauche un autre shift du salarié."
      : dailyRest.reason === "amplitude"
        ? "L'amplitude journalière dépasse 13 heures."
        : "Le repos quotidien de 11 heures n'est pas respecté." };
  }
  if (!validateWeeklyHours(existing, next).isValid) return { error: "Le plafond de 48 heures hebdomadaires serait dépassé." };
  if (!validateWeeklyRestDays(combined, next.startTime).isValid ||
      !validateWeeklyRestDays(combined, next.endTime).isValid ||
      !validateMaxConsecutiveWorkedDays(combined).isValid) {
    return { error: "Le repos hebdomadaire obligatoire ne serait pas respecté." };
  }
  return null;
}

export async function assignRestaurantSlot(
  input: unknown,
): Promise<RestaurantActionResult<Shift | { requestId: string; pending: true }>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const { slotId, userId, date } = AssignRestaurantSlotSchema.parse(input);
    const startOfDay = shiftDatesForDay(date, "00:00", "23:59").startTime;
    const nextDay = shiftDatesForDay(format(addDays(toAppTime(startOfDay), 1), "yyyy-MM-dd"), "00:00", "00:01").startTime;

    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`restaurant-slot:${slotId}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${slotId}:${date}`}, 0))`;
      await tx.$queryRaw`SELECT id FROM "RestaurantSlot" WHERE id = ${slotId} FOR UPDATE`;
      const slot = await tx.restaurantSlot.findUnique({ where: { id: slotId } });
      if (!slot?.isActive) return { success: false as const, error: "Ce créneau n'est plus actif." };
      const slotShift = shiftDatesForDay(date, slot.startTime, slot.endTime);
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const employee = await tx.user.findFirst({ where: { id: userId, role: { in: ["SALARIE", "MANAGER"] }, isActive: true } });
      if (!employee) return { success: false as const, error: "Salarié actif introuvable." };
      const closureDate = new Date(`${date}T12:00:00`);
      const closureKey = new Date(Date.UTC(closureDate.getFullYear(), closureDate.getMonth(), closureDate.getDate()));
      const closure = await tx.restaurantClosure.findUnique({
        where: { slotId_date: { slotId, date: closureKey } },
      });
      const dayNumber = ((closureDate.getDay() + 6) % 7) + 1;
      if (closure?.isClosed ?? slot.closedDays.includes(dayNumber)) {
        return { success: false as const, error: "Ce créneau est fermé à cette date." };
      }

      const occupants = await tx.shift.findMany({
        where: {
          slotId,
          startTime: { gte: startOfDay, lt: nextDay },
          status: { not: "ANNULE" },
        },
        orderBy: { id: "asc" },
      });
      const occupied = occupants[0];
      if (occupants.length > 1) {
        return { success: false as const, error: "Plusieurs shifts occupent déjà cette case. Corrigez la donnée avant de poursuivre." };
      }
      if (occupants.some((shift) => shift.userId === userId)) {
        return { success: true as const, data: occupied };
      }

      if (occupied) {
        const notice = checkNoticePeriod(occupied.startTime);
        if (notice.requiresDerogation && occupied.userId !== userId) {
          const pending = await tx.shiftReplacementRequest.findFirst({
            where: { shiftId: occupied.id, proposedUserId: userId, status: "EN_ATTENTE" },
          });
          if (pending) return { success: true as const, data: { requestId: pending.id, pending: true } };
          const request = await tx.shiftReplacementRequest.create({
            data: { shiftId: occupied.id, proposedUserId: userId, requestedById: actor.id },
          });
          await tx.auditLog.create({
            data: {
              action: "SHIFT_REPLACEMENT_REQUESTED",
              tableName: "ShiftReplacementRequest",
              recordId: request.id,
              userId: actor.id,
              payloadOld: Prisma.JsonNull,
              payloadNew: json({ ...request, originalUserId: occupied.userId, proposedUserId: userId }),
            },
          });
          return { success: true as const, data: { requestId: request.id, pending: true } };
        }

        const existing = await tx.shift.findMany({
          where: { userId, status: { not: "ANNULE" }, id: { not: occupied.id } },
          select: { startTime: true, endTime: true },
        });
        const violation = validateAssignment(existing, slotShift);
        if (violation) return { success: false as const, error: violation.error };
        const late = checkNoticePeriod(slotShift.startTime).requiresDerogation;
        const updated = await tx.shift.update({
          where: { id: occupied.id },
          data: {
            userId,
            status: late ? "EN_ATTENTE_DEROGATION" : occupied.status,
            isLateModification: late,
            derogationRequestedAt: late ? new Date() : null,
            derogationAcceptedAt: null,
            acknowledgedAt: null,
            planningVersion: occupied.planningVersion + 1,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "SHIFT_UPDATED",
            tableName: "Shift",
            recordId: occupied.id,
            userId: actor.id,
            payloadOld: json(occupied),
            payloadNew: json(updated),
          },
        });
        return { success: true as const, data: updated };
      }

      const existing = await tx.shift.findMany({
        where: { userId, status: { not: "ANNULE" } },
        select: { startTime: true, endTime: true },
      });
      const violation = validateAssignment(existing, slotShift);
      if (violation) return { success: false as const, error: violation.error };
      const late = checkNoticePeriod(slotShift.startTime).requiresDerogation;
      const created = await tx.shift.create({
        data: {
          userId,
          slotId,
          startTime: slotShift.startTime,
          endTime: slotShift.endTime,
          status: late ? "EN_ATTENTE_DEROGATION" : "BROUILLON",
          isLateModification: late,
          derogationRequestedAt: late ? new Date() : null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "SHIFT_CREATED",
          tableName: "Shift",
          recordId: created.id,
          userId: actor.id,
          payloadOld: Prisma.JsonNull,
          payloadNew: json(created),
        },
      });
      return { success: true as const, data: created };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}

export async function respondToReplacementRequest(
  requestId: string,
  accepted: boolean,
): Promise<RestaurantActionResult<Shift | ShiftReplacementRequest>> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SALARIE") return { success: false, error: "Accès réservé au salarié concerné." };
    return await prisma.$transaction(async (tx) => {
      const initialRequest = await tx.shiftReplacementRequest.findUnique({
        where: { id: requestId },
      });
      if (!initialRequest) return { success: false as const, error: "Cette demande n'existe plus." };
      await tx.$queryRaw`SELECT id FROM "Shift" WHERE id = ${initialRequest.shiftId} FOR UPDATE`;
      const request = await tx.shiftReplacementRequest.findUnique({
        where: { id: requestId },
        include: { shift: true },
      });
      if (!request || request.shift.userId !== user.id || request.status !== "EN_ATTENTE") {
        return { success: false as const, error: "Cette demande n'est plus en attente ou ne vous concerne pas." };
      }
      const now = new Date();
      let updatedShift = request.shift;
      if (accepted) {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${request.proposedUserId} FOR UPDATE`;
        const existing = await tx.shift.findMany({
          where: { userId: request.proposedUserId, status: { not: "ANNULE" } },
          select: { startTime: true, endTime: true },
        });
        const violation = validateAssignment(existing, request.shift);
        if (violation) return { success: false as const, error: violation.error };
        updatedShift = await tx.shift.update({
          where: { id: request.shift.id },
          data: {
            userId: request.proposedUserId,
            status: "EN_ATTENTE_DEROGATION",
            isLateModification: true,
            derogationRequestedAt: now,
            derogationAcceptedAt: null,
            acknowledgedAt: null,
            planningVersion: request.shift.planningVersion + 1,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "SHIFT_UPDATED",
            tableName: "Shift",
            recordId: request.shift.id,
            userId: user.id,
            payloadOld: json(request.shift),
            payloadNew: json(updatedShift),
          },
        });
        const otherRequests = await tx.shiftReplacementRequest.findMany({
          where: { shiftId: request.shift.id, status: "EN_ATTENTE", id: { not: request.id } },
        });
        for (const otherRequest of otherRequests) {
          const cancelled = await tx.shiftReplacementRequest.update({
            where: { id: otherRequest.id },
            data: { status: "ANNULEE", respondedAt: now },
          });
          await tx.auditLog.create({
            data: {
              action: "SHIFT_REPLACEMENT_CANCELLED",
              tableName: "ShiftReplacementRequest",
              recordId: otherRequest.id,
              userId: user.id,
              payloadOld: json(otherRequest),
              payloadNew: json(cancelled),
              timestamp: now,
            },
          });
        }
      }
      const updatedRequest = await tx.shiftReplacementRequest.update({
        where: { id: request.id },
        data: { status: accepted ? "ACCEPTEE" : "REFUSEE", respondedAt: now },
      });
      await tx.auditLog.create({
        data: {
          action: accepted ? "SHIFT_REPLACEMENT_ACCEPTED" : "SHIFT_REPLACEMENT_REFUSED",
          tableName: "ShiftReplacementRequest",
          recordId: request.id,
          userId: user.id,
          payloadOld: json(request),
          payloadNew: json(updatedRequest),
          timestamp: now,
        },
      });
      return { success: true as const, data: accepted ? updatedShift : updatedRequest };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}

export async function duplicateRestaurantWeek(
  sourceWeek: string,
  periodStart: string,
  periodEnd: string,
): Promise<RestaurantActionResult<{ createdCount: number; skippedCount: number }>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    const dateSchema = AssignRestaurantSlotSchema.shape.date;
    if (!dateSchema.safeParse(sourceWeek).success ||
        !dateSchema.safeParse(periodStart).success ||
        !dateSchema.safeParse(periodEnd).success) {
      return { success: false, error: "Les dates de duplication sont invalides." };
    }
    const source = new Date(`${sourceWeek}T12:00:00`);
    const start = new Date(`${periodStart}T12:00:00`);
    const end = new Date(`${periodEnd}T12:00:00`);
    if (end < start || differenceInCalendarDays(end, start) > 365) {
      return { success: false, error: "La période doit être comprise entre 1 jour et 1 an." };
    }

    return await prisma.$transaction(async (tx) => {
      const sourceDay = startOfWeek(toAppTime(source), { weekStartsOn: 1 });
      const sourceEnd = fromAppTime(addDays(sourceDay, 7));
      const sourceStart = fromAppTime(sourceDay);
      const sourceShifts = await tx.shift.findMany({
        where: {
          slotId: { not: null },
          startTime: { gte: sourceStart, lt: sourceEnd },
          status: { not: "ANNULE" },
        },
        orderBy: { startTime: "asc" },
      });
      if (sourceShifts.length === 0) {
        return { success: false as const, error: "Aucune affectation de créneau à dupliquer cette semaine." };
      }

      const slots = await tx.restaurantSlot.findMany({ where: { isActive: true } });
      const slotById = new Map(slots.map((slot) => [slot.id, slot]));
      for (const slotId of slots.map((slot) => slot.id).sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`restaurant-slot:${slotId}`}, 0))`;
      }
      let createdCount = 0;
      let skippedCount = 0;
      for (let day = start; day <= end; day = addDays(day, 1)) {
        const dayString = format(day, "yyyy-MM-dd");
        const sourceWeekday = ((day.getDay() + 6) % 7);
        const sourceShiftsForDay = sourceShifts.filter((shift) =>
          ((toAppTime(shift.startTime).getDay() + 6) % 7) === sourceWeekday
        );
        for (const sourceShift of sourceShiftsForDay) {
          if (!sourceShift.slotId) continue;
          const slot = slotById.get(sourceShift.slotId);
          if (!slot) {
            skippedCount++;
            continue;
          }
          const targetTimes = shiftDatesForDay(dayString, format(toAppTime(sourceShift.startTime), "HH:mm"), format(toAppTime(sourceShift.endTime), "HH:mm"));
          const targetDate = new Date(`${dayString}T12:00:00`);
          const closureDate = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${slot.id}:${dayString}`}, 0))`;
          await tx.$queryRaw`SELECT id FROM "RestaurantSlot" WHERE id = ${slot.id} FOR UPDATE`;
          const currentSlot = await tx.restaurantSlot.findUnique({ where: { id: slot.id } });
          if (!currentSlot?.isActive) {
            skippedCount++;
            continue;
          }
          const employee = await tx.user.findFirst({
            where: { id: sourceShift.userId, role: { in: ["SALARIE", "MANAGER"] }, isActive: true },
            select: { id: true },
          });
          if (!employee) {
            skippedCount++;
            continue;
          }
          const closure = await tx.restaurantClosure.findUnique({
            where: { slotId_date: { slotId: slot.id, date: closureDate } },
          });
          if (closure?.isClosed ?? currentSlot.closedDays.includes(sourceWeekday + 1)) {
            skippedCount++;
            continue;
          }
          const occupied = await tx.shift.findFirst({
            where: {
              slotId: slot.id,
              startTime: { gte: targetTimes.startTime, lt: shiftDatesForDay(format(addDays(day, 1), "yyyy-MM-dd"), "00:00", "00:01").startTime },
              status: { not: "ANNULE" },
            },
          });
          if (occupied) {
            skippedCount++;
            continue;
          }
          const existing = await tx.shift.findMany({
            where: { userId: sourceShift.userId, status: { not: "ANNULE" } },
            select: { startTime: true, endTime: true },
          });
          const violation = validateAssignment(existing, targetTimes);
          if (violation) {
            skippedCount++;
            continue;
          }
          const late = checkNoticePeriod(targetTimes.startTime).requiresDerogation;
          const created = await tx.shift.create({
            data: {
              slotId: slot.id,
              userId: sourceShift.userId,
              startTime: targetTimes.startTime,
              endTime: targetTimes.endTime,
              status: late ? "EN_ATTENTE_DEROGATION" : "BROUILLON",
              isLateModification: late,
              derogationRequestedAt: late ? new Date() : null,
            },
          });
          await tx.auditLog.create({
            data: {
              action: "SHIFT_CREATED",
              tableName: "Shift",
              recordId: created.id,
              userId: actor.id,
              payloadOld: Prisma.JsonNull,
              payloadNew: json(created),
            },
          });
          createdCount++;
        }
      }
      await tx.auditLog.create({
        data: {
          action: "RESTAURANT_WEEK_DUPLICATED",
          tableName: "Shift",
          recordId: "BATCH",
          userId: actor.id,
          payloadNew: { sourceWeek, periodStart, periodEnd, createdCount, skippedCount },
        },
      });
      return { success: true as const, data: { createdCount, skippedCount } };
    }, { maxWait: 10_000, timeout: 120_000 });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}

export async function archiveRestaurantSlot(slotId: string): Promise<RestaurantActionResult<RestaurantSlot>> {
  try {
    const actor = await requireUserWithRoles(["MANAGER", "SUPER_ADMIN"]);
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`restaurant-slot:${slotId}`}, 0))`;
      await tx.$queryRaw`SELECT id FROM "RestaurantSlot" WHERE id = ${slotId} FOR UPDATE`;
      const current = await tx.restaurantSlot.findUnique({ where: { id: slotId } });
      if (!current) return { success: false as const, error: "Créneau introuvable." };
      const shifts = await tx.shift.count({ where: { slotId } });
      if (shifts > 0) {
        return { success: false as const, error: "Ce poste possède des shifts historiques. Videz ses affectations avant de l'archiver." };
      }
      const updated = await tx.restaurantSlot.update({
        where: { id: slotId },
        data: { isActive: false },
      });
      await tx.auditLog.create({
        data: {
          action: "RESTAURANT_SLOT_ARCHIVED",
          tableName: "RestaurantSlot",
          recordId: slotId,
          userId: actor.id,
          payloadOld: json(current),
          payloadNew: json(updated),
        },
      });
      return { success: true as const, data: updated };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur inattendue." };
  }
}
