import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { config } from "./lib/config.js";
import { getRepository } from "./lib/db/index.js";
import { DuplicateEmailError } from "./lib/db/repository.js";
import { authenticateEmail, cfAccessAuth } from "./middleware/auth.js";
import {
  generateReadSignedUrl,
  generateSignedUrl,
  generateUploadSignedUrl,
  getObjectMeta,
  listObjects,
} from "./lib/gcs.js";
import type { AuthVariables, UploadItem } from "./types.js";

const app = new Hono<{ Variables: AuthVariables }>();

// ローカル開発時: Vite dev server (別ポート) からのリクエストを許可
if (config.isDev) {
  app.use(
    "*",
    cors({
      origin: "http://localhost:5173",
      allowHeaders: ["Content-Type", "Authorization", "cf-access-jwt-assertion"],
    }),
  );
}

const requireAdmin = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  if (c.var.user.role !== "admin") {
    return c.json({ error: "Admin only" }, 403);
  }
  await next();
});

// /api/me: 認証は必須だが DB user が未登録でも 200 を返す (オンボーディング誘導用)
app.get("/api/me", authenticateEmail, async (c) => {
  const repo = getRepository();
  const user = await repo.findUserByEmail(c.var.email);
  if (!user) {
    return c.json({ user: null, tenant: null, email: c.var.email, needsOnboarding: true });
  }
  const tenant = await repo.findTenantById(user.tenant_id);
  return c.json({ user, tenant, email: c.var.email, needsOnboarding: false });
});

// オンボーディング用テナント一覧
app.get("/api/tenants", authenticateEmail, async (c) => {
  const repo = getRepository();
  const tenants = await repo.listTenants();
  return c.json({ tenants });
});

// オンボーディング: 新規テナント作成 or 既存テナント参加
app.post("/api/onboarding", authenticateEmail, async (c) => {
  const repo = getRepository();
  const existing = await repo.findUserByEmail(c.var.email);
  if (existing) {
    return c.json({ error: "Already onboarded" }, 409);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid body" }, 400);
  }
  const { action } = body as { action?: unknown };
  try {
    if (action === "create") {
      const { tenantName } = body as { tenantName?: unknown };
      if (typeof tenantName !== "string" || tenantName.trim().length === 0) {
        return c.json({ error: "tenantName is required" }, 400);
      }
      const tenant = await repo.createTenant(tenantName.trim());
      const user = await repo.createUser({
        tenantId: tenant.id,
        email: c.var.email,
        role: "admin",
      });
      return c.json({ user, tenant }, 201);
    }
    if (action === "join") {
      const { tenantId } = body as { tenantId?: unknown };
      if (typeof tenantId !== "string" || tenantId.length === 0) {
        return c.json({ error: "tenantId is required" }, 400);
      }
      const tenant = await repo.findTenantById(tenantId);
      if (!tenant) {
        return c.json({ error: "Tenant not found" }, 404);
      }
      const user = await repo.createUser({
        tenantId: tenant.id,
        email: c.var.email,
        role: "viewer",
      });
      return c.json({ user, tenant }, 201);
    }
    return c.json({ error: "Invalid action" }, 400);
  } catch (err) {
    if (err instanceof DuplicateEmailError) {
      return c.json({ error: "Already onboarded" }, 409);
    }
    console.error("Onboarding failed:", err);
    return c.json({ error: "Onboarding failed" }, 500);
  }
});

// 以降の /api/* は DB user 必須 (ユーザー未登録は 404 + needsOnboarding)
app.use("/api/*", cfAccessAuth);

app.get("/api/signed-url", async (c) => {
  const fileName = c.req.query("file");
  if (!fileName) {
    return c.json({ error: "Missing required query parameter: file" }, 400);
  }
  const tenant = c.var.tenant;
  try {
    const signedUrl = await generateSignedUrl({
      fileName,
      tenantId: tenant.id,
    });
    return c.json({ signedUrl });
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set(["admin", "viewer"]);

app.post("/api/users", requireAdmin, async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid body" }, 400);
  }
  const { email, role = "viewer" } = body as { email?: unknown; role?: unknown };
  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return c.json({ error: "Invalid email" }, 400);
  }
  if (typeof role !== "string" || !ALLOWED_ROLES.has(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }
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

function getJstDateParts(now: Date = new Date()): { yyyy: number; mm: number; dd: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { yyyy: get("year"), mm: get("month"), dd: get("day") };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function buildObjectPath(tenantId: string, yyyy: number, mm: number, dd: number): string {
  return `tenant_id=${tenantId}/yyyy=${yyyy}/mm=${pad2(mm)}/dd=${pad2(dd)}/data.csv`;
}

function isValidDate(yyyy: number, mm: number, dd: number): boolean {
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return false;
  if (yyyy < 2000 || yyyy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  // JS Date で末日チェック (UTC で十分: 日付の妥当性のみ)
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

app.post("/api/uploads/initiate", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid body" }, 400);
  }
  const { contentType, yyyy, mm, dd } = body as {
    contentType?: unknown;
    yyyy?: unknown;
    mm?: unknown;
    dd?: unknown;
  };
  if (contentType !== "text/csv") {
    return c.json({ error: "Only text/csv is supported" }, 400);
  }
  // 日付指定: 全部省略するか、3 つ揃って指定するかのどちらか
  const provided = [yyyy, mm, dd].filter((v) => v !== undefined);
  if (provided.length !== 0 && provided.length !== 3) {
    return c.json({ error: "yyyy/mm/dd must be all provided or all omitted" }, 400);
  }
  let yyyyN: number;
  let mmN: number;
  let ddN: number;
  if (provided.length === 0) {
    ({ yyyy: yyyyN, mm: mmN, dd: ddN } = getJstDateParts());
  } else {
    yyyyN = Number(yyyy);
    mmN = Number(mm);
    ddN = Number(dd);
    if (!isValidDate(yyyyN, mmN, ddN)) {
      return c.json({ error: "Invalid date" }, 400);
    }
  }
  const objectPath = buildObjectPath(c.var.tenant.id, yyyyN, mmN, ddN);
  try {
    const signedUrl = await generateUploadSignedUrl({ objectPath, contentType });
    return c.json({
      signedUrl,
      objectPath,
      requiredHeaders: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("Failed to generate upload signed URL:", err);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
});

const PATH_DD_RE = /\/dd=(\d{2})\/data\.csv$/;

app.get("/api/uploads", async (c) => {
  const yyyyStr = c.req.query("yyyy");
  const mmStr = c.req.query("mm");
  const ddStr = c.req.query("dd");
  if (!yyyyStr || !mmStr) {
    return c.json({ error: "yyyy and mm are required" }, 400);
  }
  const yyyy = Number(yyyyStr);
  const mm = Number(mmStr);
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || mm < 1 || mm > 12) {
    return c.json({ error: "Invalid yyyy/mm" }, 400);
  }
  const tenantId = c.var.tenant.id;

  if (ddStr !== undefined) {
    const dd = Number(ddStr);
    if (!isValidDate(yyyy, mm, dd)) {
      return c.json({ error: "Invalid date" }, 400);
    }
    const objectPath = buildObjectPath(tenantId, yyyy, mm, dd);
    try {
      const meta = await getObjectMeta(objectPath);
      if (!meta) return c.json({ uploads: [] });
      const signedUrl = await generateReadSignedUrl({ objectPath });
      const item: UploadItem = {
        yyyy,
        mm,
        dd,
        objectPath,
        size: meta.size,
        uploadedAt: meta.updated,
        signedUrl,
      };
      return c.json({ uploads: [item] });
    } catch (err) {
      console.error("Failed to fetch upload (day mode):", err);
      return c.json({ error: "Failed to fetch upload" }, 500);
    }
  }

  // 月モード
  const prefix = `tenant_id=${tenantId}/yyyy=${yyyy}/mm=${pad2(mm)}/`;
  try {
    const objs = await listObjects({ prefix });
    const items: UploadItem[] = await Promise.all(
      objs
        .filter((o) => PATH_DD_RE.test(o.name))
        .map(async (o) => {
          const ddMatch = PATH_DD_RE.exec(o.name);
          const dd = Number(ddMatch![1]);
          const signedUrl = await generateReadSignedUrl({ objectPath: o.name });
          return {
            yyyy,
            mm,
            dd,
            objectPath: o.name,
            size: o.size,
            uploadedAt: o.updated,
            signedUrl,
          };
        }),
    );
    items.sort((a, b) => a.dd - b.dd);
    return c.json({ uploads: items });
  } catch (err) {
    console.error("Failed to list uploads (month mode):", err);
    return c.json({ error: "Failed to list uploads" }, 500);
  }
});

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
