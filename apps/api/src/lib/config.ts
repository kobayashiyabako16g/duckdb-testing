function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

export const config = {
  cfTeamDomain: requireEnv('CF_ACCESS_TEAM_DOMAIN'),
  cfAud: requireEnv('CF_ACCESS_AUD'),
  databaseUrl: requireEnv('DATABASE_URL'),
  port: Number(process.env['PORT'] ?? 8080),
  gcsBucketName: requireEnv('GCS_BUCKET_NAME'),
}
