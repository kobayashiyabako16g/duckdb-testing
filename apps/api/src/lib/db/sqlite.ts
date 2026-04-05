import Database from 'better-sqlite3'
import type { IUserRepository } from './repository.js'
import type { User, Tenant } from '../../types.js'

export class SqliteRepository implements IUserRepository {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
  }

  async initializeSchema(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id),
        email TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'viewer'
      );
    `)
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare<[string], User>(
      'SELECT id, tenant_id, email, role FROM users WHERE email = ?'
    )
    return stmt.get(email) ?? null
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    const stmt = this.db.prepare<[string], Tenant>(
      'SELECT id, name FROM tenants WHERE id = ?'
    )
    return stmt.get(id) ?? null
  }
}
