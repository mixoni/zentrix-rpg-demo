import { z } from "zod";

export const CreateItemSchema = z.object({
  baseName: z.string().min(2).max(100),
  description: z.string().min(1).max(500),
  bonusStrength: z.number().int().min(0).max(9999).default(0),
  bonusAgility: z.number().int().min(0).max(9999).default(0),
  bonusIntelligence: z.number().int().min(0).max(9999).default(0),
  bonusFaith: z.number().int().min(0).max(9999).default(0),
});

export const GrantItemSchema = z.object({
  characterId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const GiftItemSchema = z.object({
  fromCharacterId: z.string().uuid(),
  toCharacterId: z.string().uuid(),
  itemInstanceId: z.string().uuid(),
});
