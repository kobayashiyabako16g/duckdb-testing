const isDev = process.env["APP_ENV"] === "development";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function devOptional(key: string): string {
  if (isDev) return process.env[key] ?? "";
  return requireEnv(key);
}

export const config = {
  isDev,
  cfTeamDomain: devOptional("CF_ACCESS_TEAM_DOMAIN"),
  cfAud: devOptional("CF_ACCESS_AUD"),
  databaseUrl: requireEnv("DATABASE_URL"),
  port: Number(process.env["PORT"] ?? 8080),
  gcsBucketName: requireEnv("GCS_BUCKET_NAME"),
  gcsEmulatorHost: process.env["GCS_EMULATOR_HOST"] ?? "",
  devUserEmail: process.env["DEV_USER_EMAIL"] ?? "dev@example.com",
};
