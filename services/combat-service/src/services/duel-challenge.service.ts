import * as DuelsRepo from "../repos/duels.repo";
import { JwtPayload } from "../jwt";

export async function challengeDuel(args: {
  pool: any;
  user: JwtPayload;
  challengerCharacterId: string;
  opponentCharacterId: string;
  characterClient: { snapshot: (id: string) => Promise<any> };
}) {
  const { pool, user, challengerCharacterId, opponentCharacterId, characterClient } = args;

  const challengerSnap = await characterClient.snapshot(challengerCharacterId);
  const opponentSnap = await characterClient.snapshot(opponentCharacterId);

  if (challengerSnap.createdBy !== user.sub) {
    return { status: 403, body: { error: "FORBIDDEN" } };
  }

  const cs = challengerSnap.calculatedStats;
  const os = opponentSnap.calculatedStats;

  const row = await DuelsRepo.create(pool, {
    challengerCharacterId,
    opponentCharacterId,
    challengerUserId: user.sub,

    challengerStrength: cs.strength,
    challengerAgility: cs.agility,
    challengerIntelligence: cs.intelligence,
    challengerFaith: cs.faith,

    opponentStrength: os.strength,
    opponentAgility: os.agility,
    opponentIntelligence: os.intelligence,
    opponentFaith: os.faith,

    challengerHp: challengerSnap.health,
    opponentHp: opponentSnap.health,
  });

  return { status: 201, body: { duelId: row!.id } };
}
