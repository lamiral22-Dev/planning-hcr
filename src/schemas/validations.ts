import { z } from "zod";

export const ShiftSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, "L'identifiant salarié est requis"),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});

export const SwapRequestSchema = z.object({
  shiftId: z.string().min(1, "Le shift d'origine est requis"),
  targetUserId: z.string().min(1, "Le salarié ciblé est requis"),
  reason: z.string().optional(),
});

export type ShiftInput = z.infer<typeof ShiftSchema>;
export type SwapRequestInput = z.infer<typeof SwapRequestSchema>;
