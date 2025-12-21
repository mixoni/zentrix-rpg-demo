import "dotenv/config";
import Fastify from "fastify";
import { z } from "zod";
import path from "node:path";
import { createPool, queryOne } from "./db";
import { runMigrations } from "./migrations";
import { getBearerToken, verifyJwt, JwtPayload } from "./jwt";
import { createCharacterClient } from "./characterClient";

const env = {
  PORT: Number(process.env.PORT ?? 3003),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "",
  CHARACTER_SERVICE_URL: process.env.CHARACTER_SERVICE_URL ?? "",
  INTERNAL_TOKEN: process.env.INTERNAL_TOKEN ?? "",
};

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!env.JWT_SECRET) throw new Error("JWT_SECRET is required");
if (!env.CHARACTER_SERVICE_URL) throw new Error("CHARACTER_SERVICE_URL is required");
if (!env.INTERNAL_TOKEN) throw new Error("INTERNAL_TOKEN is required");

const pool = createPool(env.DATABASE_URL);
const character = createCharacterClient(env.CHARACTER_SERVICE_URL, env.INTERNAL_TOKEN);

const app = Fastify({ logger: true });

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

const ChallengeSchema = z.object({
  challengerCharacterId: z.string().uuid(),
  opponentCharacterId: z.string().uuid(),
});

const ActionSchema = z.object({
  actorCharacterId: z.string().uuid(),
});

app.get("/health", async () => ({ ok: true }));

function now() { return new Date(); }
function secondsBetween(a: Date | null, b: Date) {
  if (!a) return Infinity;
  return (b.getTime() - a.getTime()) / 1000;
}

function duelExpired(startedAt: Date) {
  return (Date.now() - startedAt.getTime()) > 5 * 60 * 1000;
}

async function loadDuel(duelId: string) {
  const d = await queryOne<any>(pool, "SELECT * FROM duels WHERE id=$1", [duelId]);
  return d;
}

function actorIsChallenger(duel: any, actorId: string) {
  return duel.challenger_character_id === actorId;
}

function getCooldownFields(isChallenger: boolean, action: "attack"|"cast"|"heal") {
  const prefix = isChallenger ? "challenger" : "opponent";
  return `${prefix}_last_${action}`;
}

function getHpField(isChallenger: boolean) {
  return isChallenger ? "challenger_hp" : "opponent_hp";
}

function getEnemyHpField(isChallenger: boolean) {
  return isChallenger ? "opponent_hp" : "challenger_hp";
}

function getStats(isChallenger: boolean, duel: any) {
  const prefix = isChallenger ? "challenger" : "opponent";
  return {
    strength: duel[`${prefix}_strength`],
    agility: duel[`${prefix}_agility`],
    intelligence: duel[`${prefix}_intelligence`],
    faith: duel[`${prefix}_faith`],
  };
}

async function finishDuel(duel: any, winnerCharacterId: string | null) {
  const status = winnerCharacterId ? "Finished" : "Draw";
  await pool.query(
    "UPDATE duels SET status=$1, ended_at=NOW(), winner_character_id=$2 WHERE id=$3",
    [status, winnerCharacterId, duel.id]
  );
}

app.post("/api/challenge", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;

  const body = ChallengeSchema.parse(req.body);

  // Pull snapshots
  const challengerSnap = await character.snapshot(body.challengerCharacterId);
  const opponentSnap = await character.snapshot(body.opponentCharacterId);

  // Only the owner can initiate
  if (challengerSnap.createdBy !== user.sub) {
    return reply.code(403).send({ error: "FORBIDDEN" });
  }

  const cs = challengerSnap.calculatedStats;
  const os = opponentSnap.calculatedStats;

  // Use snapshot health as starting HP
  const row = await queryOne<{ id: string }>(
    pool,
    `INSERT INTO duels(
      challenger_character_id, opponent_character_id, challenger_user_id,
      challenger_strength, challenger_agility, challenger_intelligence, challenger_faith,
      opponent_strength, opponent_agility, opponent_intelligence, opponent_faith,
      challenger_hp, opponent_hp
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      body.challengerCharacterId, body.opponentCharacterId, user.sub,
      cs.strength, cs.agility, cs.intelligence, cs.faith,
      os.strength, os.agility, os.intelligence, os.faith,
      challengerSnap.health, opponentSnap.health
    ]
  );

  return reply.code(201).send({ duelId: row!.id });
});

async function ensureParticipantAndOwner(user: JwtPayload, duel: any, actorCharacterId: string) {
  const isParticipant = actorCharacterId === duel.challenger_character_id || actorCharacterId === duel.opponent_character_id;
  if (!isParticipant) return { ok: false as const, error: "NOT_A_PARTICIPANT" };

  // challenger user id is stored; for opponent, we must ask Character Service once (on demand)
  if (actorCharacterId === duel.challenger_character_id) {
    if (duel.challenger_user_id !== user.sub) return { ok: false as const, error: "FORBIDDEN" };
    return { ok: true as const, actorIsChallenger: true };
  } else {
    const snap = await character.snapshot(actorCharacterId);
    if (snap.createdBy !== user.sub && user.role !== "GameMaster") return { ok: false as const, error: "FORBIDDEN" };
    return { ok: true as const, actorIsChallenger: false };
  }
}

async function applyAction(duelId: string, action: "attack"|"cast"|"heal", actorId: string) {
  const duel = await loadDuel(duelId);
  if (!duel) return { status: 404, body: { error: "DUEL_NOT_FOUND" } };

  if (duel.status !== "Active") return { status: 400, body: { error: "DUEL_NOT_ACTIVE" } };

  const startedAt = new Date(duel.started_at);
  if (duelExpired(startedAt)) {
    await finishDuel(duel, null);
    return { status: 200, body: { status: "Draw" } };
  }

  const isChallenger = actorIsChallenger(duel, actorId);

  const cooldownField = getCooldownFields(isChallenger, action);
  const lastAt: Date | null = duel[cooldownField] ? new Date(duel[cooldownField]) : null;

  const t = now();
  const need = action === "attack" ? 1 : 2;
  if (secondsBetween(lastAt, t) < need) {
    return { status: 429, body: { error: "COOLDOWN" } };
  }

  const stats = getStats(isChallenger, duel);

  let amount = 0;
  if (action === "attack") amount = stats.strength + stats.agility;
  if (action === "cast") amount = 2 * stats.intelligence;
  if (action === "heal") amount = stats.faith;

  // mutate duel state
  const hpField = getHpField(isChallenger);
  const enemyHpField = getEnemyHpField(isChallenger);

  let newSelfHp = duel[hpField] as number;
  let newEnemyHp = duel[enemyHpField] as number;

  if (action === "heal") {
    newSelfHp = newSelfHp + amount;
  } else {
    newEnemyHp = Math.max(0, newEnemyHp - amount);
  }

  await pool.query("BEGIN");
  try {
    await pool.query(
      `UPDATE duels SET ${hpField}=$1, ${enemyHpField}=$2, ${cooldownField}=NOW() WHERE id=$3`,
      [newSelfHp, newEnemyHp, duelId]
    );
    await pool.query(
      "INSERT INTO duel_actions(duel_id, actor_character_id, action_type, amount) VALUES($1,$2,$3,$4)",
      [duelId, actorId, action, amount]
    );
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  // check win
  if (action !== "heal" && newEnemyHp === 0) {
    const winnerId = actorId;
    const loserId = isChallenger ? duel.opponent_character_id : duel.challenger_character_id;

    await finishDuel(duel, winnerId);

    // notify Character Service to resolve loot
    const loot = await character.resolveDuel({ duelId, winnerCharacterId: winnerId, loserCharacterId: loserId });

    return { status: 200, body: { status: "Finished", winnerCharacterId: winnerId, loot } };
  }

  return {
    status: 200,
    body: {
      status: "Active",
      action,
      amount,
      duelId,
      challengerHp: isChallenger ? newSelfHp : newEnemyHp,
      opponentHp: isChallenger ? newEnemyHp : newSelfHp,
    },
  };
}

app.post("/api/:duelId/attack", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  const duelId = (req.params as any).duelId as string;
  const body = ActionSchema.parse(req.body);

  const duel = await loadDuel(duelId);
  if (!duel) return reply.code(404).send({ error: "DUEL_NOT_FOUND" });

  const chk = await ensureParticipantAndOwner(user, duel, body.actorCharacterId);
  if (!chk.ok) return reply.code(chk.error === "NOT_A_PARTICIPANT" ? 403 : 403).send({ error: chk.error });

  const res = await applyAction(duelId, "attack", body.actorCharacterId);
  return reply.code(res.status).send(res.body);
});

app.post("/api/:duelId/cast", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  const duelId = (req.params as any).duelId as string;
  const body = ActionSchema.parse(req.body);

  const duel = await loadDuel(duelId);
  if (!duel) return reply.code(404).send({ error: "DUEL_NOT_FOUND" });

  const chk = await ensureParticipantAndOwner(user, duel, body.actorCharacterId);
  if (!chk.ok) return reply.code(403).send({ error: chk.error });

  const res = await applyAction(duelId, "cast", body.actorCharacterId);
  return reply.code(res.status).send(res.body);
});

app.post("/api/:duelId/heal", async (req, reply) => {
  const user = requireAuth(req, reply);
  if (!user) return;
  const duelId = (req.params as any).duelId as string;
  const body = ActionSchema.parse(req.body);

  const duel = await loadDuel(duelId);
  if (!duel) return reply.code(404).send({ error: "DUEL_NOT_FOUND" });

  const chk = await ensureParticipantAndOwner(user, duel, body.actorCharacterId);
  if (!chk.ok) return reply.code(403).send({ error: chk.error });

  const res = await applyAction(duelId, "heal", body.actorCharacterId);
  return reply.code(res.status).send(res.body);
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
