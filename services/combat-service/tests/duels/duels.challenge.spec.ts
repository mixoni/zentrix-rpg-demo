import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildTestApp } from "../helpers/testApp";
import * as DuelsRepo from "../../src/repos/duels.repo";
import { signJwt } from "../../src/jwt";
import { JWT_SECRET } from "../helpers/fixtures";


vi.mock("../../src/repos/duels.repo", async () => {
  const actual = await vi.importActual<any>("../../src/repos/duels.repo");
  return {
    ...actual,
    create: vi.fn(),
  };
});

function authHeader(sub = "user-1") {
  const token = signJwt({ sub, role: "User", username: "test" } as any, JWT_SECRET, "2h");
  return { authorization: `Bearer ${token}` };
}

describe("POST /api/challenge", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("201 creates duel and returns duelId", async () => {
    (DuelsRepo.create as any).mockResolvedValue({ id: "duel-xyz" });

    const characterClient = {
      snapshot: vi.fn(async (id: string) => ({
        id,
        createdBy: "user-1",
        health: 30,
        calculatedStats: { strength: 5, agility: 5, intelligence: 5, faith: 5 },
      })),
      resolveDuel: vi.fn(),
    };

    const app = buildTestApp({
      pool: {},
      jwtSecret: JWT_SECRET,
      duelTimeoutMs: 5 * 60_000,
      characterClient,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/challenge",
      headers: authHeader("user-1"),
      payload: {
        challengerCharacterId: "00000000-0000-0000-0000-000000000001",
        opponentCharacterId: "00000000-0000-0000-0000-000000000002",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).duelId).toBe("duel-xyz");

    await app.close();
  });

  it("403 if challenger is not owner", async () => {
    const characterClient = {
      snapshot: vi.fn(async (id: string) => ({
        id,
        createdBy: "user-999", // not the caller
        health: 30,
        calculatedStats: { strength: 5, agility: 5, intelligence: 5, faith: 5 },
      })),
      resolveDuel: vi.fn(),
    };

    const app = buildTestApp({
      pool: {},
      jwtSecret: JWT_SECRET,
      duelTimeoutMs: 5 * 60_000,
      characterClient,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/challenge",
      headers: authHeader("user-1"),
      payload: {
        challengerCharacterId: "00000000-0000-0000-0000-000000000001",
        opponentCharacterId: "00000000-0000-0000-0000-000000000002",
      },
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error).toBe("FORBIDDEN");

    await app.close();
  });
});
