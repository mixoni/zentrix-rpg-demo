import { Pool } from "pg";
import * as UsersRepo from "../repos/users.repo";

export async function getInternalUserById(pool: Pool, id: string) {
  const user = await UsersRepo.findById(pool, id);
  if (!user) return { status: 404, body: { error: "NOT_FOUND" } };
  return { status: 200, body: user };
}
