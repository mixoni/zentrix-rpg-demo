import { requireInternal } from "../auth/auth-internal";
import { getInternalUserById } from "../services/users.service";

type Deps = { pool: any; internalToken?: string };

export async function registerInternalRoutes(app: any, deps: Deps) {
  app.get("/internal/users/:id", async (req: any, reply: any) => {
    if (!requireInternal(req, reply, deps.internalToken || "")) return;

    const id = (req.params as any).id as string;
    const res = await getInternalUserById(deps.pool, id);
    return reply.code(res.status).send(res.body);
  });
}
