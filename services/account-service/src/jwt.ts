import jwt, { Secret, SignOptions } from "jsonwebtoken";

export type Role = "User" | "GameMaster";

export type JwtPayload = {
  sub: string; // userId
  role: Role;
  username: string;
};

export function signJwt(payload: JwtPayload, secret: string, expiresIn: string = "2h") {
  return jwt.sign(payload, secret as Secret,  { expiresIn } as SignOptions);
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== "object" || decoded === null) throw new Error("Invalid token payload");
  const p = decoded as any;
  if (!p.sub || !p.role || !p.username) throw new Error("Missing claims");
  return p as JwtPayload;
}

export function getBearerToken(authHeader?: string) {
  if (!authHeader) return null;
  const [t, v] = authHeader.split(" ");
  if (t?.toLowerCase() !== "bearer" || !v) return null;
  return v;
}
