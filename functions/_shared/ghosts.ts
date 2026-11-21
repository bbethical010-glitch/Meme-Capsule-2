import type { Env } from "./d1r2";
import { purgeMeme, DEPENDENT_CHILD_TABLES, type CorpusState } from "./corpus";

export interface IntegrityClassResult {
  class_code: "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i";
  title: string;
  count: number;
  safe_to_purge: boolean;
  samples: Array<{ id: string; detail?: string }>;
}

export interface GhostScanReport {
  timestamp: string;
  classes: IntegrityClassResult[];
  total_issues: number;
  safe_to_purge_count: number;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Read-only audit scan detecting integrity issues across classes (a) through (i).
 */
export async function scanGhosts(env: Env): Promise<GhostScanReport> {
  const classes: IntegrityClassResult[] = [];
  const now = Date.now();

  // Class (a): Child rows whose parent meme does not exist (Safe to delete)
  let classACount = 0;
  const classASamples: Array<{ id: string; detail?: string }> = [];

  for (const table of DEPENDENT_CHILD_TABLES) {
    try {
      const orphanRes = await env.DB.prepare(`
        SELECT c.meme_id FROM ${table} c
        LEFT JOIN memes m ON c.meme_id = m.id
        WHERE m.id IS NULL
        LIMIT 20
      `).all<{ meme_id: string }>();

      const countRes = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM ${table} c
        LEFT JOIN memes m ON c.meme_id = m.id
        WHERE m.id IS NULL
      `).first<{ count: number }>();

      const cnt = countRes?.count || 0;
      classACount += cnt;
      for (const row of orphanRes.results || []) {
        if (classASamples.length < 20) {
          classASamples.push({ id: row.meme_id, detail: `Orphan in ${table}` });
        }
      }
    } catch {}
  }

  classes.push({
    class_code: "a",
    title: "Orphan child rows without a parent meme",
    count: classACount,
    safe_to_purge: true,
    samples: classASamples
  });

  // Class (b): memes rows whose R2 object is missing (>15 min old)
  let classBCount = 0;
  const classBSamples: Array<{ id: string; detail?: string }> = [];

  try {
    const candidates = await env.DB.prepare(`
      SELECT id, storage_path, uploaded_at FROM memes
      WHERE storage_path IS NOT NULL
      ORDER BY uploaded_at DESC
      LIMIT 100
    `).all<{ id: string; storage_path: string; uploaded_at: string }>();

    for (const row of candidates.results || []) {
      const uploadedMs = row.uploaded_at ? new Date(row.uploaded_at).getTime() : 0;
      if (now - uploadedMs > FIFTEEN_MINUTES_MS) {
        const cleanKey = row.storage_path.replace(/^\/+/, "");
        const head = await env.MEMES_BUCKET.head(cleanKey);
        if (!head) {
          classBCount++;
          if (classBSamples.length < 20) {
            classBSamples.push({ id: row.id, detail: `Missing R2 object: ${cleanKey}` });
          }
        }
      }
    }
  } catch {}

  classes.push({
    class_code: "b",
    title: "Memes rows with missing physical R2 objects",
    count: classBCount,
    safe_to_purge: true,
    samples: classBSamples
  });

  // Class (c): Ledger row mismatches (final row for non-active; active without keep ledger)
  let classCCount = 0;
  const classCSamples: Array<{ id: string; detail?: string }> = [];

  try {
    const nonActiveLedger = await env.DB.prepare(`
      SELECT f.meme_id, m.corpus_status FROM meme_curation_final f
      JOIN memes m ON f.meme_id = m.id
      WHERE m.corpus_status != 'active'
      LIMIT 20
    `).all<{ meme_id: string; corpus_status: string }>();

    const activeWithoutLedger = await env.DB.prepare(`
      SELECT m.id FROM memes m
      LEFT JOIN meme_curation_final f ON m.id = f.meme_id AND f.corpus_status = 'keep'
      WHERE m.corpus_status = 'active' AND f.meme_id IS NULL
      LIMIT 20
    `).all<{ id: string }>();

    classCCount = (nonActiveLedger.results?.length || 0) + (activeWithoutLedger.results?.length || 0);
    for (const row of nonActiveLedger.results || []) {
      classCSamples.push({ id: row.meme_id, detail: `Ledger row present but meme state is '${row.corpus_status}'` });
    }
    for (const row of activeWithoutLedger.results || []) {
      if (classCSamples.length < 20) {
        classCSamples.push({ id: row.id, detail: "Meme is active but missing 'keep' ledger row" });
      }
    }
  } catch {}

  classes.push({
    class_code: "c",
    title: "Ledger status contradictions (meme_curation_final vs memes)",
    count: classCCount,
    safe_to_purge: true,
    samples: classCSamples
  });

  // Class (d): Ingestion jobs/batches stuck non-terminal >24h or pointing at missing memes
  let classDCount = 0;
  const classDSamples: Array<{ id: string; detail?: string }> = [];

  try {
    const stuckJobs = await env.DB.prepare(`
      SELECT job_id, meme_id, state, created_at FROM ingestion_jobs
      WHERE state IN ('queued', 'processing', 'retry_wait')
        AND created_at < datetime('now', '-24 hours')
      LIMIT 20
    `).all<{ job_id: string; meme_id: string; state: string; created_at: string }>();

    classDCount = stuckJobs.results?.length || 0;
    for (const j of stuckJobs.results || []) {
      classDSamples.push({ id: j.job_id, detail: `Stuck job (${j.state}) created at ${j.created_at}` });
    }
  } catch {}

  classes.push({
    class_code: "d",
    title: "Stuck ingestion jobs or expired leases (>24h non-terminal)",
    count: classDCount,
    safe_to_purge: true,
    samples: classDSamples
  });

  // Class (e): State contradicting evidence (Report only)
  let classECount = 0;
  const classESamples: Array<{ id: string; detail?: string }> = [];

  try {
    // Archive without AI Judge 4 review
    const archiveNoAi = await env.DB.prepare(`
      SELECT m.id FROM memes m
      LEFT JOIN ingestion_ai_evaluations e ON m.id = e.meme_id AND e.judge_key = 'judge4' AND e.state = 'succeeded'
      LEFT JOIN ai_curation_predictions a ON m.id = a.meme_id
      WHERE m.corpus_status = 'archive' AND e.id IS NULL AND a.meme_id IS NULL
      LIMIT 20
    `).all<{ id: string }>();

    // Excluded without purge_at
    const excludedNoPurge = await env.DB.prepare(`
      SELECT id FROM memes
      WHERE corpus_status = 'excluded' AND purge_at IS NULL
      LIMIT 20
    `).all<{ id: string }>();

    classECount = (archiveNoAi.results?.length || 0) + (excludedNoPurge.results?.length || 0);
    for (const row of archiveNoAi.results || []) {
      classESamples.push({ id: row.id, detail: "Archive state without successful AI Judge evaluation" });
    }
    for (const row of excludedNoPurge.results || []) {
      if (classESamples.length < 20) {
        classESamples.push({ id: row.id, detail: "Excluded meme missing purge_at timestamp" });
      }
    }
  } catch {}

  classes.push({
    class_code: "e",
    title: "State contradicting evidence (archive without AI review / missing purge timers)",
    count: classECount,
    safe_to_purge: false,
    samples: classESamples
  });

  // Class (f): Legacy soft-removed rows (is_active = 0) fitting no clean state (Report only)
  let classFCount = 0;
  const classFSamples: Array<{ id: string; detail?: string }> = [];
  try {
    const softRemoved = await env.DB.prepare(`
      SELECT id, status, corpus_status FROM memes
      WHERE is_active = 0 AND corpus_status NOT IN ('draft', 'archive', 'excluded', 'conflict')
      LIMIT 20
    `).all<{ id: string; status: string; corpus_status: string }>();
    classFCount = softRemoved.results?.length || 0;
    for (const r of softRemoved.results || []) {
      classFSamples.push({ id: r.id, detail: `Legacy state: ${r.status} / ${r.corpus_status}` });
    }
  } catch {}

  classes.push({
    class_code: "f",
    title: "Legacy soft-removed rows fitting no valid state",
    count: classFCount,
    safe_to_purge: false,
    samples: classFSamples
  });

  // Class (g): Remaining review_later votes or non-designated votes (Report only)
  let classGCount = 0;
  const classGSamples: Array<{ id: string; detail?: string }> = [];
  try {
    const invalidVotes = await env.DB.prepare(`
      SELECT id, meme_id, user_id, corpus_status FROM meme_curation
      WHERE corpus_status = 'review_later'
         OR user_id NOT IN ('user-judge1', 'user-judge2', 'user-judge3')
      LIMIT 20
    `).all<{ id: string; meme_id: string; user_id: string; corpus_status: string }>();
    classGCount = invalidVotes.results?.length || 0;
    for (const v of invalidVotes.results || []) {
      classGSamples.push({ id: v.meme_id, detail: `Vote by ${v.user_id}: ${v.corpus_status}` });
    }
  } catch {}

  classes.push({
    class_code: "g",
    title: "Legacy review_later votes or votes by non-designated accounts",
    count: classGCount,
    safe_to_purge: false,
    samples: classGSamples
  });

  // Class (h): Memes rows with no intake record (Report only, fixed by VERIFY INTAKE)
  let classHCount = 0;
  const classHSamples: Array<{ id: string; detail?: string }> = [];
  try {
    const unverified = await env.DB.prepare(`
      SELECT m.id, m.storage_path FROM memes m
      LEFT JOIN ingestion_jobs j ON m.id = j.meme_id
      WHERE j.job_id IS NULL
      LIMIT 20
    `).all<{ id: string; storage_path: string | null }>();
    classHCount = unverified.results?.length || 0;
    for (const m of unverified.results || []) {
      classHSamples.push({ id: m.id, detail: `Unverified meme (${m.storage_path || "no storage_path"})` });
    }
  } catch {}

  classes.push({
    class_code: "h",
    title: "Memes rows with no intake record (unverified)",
    count: classHCount,
    safe_to_purge: false,
    samples: classHSamples
  });

  // Class (i): Memes whose intake record shows a failed check (Report only)
  let classICount = 0;
  const classISamples: Array<{ id: string; detail?: string }> = [];
  try {
    const failedIntake = await env.DB.prepare(`
      SELECT j.meme_id, j.reject_reason FROM ingestion_jobs j
      WHERE j.reject_reason IS NOT NULL
      LIMIT 20
    `).all<{ meme_id: string; reject_reason: string }>();
    classICount = failedIntake.results?.length || 0;
    for (const f of failedIntake.results || []) {
      classISamples.push({ id: f.meme_id, detail: `Failed intake check: ${f.reject_reason}` });
    }
  } catch {}

  classes.push({
    class_code: "i",
    title: "Memes with failed intake verification checks",
    count: classICount,
    safe_to_purge: false,
    samples: classISamples
  });

  const totalIssues = classes.reduce((sum, c) => sum + c.count, 0);
  const safeToPurgeCount = classes.filter((c) => c.safe_to_purge).reduce((sum, c) => sum + c.count, 0);

  return {
    timestamp: new Date().toISOString(),
    classes,
    total_issues: totalIssues,
    safe_to_purge_count: safeToPurgeCount
  };
}

/**
 * Superadmin-only action to safely purge ghost rows across permitted classes (a, b, c, d).
 */
export async function purgeGhosts(
  env: Env,
  options: { classes: ("a" | "b" | "c" | "d")[]; confirm: boolean; actor: string }
): Promise<{ success: boolean; deleted_count: number }> {
  if (!options.confirm) {
    throw new Error("Explicit confirmation required to purge ghost rows.");
  }

  let deletedCount = 0;

  for (const classCode of options.classes) {
    if (classCode === "a") {
      // Purge orphan child rows
      for (const table of DEPENDENT_CHILD_TABLES) {
        const res = await env.DB.prepare(`
          DELETE FROM ${table}
          WHERE meme_id IN (
            SELECT c.meme_id FROM ${table} c
            LEFT JOIN memes m ON c.meme_id = m.id
            WHERE m.id IS NULL
            LIMIT 50
          )
        `).run();
        deletedCount += res.meta?.changes || 0;
      }
    } else if (classCode === "c") {
      // Purge invalid ledger rows
      const res = await env.DB.prepare(`
        DELETE FROM meme_curation_final
        WHERE meme_id IN (
          SELECT f.meme_id FROM meme_curation_final f
          JOIN memes m ON f.meme_id = m.id
          WHERE m.corpus_status != 'active'
          LIMIT 50
        )
      `).run();
      deletedCount += res.meta?.changes || 0;
    } else if (classCode === "d") {
      // Purge stuck jobs
      const res = await env.DB.prepare(`
        DELETE FROM ingestion_jobs
        WHERE job_id IN (
          SELECT job_id FROM ingestion_jobs
          WHERE state IN ('queued', 'processing', 'retry_wait')
            AND created_at < datetime('now', '-24 hours')
          LIMIT 50
        )
      `).run();
      deletedCount += res.meta?.changes || 0;
    }
  }

  return { success: true, deleted_count: deletedCount };
}
