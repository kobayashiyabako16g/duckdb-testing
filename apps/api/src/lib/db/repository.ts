import type { User, Tenant } from '../../types.js'

export interface IUserRepository {
  findUserByEmail(email: string): Promise<User | null>
  findTenantById(id: string): Promise<Tenant | null>
}
