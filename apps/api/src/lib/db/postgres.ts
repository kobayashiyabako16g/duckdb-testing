import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { users, tenants } from "./schema.js";
import type { IUserRepository } from "./repository.js";
import type { User, Tenant } from "../../types.js";

export class PostgresRepository implements IUserRepository {
  private db: ReturnType<typeof drizzle>;

  constructor(url: string) {
    this.db = drizzle(postgres(url));
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return { id: row.id, tenant_id: row.tenantId, email: row.email, role: row.role ?? "viewer" };
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    const rows = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
