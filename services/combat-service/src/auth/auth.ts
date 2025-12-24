import { getBearerToken, verifyJwt, JwtPayload } from "../jwt";

export function requireAuth(req: any, reply: any, jwtSecret: string): JwtPayload | null {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    reply.code(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
  try {
    return verifyJwt(token, jwtSecret);
  } catch {
    reply.code(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
}
