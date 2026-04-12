import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { config } from './lib/config.js'
import { getRepository } from './lib/db/index.js'
import { cfAccessAuth } from './middleware/auth.js'
import { generateSignedUrl } from './lib/gcs.js'
import type { AuthVariables } from './types.js'

const app = new Hono<{ Variables: AuthVariables }>()

app.get('/', (c) => {
  return c.text('OK')
})

app.use('/api/*', cfAccessAuth)

app.get('/api/me', (c) => {
  return c.json({ user: c.var.user, tenant: c.var.tenant })
})

app.get('/api/signed-url', async (c) => {
  const fileName = c.req.query('file')
  if (!fileName) {
    return c.json({ error: 'Missing required query parameter: file' }, 400)
  }
  const tenant = c.var.tenant
  try {
    const signedUrl = await generateSignedUrl({ fileName, tenantId: tenant.id })
    return c.json({ signedUrl })
  } catch (error) {
    console.error('Error generating GCS signed URL:', error)
    return c.json({ error: 'Failed to generate signed URL' }, 500)
  }
})

serve({
  fetch: app.fetch,
  port: config.port,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
