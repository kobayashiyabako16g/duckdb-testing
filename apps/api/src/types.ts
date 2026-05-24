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

export interface UploadItem {
  yyyy: number;
  mm: number;
  dd: number;
  objectPath: string;
  size: number;
  uploadedAt: string;
  signedUrl: string;
}

export type AuthVariables = {
  email: string;
  user: User;
  tenant: Tenant;
};
