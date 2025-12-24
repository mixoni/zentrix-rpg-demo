import { signJwt, JwtPayload } from "../../src/jwt";

export const TEST_JWT_SECRET = "test-secret";

export function token(payload: Partial<JwtPayload> = {}) {
  return signJwt(
    {
      sub: payload.sub ?? "user-1",
      role: payload.role ?? "User",
      username: payload.username ?? "test",
    },
    TEST_JWT_SECRET,
    "2h"
  );
}

export function authHeader(t: string) {
  return { authorization: `Bearer ${t}` };
}
