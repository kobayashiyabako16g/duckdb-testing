import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config.js";

export interface CFAccessClaims {
  sub: string;
  email: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat: number;
}

// Cloudflare AccessのJWTを検証するための関数とJWKSの管理
const certsUrl = `https://${config.cfTeamDomain}/cdn-cgi/access/certs`;

let cfJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getCfJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!cfJwks) {
    cfJwks = createRemoteJWKSet(new URL(certsUrl));
  }
  return cfJwks;
}

export async function verifyCFAccessJWT(token: string): Promise<CFAccessClaims> {
  const { payload } = await jwtVerify(token, getCfJWKS(), {
    audience: config.cfAud,
    algorithms: ["RS256"],
  });

  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("JWT payload missing email claim");
  }

  return payload as unknown as CFAccessClaims;
}

// Google ID Token 検証 (ローカル開発で利用)
export interface GoogleIdClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
}

let googleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getGoogleJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!googleJwks) {
    googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  }
  return googleJwks;
}

export async function verifyGoogleIdToken(token: string): Promise<GoogleIdClaims> {
  if (!config.googleClientId) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured");
  }
  const { payload } = await jwtVerify(token, getGoogleJWKS(), {
    audience: config.googleClientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    algorithms: ["RS256"],
  });
  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("ID token missing email claim");
  }
  if (payload.email_verified !== true) {
    throw new Error("Email not verified by Google");
  }
  return payload as unknown as GoogleIdClaims;
}
