import { Pool } from "pg";
import { queryOne } from "../db";

export async function existsById(pool: Pool, id: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(pool, "SELECT id FROM classes WHERE id=$1", [id]);
  return !!row;
}

export async function count(pool: Pool): Promise<number> {
  const row = await queryOne<{ cnt: string }>(pool, "SELECT COUNT(*)::text as cnt FROM classes");
  return row ? Number(row.cnt) : 0;
}

export async function seedInitial(pool: Pool) {
  await pool.query(
    "INSERT INTO classes(name, description) VALUES ($1,$2), ($3,$4)",
    ["Warrior","Frontline fighter", "Rogue","Fast and deadly"]
  );
}
