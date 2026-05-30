import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { config } from "../lib/config.js";
import { verifyCFAccessJWT, verifyGoogleIdToken } from "../lib/auth.js";
import { getRepository } from "../lib/db/index.js";
import type { AuthVariables } from "../types.js";

type AuthContext = Context<{ Variables: AuthVariables }>;

async function resolveEmail(c: AuthContext): Promise<{ email: string } | Response> {
  try {
    if (config.isDev) {
      const authz = c.req.header("authorization") ?? "";
      const m = /^Bearer\s+(.+)$/i.exec(authz);
      if (!m) {
        return c.json({ error: "Missing Authorization Bearer token" }, 401);
      }
      const claims = await verifyGoogleIdToken(m[1]!);
      return { email: claims.email };
    }
    const token = c.req.header("cf-access-jwt-assertion");
    if (!token) {
      return c.json({ error: "Missing authentication token" }, 401);
    }
    const claims = await verifyCFAccessJWT(token);
    return { email: claims.email };
  } catch (err) {
    console.error("Auth verification failed:", err);
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

// 認証済み email を取得する。DB に user が無くてもよい (オンボーディング前の状態を許容)。
export const authenticateEmail = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const result = await resolveEmail(c);
    if (result instanceof Response) return result;
    c.set("email", result.email);
    await next();
  },
);

export const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    if (c.var.user.role !== "admin") {
      return c.json({ error: "Admin only" }, 403);
    }
    await next();
  },
);

// 認証済み + DB user 必須。未登録なら 404 + needsOnboarding を返す。
export const cfAccessAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const result = await resolveEmail(c);
  if (result instanceof Response) return result;
  c.set("email", result.email);
  const repo = getRepository();
  const user = await repo.findUserByEmail(result.email);
  if (!user) {
    return c.json({ error: "User not found", needsOnboarding: true }, 404);
  }
  const tenant = await repo.findTenantById(user.tenant_id);
  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 401);
  }
  c.set("user", user);
  c.set("tenant", tenant);
  await next();
});
