export interface Tenant {
  id: string
  name: string
}

export interface User {
  id: string
  tenant_id: string
  email: string
  role: string
}

export type AuthVariables = {
  user: User
  tenant: Tenant
}
