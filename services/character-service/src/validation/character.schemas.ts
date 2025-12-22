import { z } from "zod";

export const CreateCharacterSchema = z.object({
  name: z.string().min(2).max(50),
  classId: z.string().uuid(),
  health: z.number().int().min(1).max(9999),
  mana: z.number().int().min(0).max(9999),
  baseStrength: z.number().int().min(0).max(9999),
  baseAgility: z.number().int().min(0).max(9999),
  baseIntelligence: z.number().int().min(0).max(9999),
  baseFaith: z.number().int().min(0).max(9999),
});
