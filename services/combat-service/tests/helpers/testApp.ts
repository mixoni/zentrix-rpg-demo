import Fastify, { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "../../src/routes/health.routes";
import { registerDuelsRoutes } from "../../src/routes/duels.routes";

export function buildTestApp(args: {
  pool: any;
  jwtSecret: string;
  duelTimeoutMs: number;
  characterClient: any;
}): FastifyInstance {
  const app = Fastify({ logger: false });

  registerHealthRoutes(app);
  registerDuelsRoutes(app, {
    pool: args.pool,
    jwtSecret: args.jwtSecret,
    duelTimeoutMs: args.duelTimeoutMs,
    characterClient: args.characterClient,
  });

  return app;
}
