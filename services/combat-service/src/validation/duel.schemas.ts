import { z } from "zod";

export const ChallengeSchema = z.object({
  challengerCharacterId: z.string().uuid(),
  opponentCharacterId: z.string().uuid(),
});

export const ActionSchema = z.object({
  actorCharacterId: z.string().uuid(),
});

export type ChallengeDto = z.infer<typeof ChallengeSchema>;
export type ActionDto = z.infer<typeof ActionSchema>;
