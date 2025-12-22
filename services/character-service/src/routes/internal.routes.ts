import { FastifyInstance } from "fastify";
import { requireInternal } from "../auth/auth-internal";
import * as SnapshotService from "../services/internal/snapshot.service";
import * as DuelResolveService from "../services/internal/duelResolve.service";
import { ResolveDuelSchema } from "../validation/internal.schemas";

export async function registerInternalRoutes(app: FastifyInstance, deps: any) {
  const { pool, redis, internalToken } = deps;

  app.get("/internal/characters/:id/snapshot", async (req, reply) => {
    if (!requireInternal(req, reply, internalToken)) return;

    const id = (req.params as any).id;
    const res = await SnapshotService.getCharacterSnapshot(pool, id);
    return reply.code(res.status).send(res.body);
  });

  app.post("/internal/duels/resolve", async (req, reply) => {
    if (!requireInternal(req, reply, internalToken)) return;

    const body = ResolveDuelSchema.parse(req.body);
    const res = await DuelResolveService.resolveDuel({ pool, redis, ...body });
    return reply.code(res.status).send(res.body);
  });
}
