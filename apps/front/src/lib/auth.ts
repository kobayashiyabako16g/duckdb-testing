import { API_BASE_URL } from "~/config/env";
import type { paths } from "./api-types.gen";

export type MeResponse =
  paths["/api/me"]["get"]["responses"][200]["content"]["application/json"];
export type AppUser = NonNullable<MeResponse["user"]>;
export type AppTenant = NonNullable<MeResponse["tenant"]>;

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
