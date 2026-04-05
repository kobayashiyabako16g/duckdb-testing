import type { User, Tenant } from '../../types.js'

export interface IUserRepository {
  initializeSchema(): Promise<void>
  findUserByEmail(email: string): Promise<User | null>
  findTenantById(id: string): Promise<Tenant | null>
}
