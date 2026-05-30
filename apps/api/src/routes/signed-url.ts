import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { config } from "../lib/config.js";
import { generateSignedUrl } from "../lib/gcs.js";
import { cfAccessAuth } from "../middleware/auth.js";
import { ErrorSchema } from "../schemas/common.js";
import type { AuthVariables } from "../types.js";

const SignedUrlResponseSchema = z
  .object({
    signedUrl: z.string().url(),
  })
  .openapi("SignedUrlResponse");

// 500 のみ dev 環境では detail (stack 等) を含む。エンドポイント固有の拡張なので inline。
const SignedUrlErrorWithDetailSchema = z
  .object({
    error: z.string(),
    detail: z.string().optional(),
  })
  .openapi("SignedUrlErrorWithDetail");

const signedUrlRoute = createRoute({
  method: "get",
  path: "/api/signed-url",
  tags: ["gcs"],
  summary: "任意ファイル名の signed URL を発行",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      file: z.string().min(1).openapi({
        description: "対象ファイル名",
        example: "report.csv",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: SignedUrlResponseSchema } },
      description: "signed URL 発行",
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
      description: "ユーザー未登録 (要オンボーディング)",
    },
    500: {
      content: { "application/json": { schema: SignedUrlErrorWithDetailSchema } },
      description: "サーバエラー (dev 環境では detail を含む)",
    },
  },
});

export const signedUrlRouter = new OpenAPIHono<{ Variables: AuthVariables }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid query";
      return c.json({ error: message }, 400);
    }
  },
});

signedUrlRouter.use(signedUrlRoute.getRoutingPath(), cfAccessAuth);

signedUrlRouter.openapi(signedUrlRoute, async (c) => {
  const { file } = c.req.valid("query");
  try {
    const signedUrl = await generateSignedUrl({
      fileName: file,
      tenantId: c.var.tenant.id,
    });
    return c.json({ signedUrl }, 200);
  } catch (error) {
    console.error("Error generating GCS signed URL:", error);
    const detail = config.isDev
      ? error instanceof Error
        ? `${error.message}\n${error.stack ?? ""}`
        : String(error)
      : undefined;
    return c.json({ error: "Failed to generate signed URL", detail }, 500);
  }
});
