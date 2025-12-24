import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/testApp";
import * as DuelsRepo from "../../src/repos/duels.repo";
import { signJwt } from "../../src/jwt";
import { CHAR_A, CHAR_B, DUEL_ID, JWT_SECRET, USER_1, USER_2 } from "../helpers/fixtures";


vi.mock("../../src/repos/duels.repo", async () => {
  const actual = await vi.importActual<any>("../../src/repos/duels.repo");
  return {
    ...actual,
    getById: vi.fn(),
    create: vi.fn(),
    finish: vi.fn(),
    applyActionTx: vi.fn(),
  };
});

function authHeader(payload: { sub: string; role: "User" | "GameMaster"; username: string }) {
  const token = signJwt(payload as any, JWT_SECRET, "2h");
  return { authorization: `Bearer ${token}` };
}

function activeDuel(overrides: any = {}) {
  return {
    id: DUEL_ID,
    status: "Active",
    started_at: new Date().toISOString(),

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

    ...overrides,
  };
}

describe("Duels actions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("FORBIDDEN: opponent (not owner, not GM) tries to attack", async () => {
    (DuelsRepo.getById as any).mockResolvedValue(
      activeDuel({
        challenger_user_id: USER_1,
        opponent_character_id: CHAR_B,
      })
    );

    const characterClient = {
      // opponent snapshot says owner is USER_1, but request user is USER_2 => FORBIDDEN
      snapshot: vi.fn(async (id: string) => ({ id, createdBy: USER_1 })),
      resolveDuel: vi.fn(async () => ({})),
    };

    const app = buildTestApp({
      pool: {},
      jwtSecret: JWT_SECRET,
      duelTimeoutMs: 5 * 60_000,
      characterClient,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/${DUEL_ID}/attack`,
      headers: authHeader({ sub: USER_2, role: "User", username: "u2" }),
      payload: { actorCharacterId: CHAR_B },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe("FORBIDDEN");

    await app.close();
  });

  it("DUEL_NOT_ACTIVE -> 409", async () => {
    (DuelsRepo.getById as any).mockResolvedValue(activeDuel({ status: "Finished" }));

    const characterClient = {
      snapshot: vi.fn(async (id: string) => ({ id, createdBy: USER_1 })),
      resolveDuel: vi.fn(async () => ({})),
    };

    const app = buildTestApp({
      pool: {},
      jwtSecret: JWT_SECRET,
      duelTimeoutMs: 5 * 60_000,
      characterClient,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/${DUEL_ID}/attack`,
      headers: authHeader({ sub: USER_1, role: "User", username: "u1" }),
      payload: { actorCharacterId: CHAR_A },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toBe("DUEL_NOT_ACTIVE");

    await app.close();
  });

  it("calls characterClient.resolveDuel when HP reaches 0", async () => {
    // opponent has 1 HP so attack should kill (attack amount = strength+agility = 10)
    (DuelsRepo.getById as any).mockResolvedValue(activeDuel({ opponent_hp: 1 }));

    const resolveDuel = vi.fn(async () => ({ transferred: { itemInstanceId: "i1", itemId: "it1" } }));
    const characterClient = {
      snapshot: vi.fn(async (id: string) => ({ id, createdBy: USER_1 })),
      resolveDuel,
    };

    const app = buildTestApp({
      pool: {},
      jwtSecret: JWT_SECRET,
      duelTimeoutMs: 5 * 60_000,
      characterClient,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/${DUEL_ID}/attack`,
      headers: authHeader({ sub: USER_1, role: "User", username: "u1" }),
      payload: { actorCharacterId: CHAR_A },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("Finished");
    expect(resolveDuel).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
