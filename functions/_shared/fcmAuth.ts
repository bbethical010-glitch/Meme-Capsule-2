/**
 * Google OAuth2 service-account authentication for FCM HTTP v1.
 * Uses only Web Crypto APIs supported by Cloudflare Pages Functions.
 */
import type { Env } from "./d1r2";

interface FirebaseServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

const base64Url = (value: string | Uint8Array): string => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const pemToBytes = (pem: string): Uint8Array => {
  const normalized = pem.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  const encoded = normalized
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const readServiceAccount = (env: Env): FirebaseServiceAccount => {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not configured");
  }

  let account: Partial<FirebaseServiceAccount>;
  try {
    account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as Partial<FirebaseServiceAccount>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }

  if (!account.client_email || !account.private_key || !account.project_id) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is missing required fields");
  }

  return {
    client_email: account.client_email,
    private_key: account.private_key,
    project_id: account.project_id,
  };
};

export const getFcmAuth = async (
  env: Env
): Promise<{ accessToken: string; projectId: string }> => {
  const account = readServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now) {
    return { accessToken: cachedToken.accessToken, projectId: account.project_id };
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key).buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      sub: account.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedJwt = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedJwt)
  );
  const assertion = `${unsignedJwt}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Google OAuth token exchange failed (${response.status})`);
  }

  const payload = (await response.json()) as OAuthTokenResponse;
  if (!payload.access_token) {
    throw new Error("Google OAuth response did not include an access token");
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: now + Math.min(payload.expires_in || 3600, 3000),
  };
  return { accessToken: payload.access_token, projectId: account.project_id };
};
