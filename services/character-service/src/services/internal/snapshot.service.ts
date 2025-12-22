import { Pool } from "pg";
import { sumStats } from "../../logic";
import * as CharactersRepo from "../../repos/characters.repo";
import * as CharacterItemsRepo from "../../repos/character-items.repo";

export async function getCharacterSnapshot(pool: Pool, characterId: string) {
  const character = await CharactersRepo.getInternalWithClassName(pool, characterId);
  if (!character) return { status: 404, body: { error: "NOT_FOUND" } };

  const items = await CharacterItemsRepo.listInstancesWithItemsInternal(pool, characterId);

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

  return {
    status: 200,
    body: {
      id: character.id,
      name: character.name,
      createdBy: character.created_by,
      health: character.health,
      mana: character.mana,
      className: character.class_name,
      calculatedStats: calculated,
      itemInstances: items.map((it: any) => ({ instanceId: it.instance_id, itemId: it.id })),
    },
  };
}
