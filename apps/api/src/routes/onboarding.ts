import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getRepository } from "../lib/db/index.js";
import { DuplicateEmailError } from "../lib/db/repository.js";
import { authenticateEmail } from "../middleware/auth.js";
import { ErrorSchema, TenantSchema, UserSchema } from "../schemas/common.js";
import type { AuthVariables } from "../types.js";

const CreateActionSchema = z
  .object({
    action: z.literal("create"),
    tenantName: z.string().trim().min(1),
  })
  .openapi("OnboardingCreateAction");

const JoinActionSchema = z
  .object({
    action: z.literal("join"),
    tenantId: z.string().min(1),
  })
  .openapi("OnboardingJoinAction");

const OnboardingBodySchema = z
  .discriminatedUnion("action", [CreateActionSchema, JoinActionSchema])
  .openapi("OnboardingBody");

const OnboardingResponseSchema = z
  .object({
    user: UserSchema,
    tenant: TenantSchema,
  })
  .openapi("OnboardingResponse");

const onboardingRoute = createRoute({
  method: "post",
  path: "/api/onboarding",
  tags: ["onboarding"],
  summary: "新規テナント作成 or 既存テナント参加",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: OnboardingBodySchema },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: OnboardingResponseSchema } },
      description: "オンボーディング完了",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "リクエスト不正",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "認証失敗",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "テナントが見つからない",
    },
    409: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "既にオンボーディング済み",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "サーバエラー",
    },
  },
});

export const onboardingRouter = new OpenAPIHono<{ Variables: AuthVariables }>({
  // バリデーション失敗時のレスポンスを {error} 形式に揃える
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid body" }, 400);
    }
  },
});

onboardingRouter.use(onboardingRoute.getRoutingPath(), authenticateEmail);

onboardingRouter.openapi(onboardingRoute, async (c) => {
  const repo = getRepository();
  const existing = await repo.findUserByEmail(c.var.email);
  if (existing) {
    return c.json({ error: "Already onboarded" }, 409);
  }
  const body = c.req.valid("json");
  try {
    if (body.action === "create") {
      const tenant = await repo.createTenant(body.tenantName.trim());
      const user = await repo.createUser({
        tenantId: tenant.id,
        email: c.var.email,
        role: "admin",
      });
      return c.json({ user, tenant }, 201);
    }
    const tenant = await repo.findTenantById(body.tenantId);
    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404);
    }
    const user = await repo.createUser({
      tenantId: tenant.id,
      email: c.var.email,
      role: "viewer",
    });
    return c.json({ user, tenant }, 201);
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return c.json({ error: "Already onboarded" }, 409);
    }
    console.error("Onboarding failed:", err);
    return c.json({ error: "Onboarding failed" }, 500);
  }
});
