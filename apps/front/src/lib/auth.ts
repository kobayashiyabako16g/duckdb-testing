import { API_BASE_URL } from "~/config/env";

export interface AppUser {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
}

export interface AppTenant {
  id: string;
  name: string;
}

export interface MeResponse {
  user: AppUser | null;
  tenant: AppTenant | null;
  email: string;
  needsOnboarding: boolean;
}

const STORAGE_KEY = "google_id_token";

export function getStoredIdToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredIdToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// /api/me 専用 fetcher。apiClient と循環参照を避けるためインラインで実装する。
export async function fetchMe(): Promise<MeResponse | null> {
  const token = getStoredIdToken();
  if (!token) return null;
  const base = API_BASE_URL || window.location.origin;
  try {
    const res = await fetch(new URL("/api/me", base).toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      setStoredIdToken(null);
      return null;
    }
    if (!res.ok) return null;
    return (await res.json()) as MeResponse;
  } catch {
    return null;
  }
}
