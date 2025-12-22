import { Pool } from "pg";
import * as CharacterItemsRepo from "../../repos/character-items.repo";
import { invalidateCharacterCache } from "../../cache/character.cache";

type RedisLike = any;

export async function resolveDuel(args: {
  pool: Pool;
  redis: RedisLike;
  winnerCharacterId: string;
  loserCharacterId: string;
  duelId?: string;
}) {
  const { pool, redis, winnerCharacterId, loserCharacterId } = args;

  const loserItems = await CharacterItemsRepo.listInstancesForCharacter(pool, loserCharacterId);

  if (loserItems.length === 0) {
    await invalidateCharacterCache(redis, winnerCharacterId);
    await invalidateCharacterCache(redis, loserCharacterId);
    return { status: 200, body: { transferred: null } };
  }

  const pick = loserItems[Math.floor(Math.random() * loserItems.length)];
  await CharacterItemsRepo.transferInstance(pool, pick.id, winnerCharacterId);

  await invalidateCharacterCache(redis, winnerCharacterId);
  await invalidateCharacterCache(redis, loserCharacterId);

  return {
    status: 200,
    body: { transferred: { itemInstanceId: pick.id, itemId: pick.item_id } },
  };
}
