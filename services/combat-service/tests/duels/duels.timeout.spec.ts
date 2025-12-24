import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/testApp";
import * as DuelsRepo from "../../src/repos/duels.repo";
import { signJwt } from "../../src/jwt";
import { CHAR_A, CHAR_B, DUEL_ID, JWT_SECRET, USER_1 } from "../helpers/fixtures";


vi.mock("../../src/repos/duels.repo", async () => {
  const actual = await vi.importActual<any>("../../src/repos/duels.repo");
  return {
    ...actual,
    getById: vi.fn(),
    finish: vi.fn(),
    applyActionTx: vi.fn(),
  };
});

function authHeader() {
  const token = signJwt({ sub: USER_1, role: "User", username: "test" } as any, JWT_SECRET, "2h");
  return { authorization: `Bearer ${token}` };
}

function expiredDuel() {
  return {
    id: DUEL_ID,
    status: "Active",
    started_at: new Date(Date.now() - 10*60_000).toISOString(), // 10 min ago

    challenger_character_id: CHAR_A,
    opponent_character_id: CHAR_B,
    challenger_user_id: USER_1,

    challenger_strength: 5,
    challenger_agility: 5,
    challenger_intelligence: 5,
    challenger_faith: 5,

    opponent_strength: 5,
    opponent_agility: 5,
    opponent_intelligence: 5,
    opponent_faith: 5,

    challenger_hp: 30,
    opponent_hp: 30,

    challenger_last_attack: null,
    challenger_last_cast: null,
    challenger_last_heal: null,
    opponent_last_attack: null,
    opponent_last_cast: null,
    opponent_last_heal: null,
  };
}

describe("Duels timeout", () => {
  beforeEach(() => vi.resetAllMocks());

  it("409 Draw TIMEOUT and finish called with null winner", async () => {
    (DuelsRepo.getById as any).mockResolvedValue(expiredDuel());

    const characterClient = {
      snapshot: vi.fn(async (id: string) => ({ id, createdBy: USER_1 })),
      resolveDuel: vi.fn(),
    };

    const app = buildTestApp({
      pool: {},
      jwtSecret: JWT_SECRET,
      duelTimeoutMs: 1, // 1ms
      characterClient,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/${DUEL_ID}/attack`,
      headers: authHeader(),
      payload: { actorCharacterId: CHAR_A },
    });

    expect(res.statusCode).toBe(409);

    const body = JSON.parse(res.body);
    expect(body.status).toBe("Draw");
    expect(body.reason).toBe("TIMEOUT");

    expect(DuelsRepo.finish).toHaveBeenCalledTimes(1);
    // finish(pool, duelId, winnerCharacterId|null)
    expect((DuelsRepo.finish as any).mock.calls[0][2]).toBe(null);

    await app.close();
  });
});
