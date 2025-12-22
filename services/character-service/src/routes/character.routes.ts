import { FastifyInstance } from "fastify";
import * as CharacterService from "../services/character.service";
import { requireAuth, requireRole } from "../auth/auth";
import { CreateCharacterSchema } from "../validation/character.schemas";
import * as CharactersRepo from "../repos/characters.repo";
import * as ClassesRepo from "../repos/classes.repo";

export async function registerCharacterRoutes(app: FastifyInstance, deps: any) {
  const { pool, redis, jwtSecret } = deps;

  app.get("/api/character", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;
    if (!requireRole(user, "GameMaster", reply)) return;

    return CharactersRepo.listForGM(pool);
  });

  app.get("/api/character/:id", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;

    const id = (req.params as any).id;
    const res = await CharacterService.getCharacterDetailsCached({
      pool,
      redis,
      characterId: id,
      user,
    });

    return reply.code(res.status).send(res.body);
  });

  app.post("/api/character", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;

    const body = CreateCharacterSchema.parse(req.body);
    const ok = await ClassesRepo.existsById(pool, body.classId);
    if (!ok) return reply.code(400).send({ error: "INVALID_CLASS" });

    const row = await CharactersRepo.insert(pool, {
      ...body,
      createdBy: user.sub,
    });

    return reply.code(201).send({ id: row!.id });
  });
}
