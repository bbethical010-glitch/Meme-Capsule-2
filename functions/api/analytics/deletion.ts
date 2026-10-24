import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAuth } from "../../_shared/catAuth";

const HEX_64_RE = /^[0-9a-f]{64}$/i;
const REQUEST_REFERENCE_RE = /^[a-zA-Z0-9._:-]{1,128}$/;

type DeletionRequest = {
  user_hash?: string;
  request_reference?: string;
};

type DeletionAuditRow = {
  id: number;
  request_reference: string;
  user_hash: string;
  deleted_event_count: number;
  requested_by: string;
  status: "completed" | "failed";
  created_at: string;
  completed_at: string | null;
};

const parseBody = async (request: Request): Promise<DeletionRequest> => {
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    throw json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  try {
    return await request.json() as DeletionRequest;
  } catch {
    throw json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
};

const validateRequest = (body: DeletionRequest) => {
  if (!body || typeof body !== "object") {
    throw json({ error: "Deletion request must be an object." }, { status: 400 });
  }
  if (!body.user_hash || !HEX_64_RE.test(body.user_hash)) {
    throw json({ error: "user_hash must be a SHA-256 hash." }, { status: 400 });
  }
  if (!body.request_reference || !REQUEST_REFERENCE_RE.test(body.request_reference)) {
    throw json({ error: "request_reference is invalid." }, { status: 400 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const user = await requireAuth(request, env, "superadmin");
    const body = await parseBody(request);
    validateRequest(body);

    const userHash = body.user_hash!.toLowerCase();
    const requestReference = body.request_reference!;
    const existing = await env.DB.prepare(
      "SELECT id FROM android_analytics_deletion_audit WHERE request_reference = ?"
    ).bind(requestReference).first<{ id: number }>();

    if (existing) {
      return json({ error: "request_reference has already been processed." }, { status: 409 });
    }

    const countRow = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM android_analytics_events WHERE user_hash = ?"
    ).bind(userHash).first<{ count: number }>();
    const deletedEventCount = Number(countRow?.count || 0);
    const now = new Date().toISOString();

    try {
      await env.DB.batch([
        env.DB.prepare(
          "DELETE FROM android_analytics_events WHERE user_hash = ?"
        ).bind(userHash),
        env.DB.prepare(`
          INSERT INTO android_analytics_deletion_audit (
            request_reference, user_hash, deleted_event_count, requested_by,
            status, created_at, completed_at
          ) VALUES (?, ?, ?, ?, 'completed', ?, ?)
        `).bind(
          requestReference,
          userHash,
          deletedEventCount,
          user.username,
          now,
          now
        )
      ]);
    } catch (error) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO android_analytics_deletion_audit (
          request_reference, user_hash, deleted_event_count, requested_by,
          status, created_at, completed_at
        ) VALUES (?, ?, 0, ?, 'failed', ?, NULL)
      `).bind(requestReference, userHash, user.username, now).run().catch(() => {});
      throw error;
    }

    return json({
      success: true,
      request_reference: requestReference,
      deleted_event_count: deletedEventCount,
      status: "completed",
      completed_at: now
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android analytics deletion error:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Analytics deletion failed." }, { status: 500 });
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireAuth(request, env, "superadmin");
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const { results } = await env.DB.prepare(`
      SELECT id, request_reference, user_hash, deleted_event_count, requested_by,
             status, created_at, completed_at
      FROM android_analytics_deletion_audit
      ORDER BY id DESC
      LIMIT ?
    `).bind(limit).all<DeletionAuditRow>();

    return json({ success: true, audits: results || [] });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android analytics deletion audit error:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Analytics deletion audit unavailable." }, { status: 500 });
  }
};
