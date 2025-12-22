import { Pool } from "pg";
import { queryOne } from "../db";

export type DuelStatus = "Active" | "Finished" | "Draw";

export async function getById(pool: Pool, duelId: string) {
  return queryOne<any>(pool, "SELECT * FROM duels WHERE id=$1", [duelId]);
}

export async function create(pool: Pool, args: {
  challengerCharacterId: string;
  opponentCharacterId: string;
  challengerUserId: string;

  challengerStrength: number;
  challengerAgility: number;
  challengerIntelligence: number;
  challengerFaith: number;

  opponentStrength: number;
  opponentAgility: number;
  opponentIntelligence: number;
  opponentFaith: number;

  challengerHp: number;
  opponentHp: number;
}) {
  return queryOne<{ id: string }>(
    pool,
    `INSERT INTO duels(
      challenger_character_id, opponent_character_id, challenger_user_id,
      challenger_strength, challenger_agility, challenger_intelligence, challenger_faith,
      opponent_strength, opponent_agility, opponent_intelligence, opponent_faith,
      challenger_hp, opponent_hp
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      args.challengerCharacterId, args.opponentCharacterId, args.challengerUserId,
      args.challengerStrength, args.challengerAgility, args.challengerIntelligence, args.challengerFaith,
      args.opponentStrength, args.opponentAgility, args.opponentIntelligence, args.opponentFaith,
      args.challengerHp, args.opponentHp
    ]
  );
}

export async function finish(pool: Pool, duelId: string, winnerCharacterId: string | null) {
  const status: DuelStatus = winnerCharacterId ? "Finished" : "Draw";
  await pool.query(
    "UPDATE duels SET status=$1, ended_at=NOW(), winner_character_id=$2 WHERE id=$3",
    [status, winnerCharacterId, duelId]
  );
}

export async function applyActionTx(pool: Pool, args: {
  duelId: string;
  hpFieldSql: string;       
  enemyHpFieldSql: string;  
  cooldownFieldSql: string;  
  newSelfHp: number;
  newEnemyHp: number;
  actorId: string;
  action: "attack" | "cast" | "heal";
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
