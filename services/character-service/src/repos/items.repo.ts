import { Pool } from "pg";
import { queryMany, queryOne } from "../db";

export type ItemRow = {
  id: string;
  base_name: string;
  description: string;
  bonus_strength: number;
  bonus_agility: number;
  bonus_intelligence: number;
  bonus_faith: number;
};

export async function listAll(pool: Pool): Promise<ItemRow[]> {
  return queryMany<ItemRow>(pool, "SELECT * FROM items ORDER BY base_name ASC");
}

export async function getById(pool: Pool, id: string): Promise<ItemRow | null> {
  return queryOne<ItemRow>(pool, "SELECT * FROM items WHERE id=$1", [id]);
}

export async function existsById(pool: Pool, id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(pool, "SELECT id FROM items WHERE id=$1", [id]);
  return !!row;
}

export async function insert(pool: Pool, args: {
  baseName: string;
  description: string;
  bonusStrength: number;
  bonusAgility: number;
  bonusIntelligence: number;
  bonusFaith: number;
}) {
  return queryOne<{ id: string }>(
    pool,
    `INSERT INTO items(base_name, description, bonus_strength, bonus_agility, bonus_intelligence, bonus_faith)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [args.baseName, args.description, args.bonusStrength, args.bonusAgility, args.bonusIntelligence, args.bonusFaith]
  );
}

export async function seedInitial(pool: Pool) {
  await pool.query(
    `INSERT INTO items(base_name, description, bonus_strength, bonus_agility, bonus_intelligence, bonus_faith)
     VALUES
      ('Iron Sword','A basic sword', 3,0,0,0),
      ('Swift Dagger','Quick strikes', 0,3,0,0),
      ('Apprentice Tome','Arcane knowledge', 0,0,3,0),
      ('Cleric Charm','Blessed relic', 0,0,0,3)
    `
  );
}
