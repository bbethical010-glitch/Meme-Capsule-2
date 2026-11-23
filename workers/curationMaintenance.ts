/**
 * Curation Maintenance Worker
 *
 * Runs hourly on cron trigger (0 * * * *) or via token-protected manual POST.
 * 1. Purges expired excluded memes (purge_at <= now, max 100 per run).
 * 2. Settles archive memes that have 3 votes (heals race conditions).
 * 3. Prunes audit logs older than 180 days.
 * 4. Records runs in corpus_maintenance_runs.
 */

import { purgeMeme, applyConsensus } from "../functions/_shared/corpus";
import type { Env } from "../functions/_shared/d1r2";

interface MaintenanceEnv extends Env {
  CURATION_WORKER_TOKEN?: string;
}

export async function runMaintenance(env: MaintenanceEnv): Promise<{
  purged_expired: number;
  settled_archive: number;
  pruned_logs: number;
  errors: string[];
}> {
  const startedAt = new Date().toISOString();
  let purgedExpired = 0;
  let settledArchive = 0;
  let prunedLogs = 0;
  const errors: string[] = [];

  // 1. Purge expired excluded memes
  try {
    const expiredRes = await env.DB.prepare(`
      SELECT id FROM memes
      WHERE corpus_status = 'excluded'
        AND purge_at IS NOT NULL
        AND purge_at <= datetime('now')
      LIMIT 100
    `).all<{ id: string }>();

    for (const row of expiredRes.results || []) {
      try {
        await purgeMeme(env, row.id, {
          actor: "curation_maintenance_worker",
          reason: "7_day_expiry",
          detail: "Automated purge after 7-day exclusion grace period elapsed"
        });
        purgedExpired++;
      } catch (err: any) {
        errors.push(`Purge failed for ${row.id}: ${err.message || String(err)}`);
      }
    }
  } catch (err: any) {
    errors.push(`Failed querying expired memes: ${err.message || String(err)}`);
  }

  // 2. Settle archive memes with 3 votes
  try {
    const settleRes = await env.DB.prepare(`
      SELECT m.id
      FROM memes m
      JOIN (
        SELECT meme_id, COUNT(DISTINCT user_id) as v_cnt
        FROM meme_curation
        WHERE user_id IN ('user-judge1', 'user-judge2', 'user-judge3')
        GROUP BY meme_id
        HAVING v_cnt >= 3
      ) v ON m.id = v.meme_id
      WHERE m.corpus_status = 'archive'
      LIMIT 50
    `).all<{ id: string }>();

    for (const row of settleRes.results || []) {
      try {
        const res = await applyConsensus(env, row.id);
        if (res.settled) settledArchive++;
      } catch (err: any) {
        errors.push(`Settle failed for ${row.id}: ${err.message || String(err)}`);
      }
    }
  } catch (err: any) {
    errors.push(`Failed querying unfinalized archive memes: ${err.message || String(err)}`);
  }

  // 3. Prune audit logs older than 180 days
  try {
    const pruneState = await env.DB.prepare(`
      DELETE FROM meme_state_log WHERE at < datetime('now', '-180 days')
    `).run();
    const prunePurge = await env.DB.prepare(`
      DELETE FROM meme_purge_log WHERE purged_at < datetime('now', '-180 days')
    `).run();
    prunedLogs = (pruneState.meta?.changes || 0) + (prunePurge.meta?.changes || 0);
  } catch (err: any) {
    errors.push(`Failed pruning old logs: ${err.message || String(err)}`);
  }

  const finishedAt = new Date().toISOString();
  const ok = errors.length === 0 ? 1 : 0;
  const summaryJson = JSON.stringify({
    purged_expired: purgedExpired,
    settled_archive: settledArchive,
    pruned_logs: prunedLogs,
    errors
  });

  // 4. Record run in corpus_maintenance_runs
  try {
    await env.DB.prepare(`
      INSERT INTO corpus_maintenance_runs (kind, started_at, finished_at, ok, summary_json)
      VALUES ('scheduled_hourly', ?, ?, ?, ?)
    `).bind(startedAt, finishedAt, ok, summaryJson).run();
  } catch (err: any) {
    console.error("Failed recording corpus_maintenance_runs:", err);
  }

  return {
    purged_expired: purgedExpired,
    settled_archive: settledArchive,
    pruned_logs: prunedLogs,
    errors
  };
}

export default {
  async scheduled(event: ScheduledEvent, env: MaintenanceEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMaintenance(env));
  },

  async fetch(request: Request, env: MaintenanceEnv): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const auth = request.headers.get("Authorization");
    const token = env.CURATION_WORKER_TOKEN || env.ADMIN_API_TOKEN;
    if (!token || auth !== `Bearer ${token}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const summary = await runMaintenance(env);
    return new Response(JSON.stringify(summary, null, 2), {
      status: summary.errors.length ? 500 : 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};
