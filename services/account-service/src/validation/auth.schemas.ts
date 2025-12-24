import { z } from "zod";

export const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(200),
  role: z.enum(["User", "GameMaster"]).optional(),
});

export const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(200),
});
