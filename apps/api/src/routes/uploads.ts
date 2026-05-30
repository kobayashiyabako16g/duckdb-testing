import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { generateReadSignedUrl, getObjectMeta, listObjects } from "../lib/gcs.js";
import { PATH_DD_RE, buildObjectPath, isValidDate, pad2 } from "../lib/upload-paths.js";
import { cfAccessAuth } from "../middleware/auth.js";
import { ErrorSchema } from "../schemas/common.js";
import type { AuthVariables } from "../types.js";

const UploadItemSchema = z
  .object({
    yyyy: z.number().int(),
    mm: z.number().int(),
    dd: z.number().int(),
    objectPath: z.string(),
    size: z.number(),
    uploadedAt: z.string(),
    signedUrl: z.string().url(),
  })
  .openapi("UploadItem");

const UploadsListResponseSchema = z
  .object({
    uploads: z.array(UploadItemSchema),
  })
  .openapi("UploadsListResponse");

const ListUploadsQuerySchema = z
  .object({
    yyyy: z.coerce.number().int().min(2000).max(2100).openapi({ example: 2025 }),
    mm: z.coerce.number().int().min(1).max(12).openapi({ example: 9 }),
    dd: z.coerce.number().int().optional().openapi({ example: 15 }),
  })
  .refine((v) => v.dd === undefined || isValidDate(v.yyyy, v.mm, v.dd), {
    message: "Invalid date",
  });

const listUploadsRoute = createRoute({
  method: "get",
  path: "/api/uploads",
  tags: ["uploads"],
  summary: "アップロード済み CSV を一覧",
  description: "dd を指定すると当日 1 件 (無ければ空配列)、省略すると yyyy/mm の全日分を返す。",
  security: [{ bearerAuth: [] }],
  request: {
    query: ListUploadsQuerySchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: UploadsListResponseSchema } },
      description: "アップロード一覧",
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

export const uploadsRouter = new OpenAPIHono<{ Variables: AuthVariables }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid query";
      return c.json({ error: message }, 400);
    }
  },
});

uploadsRouter.use(listUploadsRoute.getRoutingPath(), cfAccessAuth);

uploadsRouter.openapi(listUploadsRoute, async (c) => {
  const { yyyy, mm, dd } = c.req.valid("query");
  const tenantId = c.var.tenant.id;

  if (dd !== undefined) {
    const objectPath = buildObjectPath(tenantId, yyyy, mm, dd);
    try {
      const meta = await getObjectMeta(objectPath);
      if (!meta) return c.json({ uploads: [] }, 200);
      const signedUrl = await generateReadSignedUrl({ objectPath });
      return c.json(
        {
          uploads: [
            {
              yyyy,
              mm,
              dd,
              objectPath,
              size: meta.size,
              uploadedAt: meta.updated,
              signedUrl,
            },
          ],
        },
        200,
      );
    } catch (err) {
      console.error("Failed to fetch upload (day mode):", err);
      return c.json({ error: "Failed to fetch upload" }, 500);
    }
  }

  // 月モード
  const prefix = `tenant_id=${tenantId}/yyyy=${yyyy}/mm=${pad2(mm)}/`;
  try {
    const objs = await listObjects({ prefix });
    const items = await Promise.all(
      objs
        .filter((o) => PATH_DD_RE.test(o.name))
        .map(async (o) => {
          const ddMatch = PATH_DD_RE.exec(o.name);
          const ddNum = Number(ddMatch![1]);
          const signedUrl = await generateReadSignedUrl({ objectPath: o.name });
          return {
            yyyy,
            mm,
            dd: ddNum,
            objectPath: o.name,
            size: o.size,
            uploadedAt: o.updated,
            signedUrl,
          };
        }),
    );
    items.sort((a, b) => a.dd - b.dd);
    return c.json({ uploads: items }, 200);
  } catch (err) {
    console.error("Failed to list uploads (month mode):", err);
    return c.json({ error: "Failed to list uploads" }, 500);
  }
});
