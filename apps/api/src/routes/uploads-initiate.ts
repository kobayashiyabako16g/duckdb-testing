import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { generateUploadSignedUrl } from "../lib/gcs.js";
import {
  buildObjectPath,
  getJstDateParts,
  isValidDate,
} from "../lib/upload-paths.js";
import { cfAccessAuth } from "../middleware/auth.js";
import { ErrorSchema } from "../schemas/common.js";
import type { AuthVariables } from "../types.js";

const InitiateUploadBodySchema = z
  .object({
    contentType: z.literal("text/csv"),
    yyyy: z.number().int().optional(),
    mm: z.number().int().optional(),
    dd: z.number().int().optional(),
  })
  .refine(
    (v) => {
      const provided = [v.yyyy, v.mm, v.dd].filter((x) => x !== undefined);
      return provided.length === 0 || provided.length === 3;
    },
    { message: "yyyy/mm/dd must be all provided or all omitted" },
  )
  .refine(
    (v) => v.yyyy === undefined || isValidDate(v.yyyy, v.mm as number, v.dd as number),
    { message: "Invalid date" },
  )
  .openapi("InitiateUploadBody");

const InitiateUploadResponseSchema = z
  .object({
    signedUrl: z.string().url(),
    objectPath: z.string(),
    requiredHeaders: z.object({
      "Content-Type": z.string(),
    }),
  })
  .openapi("InitiateUploadResponse");

const initiateUploadRoute = createRoute({
  method: "post",
  path: "/api/uploads/initiate",
  tags: ["uploads"],
  summary: "アップロード用 signed URL を発行",
  description:
    "yyyy/mm/dd を省略すると JST 当日が使われる。指定する場合は 3 つ揃って指定すること。",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: InitiateUploadBodySchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: InitiateUploadResponseSchema } },
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
      content: { "application/json": { schema: ErrorSchema } },
      description: "サーバエラー",
    },
  },
});

export const uploadsInitiateRouter = new OpenAPIHono<{ Variables: AuthVariables }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid body";
      return c.json({ error: message }, 400);
    }
  },
});

uploadsInitiateRouter.use(initiateUploadRoute.getRoutingPath(), cfAccessAuth);

uploadsInitiateRouter.openapi(initiateUploadRoute, async (c) => {
  const body = c.req.valid("json");
  const contentType = body.contentType;
  const date =
    body.yyyy === undefined
      ? getJstDateParts()
      : { yyyy: body.yyyy, mm: body.mm as number, dd: body.dd as number };
  const objectPath = buildObjectPath(c.var.tenant.id, date.yyyy, date.mm, date.dd);
  try {
    const signedUrl = await generateUploadSignedUrl({ objectPath, contentType });
    return c.json(
      {
        signedUrl,
        objectPath,
        requiredHeaders: { "Content-Type": contentType },
      },
      200,
    );
  } catch (err) {
    console.error("Failed to generate upload signed URL:", err);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
});
