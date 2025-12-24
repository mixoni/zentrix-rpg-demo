import "dotenv/config";
import Fastify from "fastify";
import path from "node:path";
import { createPool } from "./db";
import { runMigrations } from "./migrations";
import { createRedis } from "./cache";
import * as ClassesRepo from "./repos/classes.repo";
import * as ItemsRepo from "./repos/items.repo";
import { registerCharacterRoutes } from "./routes/character.routes";
import { registerItemsRoutes } from "./routes/items.routes";
import { registerInternalRoutes } from "./routes/internal.routes";
import { globalErrorHandler } from "./errors/error-handler";


const env = {
  PORT: Number(process.env.PORT ?? 3002),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  REDIS_URL: process.env.REDIS_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  INTERNAL_TOKEN: process.env.INTERNAL_TOKEN ?? "",
};

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!env.REDIS_URL) throw new Error("REDIS_URL is required");
if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");
if (!env.INTERNAL_TOKEN) throw new Error("INTERNAL_TOKEN is required");

const pool = createPool(env.DATABASE_URL);
const redis = createRedis(env.REDIS_URL);

const deps = {
  pool,
  redis,
  jwtSecret: env.JWT_SECRET,
  internalToken: env.INTERNAL_TOKEN,
};

const app = Fastify({ logger: true });

app.setErrorHandler(globalErrorHandler);


app.get("/health", async () => ({ ok: true }));

registerCharacterRoutes(app, deps);
registerItemsRoutes(app, deps);
registerInternalRoutes(app, deps);

async function seedIfNeeded() {
  const cnt = await ClassesRepo.count(pool);
  if (cnt > 0) return;

  await ClassesRepo.seedInitial(pool);
  await ItemsRepo.seedInitial(pool);

  app.log.info("Seeded initial classes and items");
}

async function main() {
  await runMigrations(pool, path.join(__dirname, "..", "migrations"));
  await seedIfNeeded();



  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
