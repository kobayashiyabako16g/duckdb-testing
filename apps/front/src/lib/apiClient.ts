import { API_BASE_URL } from "~/config/env";
import { getStoredIdToken } from "./auth";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredIdToken();
  if (!token) {
    throw new ApiError(401, null, "Not signed in");
  }
  const base = API_BASE_URL || window.location.origin;
  const url = new URL(path, base);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url.toString(), { ...init, headers });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const msg =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, body, msg);
  }
  return (await res.json()) as T;
}
