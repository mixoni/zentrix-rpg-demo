import { Pool } from "pg";
import { queryOne } from "../db";

export type DuelStatus = "Active" | "Finished" | "Draw";


export type HpFieldSql = "challenger_hp" | "opponent_hp";
export type CooldownFieldSql =
  | "challenger_last_attack"
  | "challenger_last_cast"
  | "challenger_last_heal"
  | "opponent_last_attack"
  | "opponent_last_cast"
  | "opponent_last_heal";


const VALID_HP_FIELDS: ReadonlySet<HpFieldSql> = new Set(["challenger_hp", "opponent_hp"]);
const VALID_COOLDOWN_FIELDS: ReadonlySet<CooldownFieldSql> = new Set([
  "challenger_last_attack",
  "challenger_last_cast",
  "challenger_last_heal",
  "opponent_last_attack",
  "opponent_last_cast",
  "opponent_last_heal",
]);


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

export async function applyActionTx(
  pool: Pool,
  args: {
    duelId: string;
    hpFieldSql: HpFieldSql;
    enemyHpFieldSql: HpFieldSql;
    cooldownFieldSql: CooldownFieldSql;
    cooldownSeconds: number;      
    newSelfHp: number;
    newEnemyHp: number;
    actorId: string;
    action: "attack" | "cast" | "heal";
    amount: number;
  }
) {
  if (!VALID_HP_FIELDS.has(args.hpFieldSql)) throw new Error("Invalid HP field");
  if (!VALID_HP_FIELDS.has(args.enemyHpFieldSql)) throw new Error("Invalid enemy HP field");
  if (!VALID_COOLDOWN_FIELDS.has(args.cooldownFieldSql)) throw new Error("Invalid cooldown field");
  if (args.hpFieldSql === args.enemyHpFieldSql) throw new Error("HP fields cannot be the same");

  await pool.query("BEGIN");
  try {
    const upd = await pool.query(
      `UPDATE duels
       SET ${args.hpFieldSql}=$1,
           ${args.enemyHpFieldSql}=$2,
           ${args.cooldownFieldSql}=NOW()
       WHERE id=$3
         AND status='Active'
         AND (
           ${args.cooldownFieldSql} IS NULL
           OR ${args.cooldownFieldSql} <= NOW() - ($4::int * interval '1 second')
         )
       RETURNING id`,
      [args.newSelfHp, args.newEnemyHp, args.duelId, args.cooldownSeconds]
    );

    if (upd.rowCount === 0) {
      await pool.query("ROLLBACK");
      return { ok: false as const };
    }

    await pool.query(
      `INSERT INTO duel_actions(duel_id, actor_character_id, action_type, amount)
       VALUES($1,$2,$3,$4)`,
      [args.duelId, args.actorId, args.action, args.amount]
    );

    await pool.query("COMMIT");
    return { ok: true as const };
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}


