export interface CFUser {
  email: string;
  name: string;
  sub: string;
}

function parseCFJwt(token: string): CFUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      unknown
    >;
    const email = typeof payload.email === "string" ? payload.email : "";
    const name = typeof payload.name === "string" ? payload.name : email.split("@")[0];
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    if (!email) return null;
    return { email, name, sub };
  } catch {
    return null;
  }
}

/** Cloudflare Access が設定する CF_Authorization cookie から認証ユーザーを取得する */
export function getCFUser(): CFUser | null {
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const eqIdx = cookie.indexOf("=");
    if (eqIdx === -1) continue;
    const key = cookie.slice(0, eqIdx).trim();
    const value = cookie.slice(eqIdx + 1).trim();
    if (key === "CF_Authorization" && value) {
      return parseCFJwt(value);
    }
  }
  return null;
}
