import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * Very small migration runner:
 * - migrations are plain SQL files in /migrations (001_*.sql, 002_*.sql, ...)
 * - tracked in schema_migrations table
 */
export async function runMigrations(pool: Pool, migrationsDir: string) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const filename of files) {
    const already = await pool.query("SELECT 1 FROM schema_migrations WHERE filename=$1", [filename]);
    if (already.rowCount && already.rowCount > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf-8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations(filename) VALUES($1)", [filename]);
      await pool.query("COMMIT");
      // eslint-disable-next-line no-console
      console.log(`[migrations] applied ${filename}`);
    } catch (e) {
      await pool.query("ROLLBACK");
      // eslint-disable-next-line no-console
      console.error(`[migrations] failed ${filename}`, e);
      throw e;
    }
  }
}
