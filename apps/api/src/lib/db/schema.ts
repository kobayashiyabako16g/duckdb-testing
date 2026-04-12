import { pgTable, text } from 'drizzle-orm/pg-core'

export const tenants = pgTable('tenants', {
  id:   text('id').primaryKey(),
  name: text('name').notNull(),
})

export const users = pgTable('users', {
  id:       text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  email:    text('email').notNull().unique(),
  role:     text('role').default('viewer'),
})
