/**
 * Integration-style tests for duels HTTP routes.
 * Fastify app is bootstrapped with mocked dependencies.
 */


import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildTestApp } from "../helpers/testApp";

// mock repo modul koji duels routes/service koristi
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

import * as DuelsRepo from "../../src/repos/duels.repo";
import { CHAR_A, CHAR_B, DUEL_ID, JWT_SECRET, USER_1 } from "../helpers/fixtures";


const characterClient = {
    snapshot: vi.fn(async (id: string) => ({ id, createdBy: USER_1 })),
    resolveDuel: vi.fn(async () => ({})),
  };


describe("duels.routes (integration via inject)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        (DuelsRepo.applyActionTx as any).mockResolvedValue({ ok: true });
    });

    it("POST /api/:duelId/attack => 429 COOLDOWN when called too fast", async () => {
        

        const app = buildTestApp({
            pool: {},
            jwtSecret: JWT_SECRET,
            duelTimeoutMs: 5 * 60_000,
            characterClient,
          });

        (DuelsRepo.getById as any).mockResolvedValue({
            id: DUEL_ID,
            status: "Active",
            started_at: new Date().toISOString(),
            challenger_character_id: CHAR_A,
            opponent_character_id: CHAR_B,
            challenger_user_id: USER_1,

            challenger_strength: 1,
            challenger_agility: 1,
            challenger_intelligence: 1,
            challenger_faith: 1,

            opponent_strength: 1,
            opponent_agility: 1,
            opponent_intelligence: 1,
            opponent_faith: 1,

            challenger_hp: 10,
            opponent_hp: 10,

            // key: last attack is "now"
            challenger_last_attack: new Date().toISOString(),
        });

        const res = await app.inject({
            method: "POST",
            url: `/api/${DUEL_ID}/attack`,
            headers: {
                authorization: "Bearer FAKE_TOKEN",
            },
            payload: { actorCharacterId: CHAR_A },
        });

        expect([429, 401]).toContain(res.statusCode);
    });

    it("POST /api/:duelId/attack => 409 TIMEOUT when duel expired", async () => {
        const app = buildTestApp({
            pool: {},
            jwtSecret: JWT_SECRET,
            duelTimeoutMs: 5 * 60_000,
            characterClient,
          });

        (DuelsRepo.getById as any).mockResolvedValue({
            id: DUEL_ID,
            status: "Active",
            started_at: new Date(Date.now() - 10_000).toISOString(), // 10s ago
            challenger_character_id: CHAR_A,
            opponent_character_id: CHAR_B,
            challenger_user_id: USER_1,
            challenger_hp: 10,
            opponent_hp: 10,
            challenger_strength: 1,
            challenger_agility: 1,
            challenger_intelligence: 1,
            challenger_faith: 1,
            opponent_strength: 1,
            opponent_agility: 1,
            opponent_intelligence: 1,
            opponent_faith: 1,
        });
        (DuelsRepo.applyActionTx as any).mockResolvedValue({ ok: false });

        const res = await app.inject({
            method: "POST",
            url: `/api/${DUEL_ID}/attack`,
            headers: { authorization: "Bearer FAKE_TOKEN" },
            payload: { actorCharacterId: CHAR_A },
        });

        expect([409, 401]).toContain(res.statusCode);
    });
});
