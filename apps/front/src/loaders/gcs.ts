import { API_BASE_URL } from "~/config/env";

function getCFAuthToken(): string | null {
  for (const cookie of document.cookie.split(";")) {
    const eqIdx = cookie.indexOf("=");
    if (eqIdx === -1) continue;
    const key = cookie.slice(0, eqIdx).trim();
    const value = cookie.slice(eqIdx + 1).trim();
    if (key === "CF_Authorization" && value) return value;
  }
  return null;
}

export async function getGCSSignedUrl(fileName: string): Promise<string | undefined> {
  // ローカル開発: CF cookie がなくても API を呼び出す (API 側が DEV_USER_EMAIL で認証)
  const isDev = import.meta.env.VITE_DEV_MODE === "true";
  const token = getCFAuthToken() ?? (isDev ? "dev" : null);
  if (!token) return undefined;

  // API_BASE_URL が空の場合は現在のオリジンを使用 (Cloud Run での同一オリジン構成)
  const base = API_BASE_URL || window.location.origin;
  const url = new URL("/api/signed-url", base);
  url.searchParams.set("file", fileName);

  try {
    const response = await fetch(url.toString(), {
      headers: { "cf-access-jwt-assertion": token },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { signedUrl: string };
    return data.signedUrl;
  } catch (error) {
    console.error("Error fetching GCS signed URL:", error);
    return undefined;
  }
}
