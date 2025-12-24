import * as DuelsRepo from "../repos/duels.repo";
import { JwtPayload } from "../jwt";
import {
    DuelAction,
    cooldownSeconds,
    calculateAmount,
    applyHpChange,
    isCooldownActive,
    isDuelExpired,
    isWinningHit,
} from "../logic/duel.logic"
    ;
function actorIsChallenger(duel: any, actorId: string) {
    return duel.challenger_character_id === actorId;
}

function hpField(isChallenger: boolean): DuelsRepo.HpFieldSql {
    return isChallenger ? "challenger_hp" : "opponent_hp";
}
function enemyHpField(isChallenger: boolean): DuelsRepo.HpFieldSql {
    return isChallenger ? "opponent_hp" : "challenger_hp";
}
function cooldownField(isChallenger: boolean, action: DuelAction): DuelsRepo.CooldownFieldSql {
    const prefix = isChallenger ? "challenger" : "opponent";
    return `${prefix}_last_${action}` as DuelsRepo.CooldownFieldSql;
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

async function ensureParticipantAndOwner(args: {
    user: JwtPayload;
    duel: any;
    actorCharacterId: string;
    characterClient: { snapshot: (id: string) => Promise<any> };
}) {
    const { user, duel, actorCharacterId, characterClient } = args;

    const isParticipant =
        actorCharacterId === duel.challenger_character_id || actorCharacterId === duel.opponent_character_id;

    if (!isParticipant) return { ok: false as const, status: 403, body: { error: "NOT_A_PARTICIPANT" } };

    if (actorCharacterId === duel.challenger_character_id) {
        if (duel.challenger_user_id !== user.sub) return { ok: false as const, status: 403, body: { error: "FORBIDDEN" } };
        return { ok: true as const };
    }

    // opponent: allow owner or GM
    const snap = await characterClient.snapshot(actorCharacterId);
    if (snap.createdBy !== user.sub && user.role !== "GameMaster") {
        return { ok: false as const, status: 403, body: { error: "FORBIDDEN" } };
    }
    return { ok: true as const };
}

export async function applyDuelAction(args: {
    pool: any;
    duelId: string;
    action: DuelAction;
    actorCharacterId: string;
    user: JwtPayload;
    duelTimeoutMs: number;
    characterClient: {
        snapshot: (id: string) => Promise<any>;
        resolveDuel: (body: { duelId: string; winnerCharacterId: string; loserCharacterId: string }) => Promise<any>;
    };
}) {
    const { pool, duelId, action, actorCharacterId, user, duelTimeoutMs, characterClient } = args;

    const duel = await DuelsRepo.getById(pool, duelId);
    if (!duel) return { status: 404, body: { error: "DUEL_NOT_FOUND" } };

    const auth = await ensureParticipantAndOwner({ user, duel, actorCharacterId, characterClient });
    if (!auth.ok) return { status: auth.status, body: auth.body };

    if (duel.status !== "Active") {
        return { status: 409, body: { error: "DUEL_NOT_ACTIVE", message: "Duel is no longer active" } };
    }

    const startedAt = new Date(duel.started_at);
    if (isDuelExpired(startedAt, duelTimeoutMs)) {
        await DuelsRepo.finish(pool, duel.id, null);
        return {
            status: 409,
            body: { status: "Draw", reason: "TIMEOUT", message: "Duel has expired and can no longer accept actions" },
        };
    }

    const isChallenger = actorIsChallenger(duel, actorCharacterId);

    const cdField = cooldownField(isChallenger, action);
    const lastAt: Date | null = duel[cdField] ? new Date(duel[cdField]) : null;

    const cooldown = cooldownSeconds(action);
    if (isCooldownActive(lastAt, new Date(), cooldown)) {
        return { status: 429, body: { error: "COOLDOWN" } };
    }

    const stats = getStats(isChallenger, duel);
    const amount = calculateAmount(action, stats);

    const myHpField = hpField(isChallenger);
    const enemyField = enemyHpField(isChallenger);

    let newSelfHp = duel[myHpField] as number;
    let newEnemyHp = duel[enemyField] as number;

    if (action === "heal") newSelfHp += amount;
    else newEnemyHp = Math.max(0, newEnemyHp - amount);

    const tx = await DuelsRepo.applyActionTx(pool, {
        duelId,
        hpFieldSql: myHpField,
        enemyHpFieldSql: enemyField,
        cooldownFieldSql: cdField,
        cooldownSeconds: cooldown,
        newSelfHp,
        newEnemyHp,
        actorId: actorCharacterId,
        action,
        amount,
    });

    if (!tx.ok) {
        return { status: 429, body: { error: "COOLDOWN" } };
      }

    // win condition
    if (action !== "heal" && newEnemyHp === 0) {
        const winnerId = actorCharacterId;
        const loserId = isChallenger ? duel.opponent_character_id : duel.challenger_character_id;

        await DuelsRepo.finish(pool, duel.id, winnerId);
        const loot = await characterClient.resolveDuel({ duelId, winnerCharacterId: winnerId, loserCharacterId: loserId });

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
