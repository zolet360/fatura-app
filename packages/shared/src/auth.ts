import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const sessionSchema = z.object({
  id: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: z.string(), // ISO 8601
  lastUsedAt: z.string(),
  current: z.boolean(),
});

/** Corpo das respostas de erro da API. */
export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type UserDTO = z.infer<typeof userSchema>;
export type SessionDTO = z.infer<typeof sessionSchema>;
export type ApiErrorDTO = z.infer<typeof apiErrorSchema>;
