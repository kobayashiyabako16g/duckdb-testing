import { z } from "@hono/zod-openapi";

export const UserSchema = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    email: z.string().email(),
    role: z.string(),
  })
  .openapi("User");

export const TenantSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .openapi("Tenant");

export const ErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi("Error");
