import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getRepository } from "../lib/db/index.js";
import { DuplicateEmailError } from "../lib/db/repository.js";
import { cfAccessAuth, requireAdmin } from "../middleware/auth.js";
import { ErrorSchema, UserSchema } from "../schemas/common.js";
import type { AuthVariables } from "../types.js";

const CreateUserBodySchema = z
  .object({
    email: z.string().email(),
    role: z.enum(["admin", "viewer"]).default("viewer"),
  })
  .openapi("CreateUserBody");

const CreateUserResponseSchema = z
  .object({
    user: UserSchema,
  })
  .openapi("CreateUserResponse");

const createUserRoute = createRoute({
  method: "post",
  path: "/api/users",
  tags: ["users"],
  summary: "ユーザー追加 (admin only)",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateUserBodySchema } },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: CreateUserResponseSchema } },
      description: "作成完了",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "リクエスト不正",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "認証失敗",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "admin 以外",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "ユーザー未登録 (要オンボーディング)",
    },
    409: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "email 重複",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "サーバエラー",
    },
  },
});

export const usersRouter = new OpenAPIHono<{ Variables: AuthVariables }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid body" }, 400);
    }
  },
});

usersRouter.use(createUserRoute.getRoutingPath(), cfAccessAuth, requireAdmin);

usersRouter.openapi(createUserRoute, async (c) => {
  const { email, role } = c.req.valid("json");
  const repo = getRepository();
  try {
    const user = await repo.createUser({
      tenantId: c.var.tenant.id,
      email,
      role,
    });
    return c.json({ user }, 201);
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return c.json({ error: "Email already exists" }, 409);
    }
    console.error("Failed to create user:", err);
    return c.json({ error: "Failed to create user" }, 500);
  }
});
