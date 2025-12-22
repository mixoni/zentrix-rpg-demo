import { Pool } from "pg";
import { JwtPayload } from "../jwt";
import * as CharactersRepo from "../repos/characters.repo";
import * as ItemsRepo from "../repos/items.repo";
import * as CharacterItemsRepo from "../repos/character-items.repo";
import { invalidateCharacterCache } from "../cache/character.cache";

type RedisLike = any;

export async function InventoryGrantItem(args: {
  pool: Pool;
  redis: RedisLike;
  characterId: string;
  itemId: string;
}) {
  const { pool, redis, characterId, itemId } = args;

  const chOk = await CharactersRepo.existsById(pool, characterId);
  if (!chOk) return { status: 404, body: { error: "CHARACTER_NOT_FOUND" } };

  const itOk = await ItemsRepo.existsById(pool, itemId);
  if (!itOk) return { status: 404, body: { error: "ITEM_NOT_FOUND" } };

  const row = await CharacterItemsRepo.insertInstance(pool, characterId, itemId);
  await invalidateCharacterCache(redis, characterId);

  return { status: 201, body: { itemInstanceId: row!.id } };
}

export async function giftItem(args: {
  pool: Pool;
  redis: RedisLike;
  user: JwtPayload;
  fromCharacterId: string;
  toCharacterId: string;
  itemInstanceId: string;
}) {
  const { pool, redis, user, fromCharacterId, toCharacterId, itemInstanceId } = args;

  const from = await CharactersRepo.getOwner(pool, fromCharacterId);
  if (!from) return { status: 404, body: { error: "FROM_CHARACTER_NOT_FOUND" } };

  const toExists = await CharactersRepo.existsById(pool, toCharacterId);
  if (!toExists) return { status: 404, body: { error: "TO_CHARACTER_NOT_FOUND" } };

  // owner can gift, or GM
  if (!(user.role === "GameMaster" || user.sub === from.created_by)) {
    return { status: 403, body: { error: "FORBIDDEN" } };
  }

  const inst = await CharacterItemsRepo.getInstance(pool, itemInstanceId);
  if (!inst) return { status: 404, body: { error: "ITEM_INSTANCE_NOT_FOUND" } };

  if (inst.character_id !== fromCharacterId) {
    return { status: 400, body: { error: "ITEM_NOT_OWNED_BY_FROM_CHARACTER" } };
  }

  await CharacterItemsRepo.transferInstance(pool, itemInstanceId, toCharacterId);

  await invalidateCharacterCache(redis, fromCharacterId);
  await invalidateCharacterCache(redis, toCharacterId);

  return { status: 200, body: { ok: true } };
}
