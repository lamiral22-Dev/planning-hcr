"use server";

import { z } from "zod";

const TimeEntrySchema = z.object({
  shiftId: z.string().min(1),
  clockOutTime: z.coerce.date(),
});

export async function recordClockOut(input: z.infer<typeof TimeEntrySchema>) {
  const validated = TimeEntrySchema.parse(input);
  return { success: true, data: validated };
}
