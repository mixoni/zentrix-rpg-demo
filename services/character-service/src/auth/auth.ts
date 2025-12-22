import { getBearerToken, verifyJwt, Role, JwtPayload } from "../jwt";

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

export function requireRole(user: JwtPayload, role: Role, reply: any) {
  if (user.role !== role) {
    reply.code(403).send({ error: "FORBIDDEN" });
    return false;
  }
  return true;
}

export function isOwnerOrGM(user: JwtPayload, ownerId: string) {
  return user.role === "GameMaster" || user.sub === ownerId;
}
