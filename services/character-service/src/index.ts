import "dotenv/config";
import Fastify from "fastify";
import { z } from "zod";
import path from "node:path";
import { createPool, queryMany, queryOne } from "./db";
import { runMigrations } from "./migrations";
import { getBearerToken, verifyJwt, Role, JwtPayload } from "./jwt";
import { createRedis } from "./cache";
import { computeItemDisplayName, sumStats } from "./logic";

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

const app = Fastify({ logger: true });

type AuthedRequest = { user: JwtPayload };

function requireAuth(req: any, reply: any): JwtPayload | null {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
  try {
    return verifyJwt(token, env.JWT_SECRET);
  } catch {
    reply.code(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
}

function requireRole(user: JwtPayload, role: Role, reply: any) {
  if (user.role !== role) {
    reply.code(403).send({ error: "FORBIDDEN" });
    return false;
  }
  return true;
}

function isOwnerOrGM(user: JwtPayload, ownerId: string) {
  return user.role === "GameMaster" || user.sub === ownerId;
}

async function invalidateCharacterCache(characterId: string) {
  await redis.del(`character:${characterId}:details`);
}

app.get("/health", async () => ({ ok: true }));

/** Seed initial data (classes + a few items) if empty */
async function seedIfNeeded() {
  const c = await queryOne<{ cnt: string }>(pool, "SELECT COUNT(*)::text as cnt FROM classes");
  if (c && Number(c.cnt) > 0) return;

  await pool.query("INSERT INTO classes(name, description) VALUES ($1,$2), ($3,$4)",
    ["Warrior","Frontline fighter", "Rogue","Fast and deadly"]
  );

  await pool.query(
    `INSERT INTO items(base_name, description, bonus_strength, bonus_agility, bonus_intelligence, bonus_faith)
     VALUES
      ('Iron Sword','A basic sword', 3,0,0,0),
      ('Swift Dagger','Quick strikes', 0,3,0,0),
      ('Apprentice Tome','Arcane knowledge', 0,0,3,0),
      ('Cleric Charm','Blessed relic', 0,0,0,3)
    `
  );

  app.log.info("Seeded initial classes and items");
}

// ---- Schemas
const CreateCharacterSchema = z.object({
  name: z.string().min(2).max(50),
  classId: z.string().uuid(),
  health: z.number().int().min(1).max(9999),
  mana: z.number().int().min(0).max(9999),
  baseStrength: z.number().int().min(0).max(9999),
  baseAgility: z.number().int().min(0).max(9999),
  baseIntelligence: z.number().int().min(0).max(9999),
  baseFaith: z.number().int().min(0).max(9999),
});

const CreateItemSchema = z.object({
  baseName: z.string().min(2).max(100),
  description: z.string().min(1).max(500),
  bonusStrength: z.number().int().min(0).max(9999).default(0),
  bonusAgility: z.number().int().min(0).max(9999).default(0),
  bonusIntelligence: z.number().int().min(0).max(9999).default(0),
  bonusFaith: z.number().int().min(0).max(9999).default(0),
});

const GrantItemSchema = z.object({
  characterId: z.string().uuid(),
  itemId: z.string().uuid(),
});

const GiftItemSchema = z.object({
  fromCharacterId: z.string().uuid(),
  toCharacterId: z.string().uuid(),
  itemInstanceId: z.string().uuid(),
});

// ---- Endpoints

// GM only: list all characters with name, health, mana
app.get("/api/character", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  const rows = await queryMany<{ id: string; name: string; health: number; mana: number }>(
    pool,
    "SELECT id, name, health, mana FROM characters ORDER BY created_at DESC"
  );
  return rows;
});

// Get character details (owner or GM) - cached
app.get("/api/character/:id", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  const id = (req.params as any).id as string;

  // cache key
  const key = `character:${id}:details`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const character = await queryOne<any>(
    pool,
    `SELECT c.*, cl.name as class_name, cl.description as class_description
     FROM characters c
     JOIN classes cl ON cl.id = c.class_id
     WHERE c.id=$1`,
    [id]
  );
  if (!character) return reply.code(404).send({ error: "NOT_FOUND" });

  if (!isOwnerOrGM(user, character.created_by)) return reply.code(403).send({ error: "FORBIDDEN" });

  const items = await queryMany<any>(
    pool,
    `SELECT ci.id as instance_id, i.*
     FROM character_items ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.character_id=$1
     ORDER BY ci.acquired_at ASC`,
    [id]
  );

  const base = {
    strength: character.base_strength,
    agility: character.base_agility,
    intelligence: character.base_intelligence,
    faith: character.base_faith,
  };

  const bonuses = items.map((it: any) => ({
    strength: it.bonus_strength,
    agility: it.bonus_agility,
    intelligence: it.bonus_intelligence,
    faith: it.bonus_faith,
  }));

  const calculated = sumStats(base, bonuses);

  const result = {
    id: character.id,
    name: character.name,
    health: character.health,
    mana: character.mana,
    createdBy: character.created_by,
    class: { id: character.class_id, name: character.class_name, description: character.class_description },
    baseStats: base,
    calculatedStats: calculated,
    items: items.map((it: any) => ({
      instanceId: it.instance_id,
      id: it.id,
      baseName: it.base_name,
      displayName: computeItemDisplayName(it.base_name, {
        strength: it.bonus_strength,
        agility: it.bonus_agility,
        intelligence: it.bonus_intelligence,
        faith: it.bonus_faith,
      }),
      description: it.description,
      bonusStrength: it.bonus_strength,
      bonusAgility: it.bonus_agility,
      bonusIntelligence: it.bonus_intelligence,
      bonusFaith: it.bonus_faith,
    })),
  };

  await redis.set(key, JSON.stringify(result), "EX", 120);
  return result;
});

// Create a new character (any authenticated user)
app.post("/api/character", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;

  const body = CreateCharacterSchema.parse(req.body);

  // validate class exists
  const cls = await queryOne<{ id: string }>(pool, "SELECT id FROM classes WHERE id=$1", [body.classId]);
  if (!cls) return reply.code(400).send({ error: "INVALID_CLASS" });

  try {
    const row = await queryOne<{ id: string }>(
      pool,
      `INSERT INTO characters(name, health, mana, base_strength, base_agility, base_intelligence, base_faith, class_id, created_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [body.name, body.health, body.mana, body.baseStrength, body.baseAgility, body.baseIntelligence, body.baseFaith, body.classId, user.sub]
    );
    return reply.code(201).send({ id: row!.id });
  } catch (e: any) {
    if (String(e?.message ?? "").includes("duplicate")) {
      return reply.code(409).send({ error: "CHARACTER_NAME_TAKEN" });
    }
    req.log.error(e);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  }
});

// GM only: list all items
app.get("/api/items", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  const items = await queryMany<any>(pool, "SELECT * FROM items ORDER BY base_name ASC");
  return items.map((it: any) => ({
    id: it.id,
    baseName: it.base_name,
    displayName: computeItemDisplayName(it.base_name, {
      strength: it.bonus_strength,
      agility: it.bonus_agility,
      intelligence: it.bonus_intelligence,
      faith: it.bonus_faith,
    }),
    description: it.description,
    bonusStrength: it.bonus_strength,
    bonusAgility: it.bonus_agility,
    bonusIntelligence: it.bonus_intelligence,
    bonusFaith: it.bonus_faith,
  }));
});

// Create item (GM only - sensible default for a game admin)
app.post("/api/items", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  const body = CreateItemSchema.parse(req.body);

  const row = await queryOne<{ id: string }>(
    pool,
    `INSERT INTO items(base_name, description, bonus_strength, bonus_agility, bonus_intelligence, bonus_faith)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [body.baseName, body.description, body.bonusStrength, body.bonusAgility, body.bonusIntelligence, body.bonusFaith]
  );

  return reply.code(201).send({ id: row!.id });
});

// Get item details (public to authenticated users)
app.get("/api/items/:id", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;

  const id = (req.params as any).id as string;
  const it = await queryOne<any>(pool, "SELECT * FROM items WHERE id=$1", [id]);
  if (!it) return reply.code(404).send({ error: "NOT_FOUND" });

  const displayName = computeItemDisplayName(it.base_name, {
    strength: it.bonus_strength,
    agility: it.bonus_agility,
    intelligence: it.bonus_intelligence,
    faith: it.bonus_faith,
  });

  return {
    id: it.id,
    baseName: it.base_name,
    displayName,
    description: it.description,
    bonusStrength: it.bonus_strength,
    bonusAgility: it.bonus_agility,
    bonusIntelligence: it.bonus_intelligence,
    bonusFaith: it.bonus_faith,
  };
});

// Grant an item to a character (GM only)
app.post("/api/items/grant", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  const body = GrantItemSchema.parse(req.body);

  const ch = await queryOne<any>(pool, "SELECT id FROM characters WHERE id=$1", [body.characterId]);
  if (!ch) return reply.code(404).send({ error: "CHARACTER_NOT_FOUND" });

  const it = await queryOne<any>(pool, "SELECT id FROM items WHERE id=$1", [body.itemId]);
  if (!it) return reply.code(404).send({ error: "ITEM_NOT_FOUND" });

  const row = await queryOne<{ id: string }>(
    pool,
    "INSERT INTO character_items(character_id, item_id) VALUES($1,$2) RETURNING id",
    [body.characterId, body.itemId]
  );

  await invalidateCharacterCache(body.characterId);
  return reply.code(201).send({ itemInstanceId: row!.id });
});

// Gift (transfer) an item instance from one character to another
app.post("/api/items/gift", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;

  const body = GiftItemSchema.parse(req.body);

  const from = await queryOne<any>(pool, "SELECT id, created_by FROM characters WHERE id=$1", [body.fromCharacterId]);
  if (!from) return reply.code(404).send({ error: "FROM_CHARACTER_NOT_FOUND" });

  const to = await queryOne<any>(pool, "SELECT id FROM characters WHERE id=$1", [body.toCharacterId]);
  if (!to) return reply.code(404).send({ error: "TO_CHARACTER_NOT_FOUND" });

  // owner can gift, or GM
  if (!(user.role === "GameMaster" || user.sub === from.created_by)) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const inst = await queryOne<any>(
    pool,
    "SELECT id, character_id FROM character_items WHERE id=$1",
    [body.itemInstanceId]
  );
  if (!inst) return reply.code(404).send({ error: "ITEM_INSTANCE_NOT_FOUND" });
  if (inst.character_id !== body.fromCharacterId) return reply.code(400).send({ error: "ITEM_NOT_OWNED_BY_FROM_CHARACTER" });

  await pool.query("UPDATE character_items SET character_id=$1 WHERE id=$2", [body.toCharacterId, body.itemInstanceId]);

  await invalidateCharacterCache(body.fromCharacterId);
  await invalidateCharacterCache(body.toCharacterId);

  return { ok: true };
});

// ---- Internal endpoints for Combat Service (secured with X-Internal-Token)

function requireInternal(req: any, reply: any) {
  const token = req.headers["x-internal-token"];
  if (!token || token !== env.INTERNAL_TOKEN) {
    reply.code(401).send({ error: "UNAUTHORIZED_INTERNAL" });
    return false;
  }
  return true;
}

// Snapshot endpoint (used by Combat)
app.get("/internal/characters/:id/snapshot", async (req, reply) => {
  if (!requireInternal(req, reply)) return;
  const id = (req.params as any).id as string;

  const character = await queryOne<any>(
    pool,
    `SELECT c.*, cl.name as class_name
     FROM characters c
     JOIN classes cl ON cl.id = c.class_id
     WHERE c.id=$1`,
    [id]
  );
  if (!character) return reply.code(404).send({ error: "NOT_FOUND" });

  const items = await queryMany<any>(
    pool,
    `SELECT ci.id as instance_id, i.*
     FROM character_items ci
     JOIN items i ON i.id = ci.item_id
     WHERE ci.character_id=$1`,
    [id]
  );

  const base = {
    strength: character.base_strength,
    agility: character.base_agility,
    intelligence: character.base_intelligence,
    faith: character.base_faith,
  };
  const bonuses = items.map((it: any) => ({
    strength: it.bonus_strength,
    agility: it.bonus_agility,
    intelligence: it.bonus_intelligence,
    faith: it.bonus_faith,
  }));

  const calculated = sumStats(base, bonuses);

  return {
    id: character.id,
    name: character.name,
    createdBy: character.created_by,
    health: character.health,
    mana: character.mana,
    className: character.class_name,
    calculatedStats: calculated,
    itemInstances: items.map((it: any) => ({ instanceId: it.instance_id, itemId: it.id })),
  };
});

// Resolve duel: winner takes a random item instance from loser
app.post("/internal/duels/resolve", async (req, reply) => {
  if (!requireInternal(req, reply)) return;

  const Body = z.object({
    duelId: z.string().uuid().optional(),
    winnerCharacterId: z.string().uuid(),
    loserCharacterId: z.string().uuid(),
  }).parse(req.body);

  const loserItems = await queryMany<any>(
    pool,
    "SELECT id, item_id FROM character_items WHERE character_id=$1",
    [Body.loserCharacterId]
  );

  if (loserItems.length === 0) {
    // nothing to transfer
    await invalidateCharacterCache(Body.winnerCharacterId);
    await invalidateCharacterCache(Body.loserCharacterId);
    return { transferred: null };
  }

  const pick = loserItems[Math.floor(Math.random() * loserItems.length)];
  await pool.query("UPDATE character_items SET character_id=$1 WHERE id=$2", [Body.winnerCharacterId, pick.id]);

  await invalidateCharacterCache(Body.winnerCharacterId);
  await invalidateCharacterCache(Body.loserCharacterId);

  return { transferred: { itemInstanceId: pick.id, itemId: pick.item_id } };
});

// ----

async function main() {
  await runMigrations(pool, path.join(__dirname, "..", "migrations"));
  await seedIfNeeded();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
