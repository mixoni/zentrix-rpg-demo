import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { signJwt, Role } from "../jwt";
import * as UsersRepo from "../repos/users.repo";

export async function register(args: {
  pool: Pool;
  username: string;
  password: string;
  role: Role;
}) {
  const passwordHash = await bcrypt.hash(args.password, 10);

  try {
    const row = await UsersRepo.insert(args.pool, {
      username: args.username,
      passwordHash,
      role: args.role,
    });

    return { status: 201, body: { id: row!.id, username: args.username, role: args.role } };
  } catch (e: any) {
    if (String(e?.message ?? "").includes("duplicate")) {
      return { status: 409, body: { error: "USERNAME_TAKEN" } };
    }
    return { status: 500, body: { error: "INTERNAL_ERROR" } };
  }
}

export async function login(args: {
  pool: Pool;
  username: string;
  password: string;
  jwtSecret: string;
}) {
  const user = await UsersRepo.findByUsername(args.pool, args.username);
  if (!user) return { status: 401, body: { error: "INVALID_CREDENTIALS" } };

  const ok = await bcrypt.compare(args.password, user.password_hash);
  if (!ok) return { status: 401, body: { error: "INVALID_CREDENTIALS" } };

  const token = signJwt({ sub: user.id, role: user.role, username: user.username }, args.jwtSecret, "2h");
  return { status: 200, body: { token, user: { id: user.id, username: user.username, role: user.role } } };
}
