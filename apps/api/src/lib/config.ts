function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

export const config = {
  cfTeamDomain: requireEnv('CF_ACCESS_TEAM_DOMAIN'),
  cfAud: requireEnv('CF_ACCESS_AUD'),
  dbPath: process.env['DB_PATH'] ?? './data/app.db',
  port: Number(process.env['PORT'] ?? 3000),
}
