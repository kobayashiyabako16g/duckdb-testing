export interface Tenant {
  id: string;
  name: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
}

export type AuthVariables = {
  email: string;
  user: User;
  tenant: Tenant;
};
