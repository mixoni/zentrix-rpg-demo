import { Pool } from "pg";
import { queryOne } from "../db";

export type CharacterItemRow = {
  id: string;
  character_id: string;
  item_id: string;
};

export async function findItemInstance(pool: Pool, itemInstanceId: string) {
  return queryOne<CharacterItemRow>(
    pool,
    "SELECT id, character_id, item_id FROM character_items WHERE id=$1",
    [itemInstanceId]
  );
}

export async function grantItem(pool: Pool, characterId: string, itemId: string) {
  return queryOne<{ id: string }>(
    pool,
    "INSERT INTO character_items(character_id, item_id) VALUES($1,$2) RETURNING id",
    [characterId, itemId]
  );
}

export async function transferItemInstance(pool: Pool, itemInstanceId: string, toCharacterId: string) {
  await pool.query(
    "UPDATE character_items SET character_id=$1 WHERE id=$2",
    [toCharacterId, itemInstanceId]
  );
}
