/**
 * Google OAuth2 & FCM HTTP v1 Sender via Cloudflare Edge Web Crypto.
 */
import type { Env } from "../../_shared/d1r2";

function base64Url(input: string | Uint8Array): string {
  let b64: string;
  if (typeof input === "string") {
    b64 = btoa(input);
  } else {
    let binary = "";
    for (let i = 0; i < input.byteLength; i++) {
      binary += String.fromCharCode(input[i]);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBinary(pem: string): Uint8Array {
  const normalizedPem = pem.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  const b64 = normalizedPem
    .replace(/-----BEGIN[ A-Z0-9_-]+-----/g, "")
    .replace(/-----END[ A-Z0-9_-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Signs an RS256 JWT and exchanges it for a Google OAuth2 access token.
 */
export async function getGoogleOAuthToken(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const keyBytes = pemToBinary(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signedJwt = `${unsignedToken}.${base64Url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth token exchange failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface SendPushParams {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendFcmMessage(
  env: Env,
  accessToken: string,
  params: SendPushParams
): Promise<{ success: boolean; unregistered?: boolean; error?: string }> {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    return { success: false, error: "FIREBASE_PROJECT_ID not configured" };
  }

  const payload = {
    message: {
      token: params.token,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: params.data || {},
      android: {
        priority: "HIGH",
        notification: {
          sound: "default",
          channel_id: "meme_capsule_drops",
        },
      },
    },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (res.ok) {
    return { success: true };
  }

  const errData = (await res.json().catch(() => ({}))) as any;
  const status = errData?.error?.status || "";
  const isUnregistered = status === "NOT_FOUND" || status === "UNREGISTERED";

  return {
    success: false,
    unregistered: isUnregistered,
    error: errData?.error?.message || `FCM error ${res.status}`,
  };
}
