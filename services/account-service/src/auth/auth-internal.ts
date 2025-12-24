export function requireInternal(req: any, reply: any, internalToken: string) {
    const token = req.headers["x-internal-token"];
    if (!token || token !== internalToken) {
      reply.code(401).send({ error: "UNAUTHORIZED_INTERNAL" });
      return false;
    }
    return true;
  }
  