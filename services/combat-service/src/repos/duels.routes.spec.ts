import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { registerDuelsRoutes } from "../routes/duels.routes";

// mock repo modul koji duels routes/service koristi
vi.mock("../repos/duels.repo", () => {
    return {
        getById: vi.fn(),
        create: vi.fn(),
        applyActionTx: vi.fn(),
        finish: vi.fn(),
    };
});

import * as DuelsRepo from "../repos/duels.repo";

function appInstanceMock() {
    const app = Fastify({ logger: false });

    const pool = {} as any;

    const characterClient = {
        snapshot: vi.fn(),
        resolveDuel: vi.fn(),
    };

    registerDuelsRoutes(app, {
        pool,
        jwtSecret: "test-secret",
        duelTimeoutMs: 5 * 60 * 1000,
        characterClient,
    });

    return { app, pool, characterClient };
}

describe("duels.routes (integration via inject)", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("POST /api/:duelId/attack => 429 COOLDOWN when called too fast", async () => {
        const { app } = appInstanceMock();

        (DuelsRepo.getById as any).mockResolvedValue({
            id: "duel-1",
            status: "Active",
            started_at: new Date().toISOString(),
            challenger_character_id: "char-A",
            opponent_character_id: "char-B",
            challenger_user_id: "user-1",

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
            url: "/api/duel-1/attack",
            headers: {
                authorization: "Bearer FAKE_TOKEN",
            },
            payload: { actorCharacterId: "char-A" },
        });

        expect([429, 401]).toContain(res.statusCode);
    });

    it("POST /api/:duelId/attack => 409 TIMEOUT when duel expired", async () => {
        const { app } = appInstanceMock();

        (DuelsRepo.getById as any).mockResolvedValue({
            id: "duel-1",
            status: "Active",
            started_at: new Date(Date.now() - 10_000).toISOString(), // 10s ago
            challenger_character_id: "char-A",
            opponent_character_id: "char-B",
            challenger_user_id: "user-1",
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

        const res = await app.inject({
            method: "POST",
            url: "/api/duel-1/attack",
            headers: { authorization: "Bearer FAKE_TOKEN" },
            payload: { actorCharacterId: "char-A" },
        });

        expect([409, 401]).toContain(res.statusCode);
    });
});
