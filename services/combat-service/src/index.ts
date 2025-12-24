import "dotenv/config";
import Fastify from "fastify";
import path from "node:path";
import { createPool } from "./db";
import { runMigrations } from "./migrations";
import { createCharacterClient } from "./characterClient";
import { registerHealthRoutes } from "./routes/health.routes";
import { registerDuelsRoutes } from "./routes/duels.routes";

const env = {
  PORT: Number(process.env.PORT ?? 3003),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  CHARACTER_SERVICE_URL: process.env.CHARACTER_SERVICE_URL ?? "",
  INTERNAL_TOKEN: process.env.INTERNAL_TOKEN ?? "",
  DUEL_TIMEOUT_MS: Number(process.env.DUEL_TIMEOUT_MS ?? 5 * 60 * 1000),
};

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");
if (!env.CHARACTER_SERVICE_URL) throw new Error("CHARACTER_SERVICE_URL is required");
if (!env.INTERNAL_TOKEN) throw new Error("INTERNAL_TOKEN is required");

const pool = createPool(env.DATABASE_URL);
const characterClient = createCharacterClient(env.CHARACTER_SERVICE_URL, env.INTERNAL_TOKEN);

const app = Fastify({ logger: true });

registerHealthRoutes(app);
registerDuelsRoutes(app, {
  pool,
  jwtSecret: env.JWT_SECRET,
  duelTimeoutMs: env.DUEL_TIMEOUT_MS,
  characterClient,
});

async function main() {
  await runMigrations(pool, path.join(__dirname, "..", "migrations"));
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
