import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getRepository } from "../lib/db/index.js";
import { ErrorSchema, TenantSchema, UserSchema } from "../schemas/common.js";
import { authenticateEmail } from "../middleware/auth.js";
import type { AuthVariables } from "../types.js";

// 登録済みコンポーネント (UserSchema/TenantSchema) に .nullable() を呼ぶと
// component 自体が nullable になってしまう zod-openapi の挙動を避けるため、
// inline union で nullable を表現する。
const MeResponseSchema = z
  .object({
    user: z.union([UserSchema, z.null()]),
    tenant: z.union([TenantSchema, z.null()]),
    email: z.string().email(),
    needsOnboarding: z.boolean(),
  })
  .openapi("MeResponse");

const meRoute = createRoute({
  method: "get",
  path: "/api/me",
  tags: ["me"],
  summary: "現在の認証ユーザーとテナントを取得",
  description:
    "認証は必須だが DB user が未登録でも 200 を返す (オンボーディング誘導用)。",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: MeResponseSchema } },
      description: "認証済みユーザー情報 (未オンボーディング時は user/tenant が null)",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "認証失敗",
    },
  },
});

export const meRouter = new OpenAPIHono<{ Variables: AuthVariables }>();

meRouter.use(meRoute.getRoutingPath(), authenticateEmail);

meRouter.openapi(meRoute, async (c) => {
  const repo = getRepository();
  const user = await repo.findUserByEmail(c.var.email);
  if (!user) {
    return c.json(
      { user: null, tenant: null, email: c.var.email, needsOnboarding: true },
      200,
    );
  }
  const tenant = await repo.findTenantById(user.tenant_id);
  return c.json(
    {
      user,
      tenant: tenant ?? null,
      email: c.var.email,
      needsOnboarding: false,
    },
    200,
  );
});
