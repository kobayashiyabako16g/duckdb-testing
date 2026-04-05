import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { config } from './lib/config.js'
import { getRepository } from './lib/db/index.js'
import { cfAccessAuth } from './middleware/auth.js'
import type { AuthVariables } from './types.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.get('/', (c) => {
  return c.text('OK')
})

app.use('/api/*', cfAccessAuth)

app.get('/api/me', (c) => {
  return c.json({ user: c.var.user, tenant: c.var.tenant })
})

await getRepository().initializeSchema()

serve({
  fetch: app.fetch,
  port: config.port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
