import "dotenv/config";
import Fastify from "fastify";
import path from "node:path";
import { createPool } from "./db";
import { runMigrations } from "./migrations";
import { registerHealthRoutes } from "./routes/health.routes";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerInternalRoutes } from "./routes/internal.routes";

const env = {
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  // optional:
  INTERNAL_TOKEN: process.env.INTERNAL_TOKEN ?? "",
};

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");

const pool = createPool(env.DATABASE_URL);
const app = Fastify({ logger: true });

registerHealthRoutes(app);
registerAuthRoutes(app, { pool, jwtSecret: env.JWT_SECRET });
registerInternalRoutes(app, { pool, internalToken: env.INTERNAL_TOKEN || undefined });

async function main() {
  await runMigrations(pool, path.join(__dirname, "..", "migrations"));
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
