import { createMiddleware } from "hono/factory";
import { verifyCFAccessJWT } from "../lib/auth.js";
import { getRepository } from "../lib/db/index.js";
import type { AuthVariables } from "../types.js";

export const cfAccessAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const token = c.req.header("cf-access-jwt-assertion");
  if (!token) {
    return c.json({ error: "Missing authentication token" }, 401);
  }

  let claims;
  try {
    claims = await verifyCFAccessJWT(token);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const repo = getRepository();

  const user = await repo.findUserByEmail(claims.email);
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  const tenant = await repo.findTenantById(user.tenant_id);
  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 401);
  }

  c.set("user", user);
  c.set("tenant", tenant);

  await next();
});
