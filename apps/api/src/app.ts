import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { config } from "./lib/config.js";
import { cfAccessAuth } from "./middleware/auth.js";
import { meRouter } from "./routes/me.js";
import { onboardingRouter } from "./routes/onboarding.js";
import { signedUrlRouter } from "./routes/signed-url.js";
import { tenantsRouter } from "./routes/tenants.js";
import { uploadsRouter } from "./routes/uploads.js";
import { uploadsInitiateRouter } from "./routes/uploads-initiate.js";
import { usersRouter } from "./routes/users.js";
import type { AuthVariables } from "./types.js";

export const OPENAPI_DOC_CONFIG = {
  openapi: "3.1.0" as const,
  info: { title: "duckdb-testing API", version: "0.1.0" },
};

export function createApp(): OpenAPIHono<{ Variables: AuthVariables }> {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

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

  // OpenAPI 化済みルート
  app.route("/", meRouter);
  app.route("/", tenantsRouter);
  app.route("/", onboardingRouter);
  app.route("/", usersRouter);
  app.route("/", uploadsInitiateRouter);
  app.route("/", uploadsRouter);
  app.route("/", signedUrlRouter);

  // OpenAPI ドキュメントと Swagger UI
  app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  });
  app.doc("/openapi.json", OPENAPI_DOC_CONFIG);
  app.get("/docs", swaggerUI({ url: "/openapi.json" }));

  // 以降の /api/* は DB user 必須 (ユーザー未登録は 404 + needsOnboarding)
  app.use("/api/*", cfAccessAuth);

  return app;
}
