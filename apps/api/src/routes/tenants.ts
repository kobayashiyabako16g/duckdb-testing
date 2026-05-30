import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getRepository } from "../lib/db/index.js";
import { authenticateEmail } from "../middleware/auth.js";
import { ErrorSchema, TenantSchema } from "../schemas/common.js";
import type { AuthVariables } from "../types.js";

const TenantsListResponseSchema = z
  .object({
    tenants: z.array(TenantSchema),
  })
  .openapi("TenantsListResponse");

const tenantsRoute = createRoute({
  method: "get",
  path: "/api/tenants",
  tags: ["tenants"],
  summary: "テナント一覧 (オンボーディング用)",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: TenantsListResponseSchema } },
      description: "テナント一覧",
    },
    401: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "認証失敗",
    },
  },
});

export const tenantsRouter = new OpenAPIHono<{ Variables: AuthVariables }>();

tenantsRouter.use(tenantsRoute.getRoutingPath(), authenticateEmail);

tenantsRouter.openapi(tenantsRoute, async (c) => {
  const repo = getRepository();
  const tenants = await repo.listTenants();
  return c.json({ tenants }, 200);
});
