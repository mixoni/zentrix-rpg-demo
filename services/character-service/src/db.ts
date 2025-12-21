import { Pool } from "pg";

export function createPool(databaseUrl: string) {
  return new Pool({ connectionString: databaseUrl });
}

export async function queryOne<T>(pool: Pool, text: string, params: any[] = []): Promise<T | null> {
  const res = await pool.query(text, params);
  return res.rows[0] ?? null;
}

export async function queryMany<T>(pool: Pool, text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
