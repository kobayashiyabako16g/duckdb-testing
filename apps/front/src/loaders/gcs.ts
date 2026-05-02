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
  const token = getCFAuthToken();
  if (!token) return undefined;

  const url = new URL("/api/signed-url", API_BASE_URL);
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
