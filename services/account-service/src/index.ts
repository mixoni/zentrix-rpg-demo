import "dotenv/config";
import Fastify from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createPool, queryOne } from "./db";
import { runMigrations } from "./migrations";
import { signJwt, Role } from "./jwt";
import path from "node:path";

const env = {
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
};

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");

const pool = createPool(env.DATABASE_URL);

const app = Fastify({ logger: true });

const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(200),
  role: z.enum(["User","GameMaster"]).optional(),
});

const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(200),
});

app.get("/health", async () => ({ ok: true }));

app.post("/api/register", async (req, reply) => {
  const body = RegisterSchema.parse(req.body);
  const role: Role = body.role ?? "User";
  const password_hash = await bcrypt.hash(body.password, 10);

  try {
    const row = await queryOne<{ id: string }>(
      pool,
      "INSERT INTO users(username, password_hash, role) VALUES($1,$2,$3) RETURNING id",
      [body.username, password_hash, role]
    );
    return reply.code(201).send({ id: row!.id, username: body.username, role });
  } catch (e: any) {
    if (String(e?.message ?? "").includes("duplicate")) {
      return reply.code(409).send({ error: "USERNAME_TAKEN" });
    }
    req.log.error(e);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  }
});

app.post("/api/login", async (req, reply) => {
  const body = LoginSchema.parse(req.body);
  const user = await queryOne<{ id: string; username: string; password_hash: string; role: Role }>(
    pool,
    "SELECT id, username, password_hash, role FROM users WHERE username=$1",
    [body.username]
  );

  if (!user) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });

  const ok = await bcrypt.compare(body.password, user.password_hash);
  if (!ok) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });

  const token = signJwt({ sub: user.id, role: user.role, username: user.username }, env.JWT_SECRET, "2h");
  return { token, user: { id: user.id, username: user.username, role: user.role } };
});

// Minimal internal endpoint (optional) if you want to validate user existence by ID later
app.get("/internal/users/:id", async (req, reply) => {
  const id = (req.params as any).id as string;
  const user = await queryOne<{ id: string; username: string; role: Role }>(
    pool,
    "SELECT id, username, role FROM users WHERE id=$1",
    [id]
  );
  if (!user) return reply.code(404).send({ error: "NOT_FOUND" });
  return user;
});

async function main() {
  await runMigrations(pool, path.join(__dirname, "..", "migrations"));
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
