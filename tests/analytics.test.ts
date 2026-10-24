import { describe, expect, it } from "vitest";
import { onRequestPost } from "../functions/api/analytics/events";

const token = "phase7-test-token";
const userHash = "a".repeat(64);

const createKv = () => {
  const values = new Map<string, string>();
  return {
    async get(key: string) {
      return values.get(key) || null;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    }
  } as unknown as KVNamespace;
};

const createDb = (changes = 1) => {
  const statements: unknown[] = [];
  return {
    statements,
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          statements.push({ sql, bindings });
          return { sql, bindings };
        }
      };
    },
    async batch() {
      return [{ meta: { changes } }];
    }
  } as unknown as D1Database;
};

const event = (overrides: Record<string, unknown> = {}) => ({
  schema_version: 1,
  event_id: "a1b2c3d4e5f60708",
  event_name: "meme_view",
  user_hash: userHash,
  session_id: "b1c2d3e4f5a60718",
  timestamp_utc: new Date().toISOString(),
  platform: "android",
  app_version: "1.0.0",
  consent_status: "granted",
  consent_version: "v2",
  ...overrides
});

const post = (body: unknown, options: { token?: string; contentType?: string; db?: D1Database } = {}) => {
  const request = new Request("https://example.test/api/analytics/events", {
    method: "POST",
    headers: {
      "Content-Type": options.contentType || "application/json",
      "X-Analytics-App-Token": options.token || token
    },
    body: JSON.stringify(body)
  });
  return onRequestPost({
    request,
    env: {
      DB: options.db || createDb(),
      MEMES_BUCKET: {} as R2Bucket,
      ANALYTICS_APP_TOKEN: token,
      ANALYTICS_KV: createKv()
    }
  } as never);
};

describe("Android analytics ingestion contract", () => {
  it("accepts a valid consented event and persists consent lineage", async () => {
    const db = createDb();
    const response = await post({ events: [event()] }, { db });
    const body = await response.json() as { accepted: number };

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(1);
    expect(JSON.stringify(db.statements)).toContain('"v2"');
  });

  it("rejects invalid consent without writing to D1", async () => {
    const db = createDb();
    const response = await post({ events: [event({ consent_status: "denied" })] }, { db });

    expect(response.status).toBe(400);
    expect(db.statements).toHaveLength(0);
  });

  it("rejects invalid tokens and non-JSON requests", async () => {
    expect((await post({ events: [event()] }, { token: "wrong" })).status).toBe(401);
    expect((await post({ events: [event()] }, { contentType: "text/plain" })).status).toBe(415);
  });

  it("rejects forbidden nested PII and unsupported schema versions", async () => {
    expect((await post({ events: [event({ properties: { nested: { email: "x" } } })] })).status).toBe(400);
    expect((await post({ events: [event({ schema_version: 2 })] })).status).toBe(400);
  });

  it("deduplicates event IDs through INSERT OR IGNORE result accounting", async () => {
    const response = await post({ events: [event()] }, { db: createDb(0) });
    const body = await response.json() as { accepted: number; rejected: number };

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(0);
    expect(body.rejected).toBe(1);
  });
});
