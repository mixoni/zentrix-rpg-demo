import { Pool } from "pg";
import { queryMany, queryOne } from "../db";

export type CharacterListRow = { id: string; name: string; health: number; mana: number };

export type CharacterOwnerRow = { id: string; created_by: string };

export type CharacterWithClassRow = {
  id: string;
  name: string;
  health: number;
  mana: number;
  base_strength: number;
  base_agility: number;
  base_intelligence: number;
  base_faith: number;
  class_id: string;
  created_by: string;
  created_at: string;
  class_name: string;
  class_description: string;
};

export type CharacterInternalRow = {
  id: string;
  name: string;
  health: number;
  mana: number;
  base_strength: number;
  base_agility: number;
  base_intelligence: number;
  base_faith: number;
  class_id: string;
  created_by: string;
  created_at: string;
  class_name: string;
};

export async function listForGM(pool: Pool): Promise<CharacterListRow[]> {
  return queryMany<CharacterListRow>(
    pool,
    "SELECT id, name, health, mana FROM characters ORDER BY created_at DESC"
  );
}

export async function getOwner(pool: Pool, id: string): Promise<CharacterOwnerRow | null> {
  return queryOne<CharacterOwnerRow>(
    pool,
    "SELECT id, created_by FROM characters WHERE id=$1",
    [id]
  );
}

export async function existsById(pool: Pool, id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(pool, "SELECT id FROM characters WHERE id=$1", [id]);
  return !!row;
}

export async function getDetailsWithClass(pool: Pool, id: string): Promise<CharacterWithClassRow | null> {
  return queryOne<CharacterWithClassRow>(
    pool,
    `SELECT c.*, cl.name as class_name, cl.description as class_description
     FROM characters c
     JOIN classes cl ON cl.id = c.class_id
     WHERE c.id=$1`,
    [id]
  );
}

export async function getInternalWithClassName(pool: Pool, id: string): Promise<any | null> {
  return queryOne<CharacterWithClassRow>(
    pool,
    `SELECT c.*, cl.name as class_name
     FROM characters c
     JOIN classes cl ON cl.id = c.class_id
     WHERE c.id=$1`,
    [id]
  );
}

export async function insert(pool: Pool, args: {
  name: string;
  health: number;
  mana: number;
  baseStrength: number;
  baseAgility: number;
  baseIntelligence: number;
  baseFaith: number;
  classId: string;
  createdBy: string;
}) {
  return queryOne<{ id: string }>(
    pool,
    `INSERT INTO characters(name, health, mana, base_strength, base_agility, base_intelligence, base_faith, class_id, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [args.name, args.health, args.mana, args.baseStrength, args.baseAgility, args.baseIntelligence, args.baseFaith, args.classId, args.createdBy]
  );
}
