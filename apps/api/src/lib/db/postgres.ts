import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { users, tenants } from "./schema.js";
import { DuplicateEmailError, type IUserRepository } from "./repository.js";
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

  async listTenants(): Promise<Tenant[]> {
    return await this.db.select().from(tenants);
  }

  async createTenant(name: string): Promise<Tenant> {
    const rows = await this.db.insert(tenants).values({ name }).returning();
    const row = rows[0];
    if (!row) throw new Error("Tenant insert returned no rows");
    return { id: row.id, name: row.name };
  }

  async createUser(input: { tenantId: string; email: string; role: string }): Promise<User> {
    try {
      const rows = await this.db
        .insert(users)
        .values({ tenantId: input.tenantId, email: input.email, role: input.role })
        .returning();
      const row = rows[0];
      if (!row) throw new Error("Insert returned no rows");
      return {
        id: row.id,
        tenant_id: row.tenantId,
        email: row.email,
        role: row.role ?? "viewer",
      };
    } catch (err: unknown) {
      // Postgres unique violation = 23505
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "23505"
      ) {
        throw new DuplicateEmailError(input.email);
      }
      throw err;
    }
  }
}
