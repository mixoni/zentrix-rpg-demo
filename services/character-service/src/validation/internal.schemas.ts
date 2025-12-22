import { z } from "zod";

export const ResolveDuelSchema = z.object({
  duelId: z.string().uuid().optional(),
  winnerCharacterId: z.string().uuid(),
  loserCharacterId: z.string().uuid(),
});
