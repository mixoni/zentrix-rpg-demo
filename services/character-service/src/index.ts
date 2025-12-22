import "dotenv/config";
import Fastify from "fastify";
import path from "node:path";
import { createPool, queryMany, queryOne } from "./db";
import { runMigrations } from "./migrations";
import { getBearerToken, verifyJwt, Role, JwtPayload } from "./jwt";
import { createRedis } from "./cache";
import { computeItemDisplayName, sumStats } from "./logic";

import * as ClassesRepo from "./repos/classes.repo";
import * as CharactersRepo from "./repos/characters.repo";
import * as ItemsRepo from "./repos/items.repo";
import * as CharacterItemsRepo from "./repos/character-items.repo";
import { requireAuth, requireRole, isOwnerOrGM } from "./auth/auth";
import { requireInternal } from "./auth/auth-internal";
import { CreateCharacterSchema } from "./validation/character.schemas";
import { CreateItemSchema, GiftItemSchema, GrantItemSchema } from "./validation/items.schemas";
import { ResolveDuelSchema } from "./validation/internal.schemas";
import { getCharacterCache, invalidateCharacterCache, setCharacterCache } from "./cache/character.cache";
import { getCharacterDetailsCached } from "./services/character.service";
import { create as createItem, getById as getItemById, listAll as listAllItems } from "./services/items.service";


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


app.get("/health", async () => ({ ok: true }));

/** Seed initial data (classes + a few items) if empty */
async function seedIfNeeded() {
  const cnt = await ClassesRepo.count(pool);
  if (cnt > 0) return;

  await ClassesRepo.seedInitial(pool);
  await ItemsRepo.seedInitial(pool);

  app.log.info("Seeded initial classes and items");
}

// ---- Endpoints

// GM only: list all characters with name, health, mana
app.get("/api/character", async (req, reply) => {
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  const rows = await CharactersRepo.listForGM(pool);
  return rows;
});

// Get character details (owner or GM) - cached
app.get("/api/character/:id", async (req, reply) => {
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;

  const id = (req.params as any).id as string;

  const res = await getCharacterDetailsCached({
    pool,
    redis,
    characterId: id,
    user,
  });

  return reply.code(res.status).send(res.body);
});


// Create a new character (any authenticated user)
app.post("/api/character", async (req, reply) => {
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;

  const body = CreateCharacterSchema.parse(req.body);

  // validate class exists
  const ok = await ClassesRepo.existsById(pool, body.classId);
  if (!ok) return reply.code(400).send({ error: "INVALID_CLASS" });

  try {
    const row = await CharactersRepo.insert(pool, {
      name: body.name,
      health: body.health,
      mana: body.mana,
      baseStrength: body.baseStrength,
      baseAgility: body.baseAgility,
      baseIntelligence: body.baseIntelligence,
      baseFaith: body.baseFaith,
      classId: body.classId,
      createdBy: user.sub,
    });
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
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  return listAllItems(pool);
});


// Create item (GM only - sensible default for a game admin)
app.post("/api/items", async (req, reply) => {
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  const body = CreateItemSchema.parse(req.body);
  const res = await createItem(pool, body);

  return reply.code(res.status).send(res.body);
});


// Get item details (public to authenticated users)
app.get("/api/items/:id", async (req, reply) => {
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;

  const id = (req.params as any).id as string;
  const res = await getItemById(pool, id);

  return reply.code(res.status).send(res.body);
});


// Grant an item to a character (GM only)
app.post("/api/items/grant", async (req, reply) => {
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;
  if (!requireRole(user, "GameMaster", reply)) return;

  const body = GrantItemSchema.parse(req.body);

  const chOk = await CharactersRepo.existsById(pool, body.characterId);
  if (!chOk) return reply.code(404).send({ error: "CHARACTER_NOT_FOUND" });

  const itOk = await ItemsRepo.existsById(pool, body.itemId);
  if (!itOk) return reply.code(404).send({ error: "ITEM_NOT_FOUND" });

  const row = await CharacterItemsRepo.insertInstance(pool, body.characterId, body.itemId);
  await invalidateCharacterCache(redis, body.characterId);

  return reply.code(201).send({ itemInstanceId: row!.id });
});

// Gift (transfer) an item instance from one character to another
app.post("/api/items/gift", async (req, reply) => {
  const user = requireAuth(req, reply, env.JWT_SECRET);
  if (!user) return;

  const body = GiftItemSchema.parse(req.body);

  const from = await CharactersRepo.getOwner(pool, body.fromCharacterId);
  if (!from) return reply.code(404).send({ error: "FROM_CHARACTER_NOT_FOUND" });

  const toExists = await CharactersRepo.existsById(pool, body.toCharacterId);
  if (!toExists) return reply.code(404).send({ error: "TO_CHARACTER_NOT_FOUND" });

  // owner can gift, or GM
  if (!(user.role === "GameMaster" || user.sub === from.created_by)) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const inst = await CharacterItemsRepo.getInstance(pool, body.itemInstanceId);

  if (!inst) return reply.code(404).send({ error: "ITEM_INSTANCE_NOT_FOUND" });
  if (inst.character_id !== body.fromCharacterId) return reply.code(400).send({ error: "ITEM_NOT_OWNED_BY_FROM_CHARACTER" });

  await CharacterItemsRepo.transferInstance(pool, body.itemInstanceId, body.toCharacterId);

  await invalidateCharacterCache(redis, body.fromCharacterId);
  await invalidateCharacterCache(redis, body.toCharacterId);

  return { ok: true };
});


// Snapshot endpoint (used by Combat)
app.get("/internal/characters/:id/snapshot", async (req, reply) => {
  if (!requireInternal(req, reply, env.INTERNAL_TOKEN)) return;
  const id = (req.params as any).id as string;

  const character = await CharactersRepo.getInternalWithClassName(pool, id);
  if (!character) return reply.code(404).send({ error: "NOT_FOUND" });

  const items = await CharacterItemsRepo.listInstancesWithItemsInternal(pool, id);

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
  if (!requireInternal(req, reply, env.INTERNAL_TOKEN)) return;

  const Body = ResolveDuelSchema.parse(req.body);

  const loserItems = await CharacterItemsRepo.listInstancesForCharacter(pool, Body.loserCharacterId);

  if (loserItems.length === 0) {
    // nothing to transfer
    await invalidateCharacterCache(redis, Body.winnerCharacterId);
    await invalidateCharacterCache(redis, Body.loserCharacterId);
    return { transferred: null };
  }

  const pick = loserItems[Math.floor(Math.random() * loserItems.length)];
  await CharacterItemsRepo.transferInstance(pool, pick.id, Body.winnerCharacterId);

  await invalidateCharacterCache(redis, Body.winnerCharacterId);
  await invalidateCharacterCache(redis, Body.loserCharacterId);

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
