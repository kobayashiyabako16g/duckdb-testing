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
    yyyy: z.coerce.number().int().min(2000).max(2100).optional().openapi({ example: 2025 }),
    mm: z.coerce.number().int().min(1).max(12).optional().openapi({ example: 9 }),
    dd: z.coerce.number().int().optional().openapi({ example: 15 }),
    from_yyyy: z.coerce.number().int().min(2000).max(2100).optional().openapi({ example: 2025 }),
    from_mm: z.coerce.number().int().min(1).max(12).optional().openapi({ example: 1 }),
    to_yyyy: z.coerce.number().int().min(2000).max(2100).optional().openapi({ example: 2025 }),
    to_mm: z.coerce.number().int().min(1).max(12).optional().openapi({ example: 3 }),
  })
  .superRefine((v, ctx) => {
    const hasRange =
      v.from_yyyy !== undefined ||
      v.from_mm !== undefined ||
      v.to_yyyy !== undefined ||
      v.to_mm !== undefined;
    const hasSingle = v.yyyy !== undefined || v.mm !== undefined;

    if (hasRange && hasSingle) {
      ctx.addIssue({
        code: "custom",
        message: "Specify either yyyy/mm(/dd) or from_*/to_*, not both",
      });
      return;
    }

    if (hasRange) {
      if (
        v.from_yyyy === undefined ||
        v.from_mm === undefined ||
        v.to_yyyy === undefined ||
        v.to_mm === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Range mode requires from_yyyy, from_mm, to_yyyy, to_mm",
        });
        return;
      }
      const fromKey = v.from_yyyy * 100 + v.from_mm;
      const toKey = v.to_yyyy * 100 + v.to_mm;
      if (fromKey > toKey) {
        ctx.addIssue({
          code: "custom",
          message: "from_* must be earlier than or equal to to_*",
        });
      }
      return;
    }

    if (v.yyyy === undefined || v.mm === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "yyyy and mm are required",
      });
      return;
    }
    if (v.dd !== undefined && !isValidDate(v.yyyy, v.mm, v.dd)) {
      ctx.addIssue({ code: "custom", message: "Invalid date" });
    }
  });

const listUploadsRoute = createRoute({
  method: "get",
  path: "/api/uploads",
  tags: ["uploads"],
  summary: "アップロード済み CSV を一覧",
  description:
    "yyyy+mm+dd で当日1件、yyyy+mm で単月分、from_yyyy/from_mm/to_yyyy/to_mm で月範囲分を返す。",
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

const PATH_YYYY_MM_DD_RE = /\/yyyy=(\d{4})\/mm=(\d{2})\/dd=(\d{2})\/data\.csv$/;

function enumerateMonths(
  fromYyyy: number,
  fromMm: number,
  toYyyy: number,
  toMm: number,
): Array<{ yyyy: number; mm: number }> {
  const out: Array<{ yyyy: number; mm: number }> = [];
  let y = fromYyyy;
  let m = fromMm;
  while (y * 100 + m <= toYyyy * 100 + toMm) {
    out.push({ yyyy: y, mm: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

uploadsRouter.openapi(listUploadsRoute, async (c) => {
  const query = c.req.valid("query");
  const tenantId = c.var.tenant.id;

  // Range mode
  if (query.from_yyyy !== undefined) {
    const { from_yyyy, from_mm, to_yyyy, to_mm } = query as {
      from_yyyy: number;
      from_mm: number;
      to_yyyy: number;
      to_mm: number;
    };
    try {
      const months = enumerateMonths(from_yyyy, from_mm, to_yyyy, to_mm);
      const allObjs = (
        await Promise.all(
          months.map((m) =>
            listObjects({
              prefix: `tenant_id=${tenantId}/yyyy=${m.yyyy}/mm=${pad2(m.mm)}/`,
            }),
          ),
        )
      ).flat();
      const items = await Promise.all(
        allObjs
          .filter((o) => PATH_YYYY_MM_DD_RE.test(o.name))
          .map(async (o) => {
            const match = PATH_YYYY_MM_DD_RE.exec(o.name)!;
            const yyyyNum = Number(match[1]);
            const mmNum = Number(match[2]);
            const ddNum = Number(match[3]);
            const signedUrl = await generateReadSignedUrl({ objectPath: o.name });
            return {
              yyyy: yyyyNum,
              mm: mmNum,
              dd: ddNum,
              objectPath: o.name,
              size: o.size,
              uploadedAt: o.updated,
              signedUrl,
            };
          }),
      );
      items.sort((a, b) => {
        if (a.yyyy !== b.yyyy) return a.yyyy - b.yyyy;
        if (a.mm !== b.mm) return a.mm - b.mm;
        return a.dd - b.dd;
      });
      return c.json({ uploads: items }, 200);
    } catch (err) {
      console.error("Failed to list uploads (range mode):", err);
      return c.json({ error: "Failed to list uploads" }, 500);
    }
  }

  const { yyyy, mm, dd } = query as { yyyy: number; mm: number; dd?: number };

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
