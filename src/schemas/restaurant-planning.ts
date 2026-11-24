import { z } from "zod";
import { isValidShiftTimes } from "@/lib/time-utils";

export const RestaurantSlotSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(80),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closedDays: z.array(z.number().int().min(1).max(7)).max(7),
  isActive: z.boolean().default(true),
}).refine((slot) => isValidShiftTimes(slot.startTime, slot.endTime), {
  message: "L'heure de fin doit être postérieure à l'heure de début.",
  path: ["endTime"],
});

export const AssignRestaurantSlotSchema = z.object({
  slotId: z.string().min(1),
  userId: z.string().min(1),
  forceOverrideLeave: z.boolean().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  }, "Date calendrier invalide."),
});
