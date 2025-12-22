import { Pool } from "pg";
import { computeItemDisplayName } from "../logic";
import * as ItemsRepo from "../repos/items.repo";

function toItemDto(it: any) {
  return {
    id: it.id,
    baseName: it.base_name,
    displayName: computeItemDisplayName(it.base_name, {
      strength: it.bonus_strength,
      agility: it.bonus_agility,
      intelligence: it.bonus_intelligence,
      faith: it.bonus_faith,
    }),
    description: it.description,
    bonusStrength: it.bonus_strength,
    bonusAgility: it.bonus_agility,
    bonusIntelligence: it.bonus_intelligence,
    bonusFaith: it.bonus_faith,
  };
}

export async function listAll(pool: Pool) {
  const items = await ItemsRepo.listAll(pool);
  return items.map(toItemDto);
}

export async function getById(pool: Pool, id: string) {
  const it = await ItemsRepo.getById(pool, id);
  if (!it) return { status: 404, body: { error: "NOT_FOUND" } };

  return { status: 200, body: toItemDto(it) };
}

export async function create(pool: Pool, body: {
  baseName: string;
  description: string;
  bonusStrength: number;
  bonusAgility: number;
  bonusIntelligence: number;
  bonusFaith: number;
}) {
  const row = await ItemsRepo.insert(pool, body);
  return { status: 201, body: { id: row!.id } };
}
