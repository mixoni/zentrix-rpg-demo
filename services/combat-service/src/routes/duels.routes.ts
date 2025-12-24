import { z } from "zod";
import { challengeDuel } from "../services/duel-challenge.service";
import { applyDuelAction } from "../services/duel-action.service";
import { requireAuth } from "../auth/auth";
import type { FastifyInstance } from "fastify"
import { ZodError } from "zod";

const ChallengeSchema = z.object({
  challengerCharacterId: z.string().uuid(),
  opponentCharacterId: z.string().uuid(),
});

const ActionSchema = z.object({
  actorCharacterId: z.string().uuid(),
});

type Deps = {
  pool: any;
  jwtSecret: string;
  duelTimeoutMs: number;
  characterClient: {
    snapshot: (id: string) => Promise<any>;
    resolveDuel: (body: {
      duelId: string;
      winnerCharacterId: string;
      loserCharacterId: string;
    }) => Promise<any>;
  };
};

export function registerErrorHandling(app: any) {
  app.setErrorHandler((err: any, _req: any, reply: any) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: err.errors });
    }
    app.log.error(err);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });
}

export async function registerDuelsRoutes(app: FastifyInstance, deps: Deps) {
  app.post("/api/challenge", async (req: any, reply: any) => {
    const user = requireAuth(req, reply, deps.jwtSecret);
    if (!user) return;

    const body = ChallengeSchema.parse(req.body);

    const res = await challengeDuel({
      pool: deps.pool,
      user,
      challengerCharacterId: body.challengerCharacterId,
      opponentCharacterId: body.opponentCharacterId,
      characterClient: deps.characterClient,
    });

    return reply.code(res.status).send(res.body);
  });

  const actionHandler =
    (action: "attack" | "cast" | "heal") => async (req: any, reply: any) => {
      const user = requireAuth(req, reply, deps.jwtSecret);
      if (!user) return;

      const duelId = (req.params as any).duelId as string;
      const body = ActionSchema.parse(req.body);

      const res = await applyDuelAction({
        pool: deps.pool,
        duelId,
        action,
        actorCharacterId: body.actorCharacterId,
        user,
        duelTimeoutMs: deps.duelTimeoutMs,
        characterClient: deps.characterClient,
      });

      return reply.code(res.status).send(res.body);
    };

  app.post("/api/:duelId/attack", actionHandler("attack"));
  app.post("/api/:duelId/cast", actionHandler("cast"));
  app.post("/api/:duelId/heal", actionHandler("heal"));
}
