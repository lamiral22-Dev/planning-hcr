"use server";

import { ShiftSchema, type ShiftInput } from "@/schemas/validations";

export async function createShift(input: ShiftInput) {
  const validated = ShiftSchema.parse(input);
  return { success: true, data: validated };
}
