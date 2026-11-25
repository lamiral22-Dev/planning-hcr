import { z } from "zod";
import { AssignRestaurantSlotSchema } from "./restaurant-planning";

const date = AssignRestaurantSlotSchema.shape.date;

export const CreateLeaveSchema = z.object({
  type: z.enum(["CP", "RTT", "REPOS", "AUTRE_MOTIF"]),
  dayPeriod: z.enum(["JOURNEE_COMPLETE", "MATIN", "APRES_MIDI"]).default("JOURNEE_COMPLETE"),
  startDate: date,
  endDate: date,
  reason: z.string().trim().max(1000).optional(),
}).refine((value) => value.endDate >= value.startDate, {
  path: ["endDate"],
  message: "La fin doit être postérieure ou égale au début.",
}).refine((value) => value.type !== "AUTRE_MOTIF" || Boolean(value.reason?.trim()), {
  path: ["reason"],
  message: "Le motif est obligatoire pour ce type de congé.",
}).refine((value) => value.dayPeriod === "JOURNEE_COMPLETE" || value.startDate === value.endDate, {
  path: ["endDate"],
  message: "Une demi-journée doit porter sur une seule date.",
});

export const ReviewLeaveSchema = z.object({
  id: z.string().min(1),
  approved: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
  forceReleaseShifts: z.boolean().default(false),
  confirmedShifts: z.array(z.object({ id: z.string().min(1), planningVersion: z.number().int() })).optional(),
});
