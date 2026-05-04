import { createMiddleware } from "hono/factory";
import { config } from "../lib/config.js";
import { verifyCFAccessJWT } from "../lib/auth.js";
import { getRepository } from "../lib/db/index.js";
import type { AuthVariables } from "../types.js";

export const cfAccessAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  // ローカル開発環境: CF Access JWT 検証をバイパスし DEV_USER_EMAIL のユーザーで通す
  if (config.isDev) {
    const repo = getRepository();
    const user = await repo.findUserByEmail(config.devUserEmail);
    if (!user) {
      return c.json(
        { error: `Dev user "${config.devUserEmail}" not found. Run: pnpm db:seed` },
        401,
      );
    }
    const tenant = await repo.findTenantById(user.tenant_id);
    if (!tenant) {
      return c.json({ error: "Dev tenant not found" }, 401);
    }
    c.set("user", user);
    c.set("tenant", tenant);
    await next();
    return;
  }

  // 本番: Cloudflare Access JWT 検証
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
