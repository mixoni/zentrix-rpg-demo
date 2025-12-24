import { RegisterSchema, LoginSchema } from "../validation/auth.schemas";
import { Role } from "../jwt";
import * as AuthService from "../services/auth.service";

type Deps = { pool: any; jwtSecret: string };

export async function registerAuthRoutes(app: any, deps: Deps) {
  app.post("/api/register", async (req: any, reply: any) => {
    const body = RegisterSchema.parse(req.body);
    const role: Role = body.role ?? "User";

    const res = await AuthService.register({
      pool: deps.pool,
      username: body.username,
      password: body.password,
      role,
    });

    return reply.code(res.status).send(res.body);
  });

  app.post("/api/login", async (req: any, reply: any) => {
    const body = LoginSchema.parse(req.body);

    const res = await AuthService.login({
      pool: deps.pool,
      username: body.username,
      password: body.password,
      jwtSecret: deps.jwtSecret,
    });

    return reply.code(res.status).send(res.body);
  });
}
