import type { User, Tenant } from "../../types.js";

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`User with email "${email}" already exists`);
    this.name = "DuplicateEmailError";
  }
}

export interface IUserRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findTenantById(id: string): Promise<Tenant | null>;
  listTenants(): Promise<Tenant[]>;
  createUser(input: { tenantId: string; email: string; role: string }): Promise<User>;
  createTenant(name: string): Promise<Tenant>;
}
