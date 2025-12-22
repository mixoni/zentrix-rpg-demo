import { Pool } from "pg";
import { queryOne } from "../db";

export async function insertDuel(pool: Pool, args: {
  challengerCharacterId: string;
  opponentCharacterId: string;
  challengerUserId: string;
  challengerStats: { strength: number; agility: number; intelligence: number; faith: number };
  opponentStats: { strength: number; agility: number; intelligence: number; faith: number };
  challengerHp: number;
  opponentHp: number;
}) {
  const a = args;
  return queryOne<{ id: string }>(
    pool,
    `INSERT INTO duels(
      challenger_character_id, opponent_character_id, challenger_user_id,
      challenger_strength, challenger_agility, challenger_intelligence, challenger_faith,
      opponent_strength, opponent_agility, opponent_intelligence, opponent_faith,
      challenger_hp, opponent_hp
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      a.challengerCharacterId, a.opponentCharacterId, a.challengerUserId,
      a.challengerStats.strength, a.challengerStats.agility, a.challengerStats.intelligence, a.challengerStats.faith,
      a.opponentStats.strength, a.opponentStats.agility, a.opponentStats.intelligence, a.opponentStats.faith,
      a.challengerHp, a.opponentHp
    ]
  );
}

export async function getDuelById(pool: Pool, duelId: string) {
  return queryOne<any>(pool, "SELECT * FROM duels WHERE id=$1", [duelId]);
}

export async function setDuelFinished(pool: Pool, duelId: string, status: "Finished" | "Draw", winnerCharacterId: string | null) {
  await pool.query(
    "UPDATE duels SET status=$1, ended_at=NOW(), winner_character_id=$2 WHERE id=$3",
    [status, winnerCharacterId, duelId]
  );
}

export async function updateDuelStateAndInsertAction(pool: Pool, args: {
  duelId: string;
  hpFieldSql: string;
  enemyHpFieldSql: string;
  cooldownFieldSql: string;
  newSelfHp: number;
  newEnemyHp: number;
  actorId: string;
  action: "attack"|"cast"|"heal";
  amount: number;
}) {
  await pool.query("BEGIN");
  try {
    await pool.query(
      `UPDATE duels SET ${args.hpFieldSql}=$1, ${args.enemyHpFieldSql}=$2, ${args.cooldownFieldSql}=NOW() WHERE id=$3`,
      [args.newSelfHp, args.newEnemyHp, args.duelId]
    );
    await pool.query(
      "INSERT INTO duel_actions(duel_id, actor_character_id, action_type, amount) VALUES($1,$2,$3,$4)",
      [args.duelId, args.actorId, args.action, args.amount]
    );
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}
