import { Pool } from "pg";
import { queryMany, queryOne } from "../db";

export type CharacterItemInstanceRow = { id: string; character_id: string; item_id: string };

export async function listInstancesWithItems(pool: Pool, characterId: string) {
  return queryMany<any>(
    pool,
    `SELECT ci.id as instance_id, i.*
     FROM character_items ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.character_id=$1
     ORDER BY ci.acquired_at ASC`,
    [characterId]
  );
}

export async function listInstancesWithItemsInternal(pool: Pool, characterId: string) {
  return queryMany<any>(
    pool,
    `SELECT ci.id as instance_id, i.*
     FROM character_items ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.character_id=$1`,
    [characterId]
  );
}

export async function insertInstance(pool: Pool, characterId: string, itemId: string) {
  return queryOne<{ id: string }>(
    pool,
    "INSERT INTO character_items(character_id, item_id) VALUES($1,$2) RETURNING id",
    [characterId, itemId]
  );
}

export async function getInstance(pool: Pool, instanceId: string): Promise<CharacterItemInstanceRow | null> {
  return queryOne<CharacterItemInstanceRow>(
    pool,
    "SELECT id, character_id, item_id FROM character_items WHERE id=$1",
    [instanceId]
  );
}

export async function listInstancesForCharacter(pool: Pool, characterId: string): Promise<CharacterItemInstanceRow[]> {
  return queryMany<CharacterItemInstanceRow>(
    pool,
    "SELECT id, character_id, item_id FROM character_items WHERE character_id=$1",
    [characterId]
  );
}

export async function transferInstance(pool: Pool, instanceId: string, toCharacterId: string) {
  await pool.query("UPDATE character_items SET character_id=$1 WHERE id=$2", [toCharacterId, instanceId]);
}
