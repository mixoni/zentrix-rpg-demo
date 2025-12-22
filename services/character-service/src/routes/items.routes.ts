import { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../auth/auth";
import { CreateItemSchema, GrantItemSchema, GiftItemSchema } from "../validation/items.schemas";
import * as ItemsService from "../services/items.service";
import * as InventoryService from "../services/inventory.service";

export async function registerItemsRoutes(app: FastifyInstance, deps: any) {
  const { pool, redis, jwtSecret } = deps;

  app.get("/api/items", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;
    if (!requireRole(user, "GameMaster", reply)) return;

    return ItemsService.listAll(pool);
  });

  app.get("/api/items/:id", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;

    const id = (req.params as any).id;
    const res = await ItemsService.getById(pool, id);
    return reply.code(res.status).send(res.body);
  });

  app.post("/api/items", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;
    if (!requireRole(user, "GameMaster", reply)) return;

    const body = CreateItemSchema.parse(req.body);
    const res = await ItemsService.create(pool, body);
    return reply.code(res.status).send(res.body);
  });

  app.post("/api/items/grant", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;
    if (!requireRole(user, "GameMaster", reply)) return;

    const body = GrantItemSchema.parse(req.body);
    const res = await InventoryService.InventoryGrantItem({ pool, redis, ...body });
    return reply.code(res.status).send(res.body);
  });

  app.post("/api/items/gift", async (req, reply) => {
    const user = requireAuth(req, reply, jwtSecret);
    if (!user) return;

    const body = GiftItemSchema.parse(req.body);
    const res = await InventoryService.giftItem({ pool, redis, user, ...body });
    return reply.code(res.status).send(res.body);
  });
}
