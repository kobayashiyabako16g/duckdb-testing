import { foreignKey, uuid, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tenants = pgTable("tenants", {
  id: uuid()
    .default(sql`uuidv7()`)
    .primaryKey()
    .notNull(),
  name: text("name").notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid()
      .default(sql`uuidv7()`)
      .primaryKey()
      .notNull(),
    tenantId: uuid().notNull(),
    email: text("email").notNull().unique(),
    role: text("role").default("viewer"),
  },
  (table) => [
    foreignKey({
      name: "users_tenants_fk",
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }),
  ],
);
