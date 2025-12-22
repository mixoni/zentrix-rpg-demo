import { Pool } from "pg";
import { queryOne } from "../db";

export type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: "User" | "GameMaster";
};

export async function findByUsername(pool: Pool, username: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    pool,
    "SELECT id, username, password_hash, role FROM users WHERE username=$1",
    [username]
  );
}

export async function findById(pool: Pool, id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    pool,
    "SELECT id, username, password_hash, role FROM users WHERE id=$1",
    [id]
  );
}

export async function insert(pool: Pool, args: {
  username: string;
  passwordHash: string;
  role: "User" | "GameMaster";
}): Promise<{ id: string } | null> {
  return queryOne<{ id: string }>(
    pool,
    "INSERT INTO users(username, password_hash, role) VALUES($1,$2,$3) RETURNING id",
    [args.username, args.passwordHash, args.role]
  );
}
