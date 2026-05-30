// OpenAPI 3.1 ドキュメントを JSON にダンプする。
// config.ts が import 時に env を検証するため、未設定なら stub を入れる。
// (ドキュメント生成は DB/GCS に触らないので stub で十分)
// ESM では import 文がホイストされるので、env を先にセットしてから dynamic import する。
process.env["APP_ENV"] ??= "development";
process.env["DATABASE_URL"] ??= "postgresql://stub:stub@localhost:5432/stub";
process.env["GCS_BUCKET_NAME"] ??= "stub-bucket";
process.env["CF_ACCESS_TEAM_DOMAIN"] ??= "stub.cloudflareaccess.com";
process.env["CF_ACCESS_AUD"] ??= "stub-aud";
process.env["GOOGLE_OAUTH_CLIENT_ID"] ??= "stub-client-id";

const { writeFile } = await import("node:fs/promises");
const { dirname, resolve } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const { createApp, OPENAPI_DOC_CONFIG } = await import("../src/app.js");

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, "../openapi.json");

const app = createApp();
const doc = app.getOpenAPI31Document(OPENAPI_DOC_CONFIG);
await writeFile(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(`Wrote ${outPath}`);
