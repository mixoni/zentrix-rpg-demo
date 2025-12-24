import { Pool } from "pg";
import { JwtPayload } from "../jwt";
import { computeItemDisplayName, sumStats } from "../logic";
import * as CharactersRepo from "../repos/characters.repo";
import * as CharacterItemsRepo from "../repos/character-items.repo";
import { getCharacterCache, setCharacterCache } from "../cache/character.cache";
import { isOwnerOrGM } from "../auth/auth";

type RedisLike = any;

export async function getCharacterDetailsCached(args: {
  pool: Pool;
  redis: RedisLike;
  characterId: string;
  user: JwtPayload;
}) {
  const { pool, redis, characterId: id, user } = args;

  const cached = await getCharacterCache(redis, id);
  if (cached) {
    return { status: 200, body: JSON.parse(cached) };
  }

  const character = await CharactersRepo.getDetailsWithClass(pool, id);
  if (!character) return { status: 404, body: { error: "NOT_FOUND" } };

  if (!isOwnerOrGM(user, character.created_by)) {
    return { status: 403, body: { error: "FORBIDDEN" } };
  }

  const items = await CharacterItemsRepo.listInstancesWithItems(pool, id);

  const base = {
    strength: character.base_strength,
    agility: character.base_agility,
    intelligence: character.base_intelligence,
    faith: character.base_faith,
  };

  const bonuses = items.map((it: any) => ({
    strength: it.bonus_strength,
    agility: it.bonus_agility,
    intelligence: it.bonus_intelligence,
    faith: it.bonus_faith,
  }));

  const calculated = sumStats(base, bonuses);

  const result = {
    id: character.id,
    name: character.name,
    health: character.health,
    mana: character.mana,
    createdBy: character.created_by,
    class: {
      id: character.class_id,
      name: character.class_name,
      description: character.class_description,
    },
    baseStats: base,
    calculatedStats: calculated,
    items: items.map((it: any) => ({
      instanceId: it.instance_id,
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
    })),
  };

  await setCharacterCache(redis, id, JSON.stringify(result));
  return { status: 200, body: result };
}
