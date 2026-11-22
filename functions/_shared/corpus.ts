import type { Env } from "./d1r2";

export const CORPUS_STATES = ["draft", "archive", "active", "excluded", "conflict"] as const;
export type CorpusState = typeof CORPUS_STATES[number];

export const VOTE_OPTIONS = ["keep", "excluded", "duplicate"] as const;
export type VoteDecision = typeof VOTE_OPTIONS[number];

export const DESIGNATED_JUDGE_IDS = new Set(["user-judge1", "user-judge2", "user-judge3"]);
export const DESIGNATED_JUDGE_USERNAMES = new Set(["judge1", "judge2", "judge3"]);

export const STATE_METADATA: Record<CorpusState, { label: string; color: string; description: string }> = {
  draft: {
    label: "DRAFT",
    color: "#8e8e93",
    description: "New memes from any intake route. Not AI-reviewed."
  },
  archive: {
    label: "ARCHIVE",
    color: "#f4c300",
    description: "AI Judge review succeeded; waiting for human judge votes."
  },
  active: {
    label: "ACTIVE",
    color: "#34c759",
    description: "Human consensus Keep. Served to mobile app."
  },
  excluded: {
    label: "EXCLUDED",
    color: "#ff3b30",
    description: "Consensus Exclude (2:1) or Duplicate majority. Kept 7 days before purge."
  },
  conflict: {
    label: "CONFLICT",
    color: "#ff9500",
    description: "True 1:1:1 split across judges. Awaiting superadmin arbitration."
  }
};

export const LEGAL_TRANSITIONS: Record<CorpusState, readonly (CorpusState | "purged")[]> = {
  draft: ["archive", "purged"],
  archive: ["active", "excluded", "conflict", "purged"],
  active: ["purged"],
  conflict: ["active", "excluded", "purged"],
  excluded: ["active", "conflict", "excluded", "purged"]
};

export function isLegalTransition(from: CorpusState | "new", to: CorpusState | "purged"): boolean {
  if (from === "new") return to === "draft";
  if (to === "purged") return true; // Any state can be purged via Force Remove / sync / ghost purge
  const allowed = LEGAL_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export interface RawJudgeVote {
  user_id?: string;
  userId?: string;
  username?: string | null;
  corpus_status?: string; // 'keep' | 'excluded' | 'duplicate'
  decision?: string;
  duplicate_of?: string | null;
  duplicateOf?: string | null;
  topics?: string | string[] | null;
  tone?: string | null;
  humour_mechanisms?: string | string[] | null;
}

export type ConsensusOutcome =
  | { outcome: "pending"; votesCount: number }
  | { outcome: "active"; reason: "consensus"; split: string }
  | { outcome: "purge"; reason: "unanimous_exclude"; split: string }
  | { outcome: "excluded"; reason: "consensus" | "duplicate"; split: string }
  | { outcome: "conflict"; reason: "split"; split: string };

/**
 * Pure function: Evaluates 3-human consensus over designated judges.
 * AI Judge 4 is advisory and never votes.
 * Exactly 3 votes required from designated human judges.
 */
export function evaluateConsensus(votes: RawJudgeVote[]): ConsensusOutcome {
  // Deduplicate by user_id, keeping only designated human judges
  const validVotesMap = new Map<string, VoteDecision>();
  for (const v of votes) {
    const uid = v.user_id || v.userId || "";
    const isDesignated =
      DESIGNATED_JUDGE_IDS.has(uid) ||
      DESIGNATED_JUDGE_USERNAMES.has(uid) ||
      (v.username && DESIGNATED_JUDGE_USERNAMES.has(v.username));
    if (!isDesignated) continue;
    
    const decision = (v.corpus_status || v.decision) as VoteDecision;
    if (decision === "keep" || decision === "excluded" || decision === "duplicate") {
      validVotesMap.set(uid, decision);
    }
  }

  const validVotes = Array.from(validVotesMap.values());
  if (validVotes.length < 3) {
    return { outcome: "pending", votesCount: validVotes.length };
  }

  let K = 0;
  let E = 0;
  let D = 0;
  for (const dec of validVotes) {
    if (dec === "keep") K++;
    else if (dec === "excluded") E++;
    else if (dec === "duplicate") D++;
  }

  const split = `${K}:${E}:${D}`;

  // Checked in exact order specified by Decision Matrix:
  // 1. K >= 2 -> active
  if (K >= 2) {
    return { outcome: "active", reason: "consensus", split };
  }
  // 2. E = 3 -> purge immediately
  if (E === 3) {
    return { outcome: "purge", reason: "unanimous_exclude", split };
  }
  // 3. E = 2 -> excluded (consensus)
  if (E === 2) {
    return { outcome: "excluded", reason: "consensus", split };
  }
  // 4. D >= 2 -> excluded (duplicate)
  if (D >= 2) {
    return { outcome: "excluded", reason: "duplicate", split };
  }
  // 5. Otherwise (1:1:1 split) -> conflict
  return { outcome: "conflict", reason: "split", split };
}

export interface TransitionOptions {
  actor: string;
  reason?: string;
  expectedFrom?: CorpusState;
}

export interface PurgeOptions {
  actor: string;
  reason: string;
  detail?: string; // e.g. JSON string of votes or context
}

/**
 * All tables with a meme_id column that MUST be purged when a meme is deleted.
 * Executed in strict foreign-key / dependency order before deleting from `memes`.
 */
export const DEPENDENT_CHILD_TABLES = [
  "meme_curation",
  "meme_curation_final",
  "ai_curation_predictions",
  "meme_events",
  "meme_analytics",
  "meme_daily_stats",
  "cat_decisions",
  "cat_consensus",
  "ai_judge_processed",
  "ingestion_ai_evaluations",
  "ingestion_jobs",
  "android_analytics_events"
] as const;

/**
 * Resolves secondary taxonomy metadata (topics, tone, humour_mechanisms)
 * when transitioning a meme into ACTIVE state.
 * Uses majority human vote (frequency >= 2) with fallback to AI Judge.
 */
async function resolveActiveMetadata(env: Env, memeId: string): Promise<{
  topics: string;
  tone: string | null;
  humour_mechanisms: string;
}> {
  const votes = await env.DB.prepare(`
    SELECT topics, tone, humour_mechanisms
    FROM meme_curation
    WHERE meme_id = ? AND corpus_status = 'keep'
  `).bind(memeId).all<{ topics: string | null; tone: string | null; humour_mechanisms: string | null }>();

  const aiRow = await env.DB.prepare(`
    SELECT topics, tone, humour_mechanisms
    FROM ai_curation_predictions
    WHERE meme_id = ?
  `).bind(memeId).first<{ topics: string | null; tone: string | null; humour_mechanisms: string | null }>();

  const topicCounts = new Map<string, number>();
  const toneCounts = new Map<string, number>();
  const mechCounts = new Map<string, number>();

  for (const v of votes.results || []) {
    try {
      const topList: string[] = typeof v.topics === "string" ? JSON.parse(v.topics) : (v.topics || []);
      for (const t of topList) topicCounts.set(t, (topicCounts.get(t) || 0) + 1);
    } catch {}
    if (v.tone) toneCounts.set(v.tone, (toneCounts.get(v.tone) || 0) + 1);
    try {
      const mechList: string[] = typeof v.humour_mechanisms === "string" ? JSON.parse(v.humour_mechanisms) : (v.humour_mechanisms || []);
      for (const m of mechList) mechCounts.set(m, (mechCounts.get(m) || 0) + 1);
    } catch {}
  }

  const majorityTopics = Array.from(topicCounts.entries()).filter(([, cnt]) => cnt >= 2).map(([t]) => t);
  const majorityTone = Array.from(toneCounts.entries()).find(([, cnt]) => cnt >= 2)?.[0] || null;
  const majorityMechs = Array.from(mechCounts.entries()).filter(([, cnt]) => cnt >= 2).map(([m]) => m);

  let finalTopics = majorityTopics;
  let finalTone = majorityTone;
  let finalMechs = majorityMechs;

  if (aiRow) {
    if (finalTopics.length === 0 && aiRow.topics) {
      try { finalTopics = JSON.parse(aiRow.topics); } catch {}
    }
    if (!finalTone && aiRow.tone) {
      finalTone = aiRow.tone;
    }
    if (finalMechs.length === 0 && aiRow.humour_mechanisms) {
      try { finalMechs = JSON.parse(aiRow.humour_mechanisms); } catch {}
    }
  }

  return {
    topics: JSON.stringify(finalTopics.slice(0, 3)),
    tone: finalTone,
    humour_mechanisms: JSON.stringify(finalMechs.slice(0, 2))
  };
}

/**
 * Authoritative single state writer for meme transitions.
 * Conditional on expectedFrom (guards against race conditions).
 * Atomic D1 batch execution.
 */
export async function transitionMeme(
  env: Env,
  memeId: string,
  toState: CorpusState,
  options: TransitionOptions
): Promise<void> {
  const currentMeme = await env.DB.prepare(
    "SELECT id, corpus_status, excluded_at, purge_at FROM memes WHERE id = ?"
  ).bind(memeId).first<{ id: string; corpus_status: CorpusState; excluded_at: string | null; purge_at: string | null }>();

  if (!currentMeme) {
    throw new Error(`Meme ${memeId} not found.`);
  }

  const fromState = currentMeme.corpus_status;

  if (options.expectedFrom && fromState !== options.expectedFrom) {
    throw new Error(`Stale state transition: expected meme ${memeId} to be in ${options.expectedFrom}, but was in ${fromState}.`);
  }

  if (!isLegalTransition(fromState, toState)) {
    throw new Error(`Illegal state transition from ${fromState} to ${toState} for meme ${memeId}.`);
  }

  const nowIso = new Date().toISOString();
  let newExcludedAt: string | null = null;
  let newPurgeAt: string | null = null;
  let newExclusionReason: string | null = null;

  if (toState === "excluded") {
    // If already excluded, do not reset existing timer!
    if (fromState === "excluded" && currentMeme.excluded_at && currentMeme.purge_at) {
      newExcludedAt = currentMeme.excluded_at;
      newPurgeAt = currentMeme.purge_at;
    } else {
      const purgeDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      newExcludedAt = nowIso;
      newPurgeAt = purgeDate.toISOString();
    }
    newExclusionReason = options.reason || "consensus";
  }

  // Compatibility mirrors:
  const isActiveMirror = toState === "active" ? 1 : 0;
  const statusMirror = toState === "active" ? "active" : (toState === "draft" ? "draft" : "archived");

  const stmts: D1PreparedStatement[] = [];

  // Conditional update on current state
  stmts.push(
    env.DB.prepare(`
      UPDATE memes
      SET corpus_status = ?,
          is_active = ?,
          status = ?,
          excluded_at = ?,
          purge_at = ?,
          exclusion_reason = ?
      WHERE id = ? AND corpus_status = ?
    `).bind(
      toState,
      isActiveMirror,
      statusMirror,
      newExcludedAt,
      newPurgeAt,
      newExclusionReason,
      memeId,
      fromState
    )
  );

  // If entering active, upsert meme_curation_final with corpus_status = 'keep'
  if (toState === "active") {
    const meta = await resolveActiveMetadata(env, memeId);
    stmts.push(
      env.DB.prepare(`
        INSERT INTO meme_curation_final (
          meme_id, corpus_status, topics, tone, humour_mechanisms, resolved_by, resolved_at, updated_at
        ) VALUES (?, 'keep', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(meme_id) DO UPDATE SET
          corpus_status = 'keep',
          topics = excluded.topics,
          tone = excluded.tone,
          humour_mechanisms = excluded.humour_mechanisms,
          resolved_by = excluded.resolved_by,
          updated_at = excluded.updated_at
      `).bind(
        memeId,
        meta.topics,
        meta.tone,
        meta.humour_mechanisms,
        options.actor,
        nowIso,
        nowIso
      )
    );
  } else {
    // For any non-active state, remove ledger row
    stmts.push(
      env.DB.prepare("DELETE FROM meme_curation_final WHERE meme_id = ?").bind(memeId)
    );
  }

  // Record permanent audit log in meme_state_log
  stmts.push(
    env.DB.prepare(`
      INSERT INTO meme_state_log (meme_id, from_state, to_state, actor, reason, at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      memeId,
      fromState,
      toState,
      options.actor,
      options.reason || null,
      nowIso
    )
  );

  const results = await env.DB.batch(stmts);
  const updateRes = results[0];
  if (!updateRes.meta?.changes) {
    throw new Error(`Concurrent modification prevented state transition for meme ${memeId}.`);
  }
}

/**
 * Destructive full purge (R2 physical object + all D1 dependent child tables + memes row).
 * Always deletes R2 first to prevent resurrection of orphan files.
 * Idempotent. Logs to meme_purge_log.
 */
export async function purgeMeme(
  env: Env,
  memeId: string,
  options: PurgeOptions
): Promise<{ success: boolean; r2_deleted: number }> {
  const memeRow = await env.DB.prepare(
    "SELECT id, storage_path, image_url, content_hash FROM memes WHERE id = ?"
  ).bind(memeId).first<{ id: string; storage_path: string | null; image_url: string | null; content_hash: string | null }>();

  const storageKey = memeRow?.storage_path
    ? memeRow.storage_path.replace(/^\/+/, "")
    : (memeRow?.image_url ? new URL(memeRow.image_url, "https://dummy").pathname.replace(/^\/+/, "") : null);

  let r2Deleted = 0;
  if (storageKey && env.MEMES_BUCKET) {
    try {
      await env.MEMES_BUCKET.delete(storageKey);
      r2Deleted = 1;
    } catch (r2Err: any) {
      // Missing object is treated as success (already gone); other errors must abort!
      const msg = String(r2Err?.message || r2Err);
      if (!msg.toLowerCase().includes("not found") && !msg.toLowerCase().includes("404")) {
        throw new Error(`R2 delete failed for ${storageKey}: ${msg}. D1 deletion aborted.`);
      }
      r2Deleted = 0;
    }
  }

  const stmts: D1PreparedStatement[] = [];

  // Delete all dependent child rows
  for (const table of DEPENDENT_CHILD_TABLES) {
    stmts.push(
      env.DB.prepare(`DELETE FROM ${table} WHERE meme_id = ?`).bind(memeId)
    );
  }

  // Delete the root meme row
  stmts.push(
    env.DB.prepare("DELETE FROM memes WHERE id = ?").bind(memeId)
  );

  // Write immutable purge log
  stmts.push(
    env.DB.prepare(`
      INSERT INTO meme_purge_log (meme_id, storage_path, content_hash, reason, actor, r2_deleted, detail, purged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    `).bind(
      memeId,
      memeRow?.storage_path || null,
      memeRow?.content_hash || null,
      options.reason,
      options.actor,
      r2Deleted,
      options.detail || null
    )
  );

  await env.DB.batch(stmts);
  return { success: true, r2_deleted: r2Deleted };
}

/**
 * Reads votes from meme_curation, evaluates consensus, and applies outcome.
 * Safe to call concurrently or repeatedly.
 */
export async function applyConsensus(
  env: Env,
  memeId: string
): Promise<{ settled: boolean; outcome: string; split?: string }> {
  const currentMeme = await env.DB.prepare(
    "SELECT id, corpus_status FROM memes WHERE id = ?"
  ).bind(memeId).first<{ id: string; corpus_status: CorpusState }>();

  if (!currentMeme) {
    return { settled: false, outcome: "not_found" };
  }

  if (currentMeme.corpus_status !== "archive" && currentMeme.corpus_status !== "excluded") {
    // Only archive and excluded memes can have votes applied or re-evaluated
    return { settled: false, outcome: currentMeme.corpus_status };
  }

  const votesRes = await env.DB.prepare(`
    SELECT c.user_id, u.username, c.corpus_status, c.duplicate_of, c.topics, c.tone, c.humour_mechanisms
    FROM meme_curation c
    LEFT JOIN cat_users u ON c.user_id = u.id
    WHERE c.meme_id = ?
  `).bind(memeId).all<RawJudgeVote>();

  const votes = votesRes.results || [];
  const evalResult = evaluateConsensus(votes);

  if (evalResult.outcome === "pending") {
    return { settled: false, outcome: "pending", split: `votes:${evalResult.votesCount}` };
  }

  if (evalResult.outcome === "purge") {
    await purgeMeme(env, memeId, {
      actor: "consensus_engine",
      reason: "unanimous_exclude",
      detail: JSON.stringify(votes)
    });
    return { settled: true, outcome: "purged", split: evalResult.split };
  }

  if (evalResult.outcome === "active" || evalResult.outcome === "excluded" || evalResult.outcome === "conflict") {
    await transitionMeme(env, memeId, evalResult.outcome, {
      actor: "consensus_engine",
      reason: evalResult.reason,
      expectedFrom: currentMeme.corpus_status
    });
    return { settled: true, outcome: evalResult.outcome, split: evalResult.split };
  }

  return { settled: false, outcome: "unresolved" };
}

let hasCorpusStatusColumnCache: boolean | null = null;

export async function hasCorpusStatusColumn(db: D1Database): Promise<boolean> {
  if (hasCorpusStatusColumnCache !== null) return hasCorpusStatusColumnCache;
  try {
    const info = await db.prepare("PRAGMA table_info(memes)").all<{ name: string }>();
    hasCorpusStatusColumnCache = (info.results || []).some((col) => col.name === "corpus_status");
  } catch {
    hasCorpusStatusColumnCache = false;
  }
  return hasCorpusStatusColumnCache;
}

export interface CorpusSummaryData {
  draft: number;
  archive: number;
  active: number;
  conflict: number;
  excluded: number;
  total: number;
  integrity: {
    ok: boolean;
    rows_in_table: number;
    sum_of_states: number;
  };
  last_maintenance_at: string;
  judges: Array<{
    name: string;
    reviewed: number;
    keep: number;
    exclude: number;
    duplicate: number;
    queue_left: number;
  }>;
  ai_judge: {
    judged: number;
  };
}

/**
 * Authoritative single calculation for Corpus Summary.
 * Shared between Admin and SuperAdmin dashboards.
 * Schema-resilient and optimized with anti-joins for sub-millisecond execution on D1.
 */
export async function getCorpusSummary(env: Env): Promise<CorpusSummaryData> {
  const hasCol = await hasCorpusStatusColumn(env.DB);

  // 1. Authoritative distribution of the 5 states
  let statusRows: { results?: { corpus_status: string; count: number }[] } = { results: [] };

  if (hasCol) {
    statusRows = await env.DB.prepare(`
      SELECT 
        COALESCE(
          corpus_status,
          CASE
            WHEN is_active = 1 AND status = 'active' THEN 'active'
            WHEN curation_status = 'excluded' THEN 'excluded'
            WHEN status = 'archived' THEN 'archive'
            WHEN status = 'draft' THEN 'draft'
            ELSE 'draft'
          END
        ) as corpus_status,
        COUNT(*) as count
      FROM memes
      GROUP BY corpus_status
    `).all<{ corpus_status: string; count: number }>();
  } else {
    statusRows = await env.DB.prepare(`
      SELECT 
        CASE
          WHEN is_active = 1 AND status = 'active' THEN 'active'
          WHEN curation_status = 'excluded' THEN 'excluded'
          WHEN status = 'archived' THEN 'archive'
          WHEN status = 'draft' THEN 'draft'
          ELSE 'draft'
        END as corpus_status,
        COUNT(*) as count
      FROM memes
      GROUP BY corpus_status
    `).all<{ corpus_status: string; count: number }>();
  }

  const counts: Record<CorpusState, number> = {
    draft: 0,
    archive: 0,
    active: 0,
    conflict: 0,
    excluded: 0
  };

  for (const r of statusRows.results || []) {
    const st = r.corpus_status as CorpusState;
    if (st in counts) {
      counts[st] = Number(r.count) || 0;
    }
  }

  const sumOfStates = counts.draft + counts.archive + counts.active + counts.conflict + counts.excluded;

  const totalRow = await env.DB.prepare("SELECT COUNT(*) as count FROM memes").first<{ count: number }>();
  const rowsInTable = Number(totalRow?.count) || 0;
  const ok = rowsInTable === sumOfStates;

  let lastMaintenanceAt = "";
  try {
    const lastRun = await env.DB.prepare(
      "SELECT finished_at FROM corpus_maintenance_runs ORDER BY id DESC LIMIT 1"
    ).first<{ finished_at: string | null }>();
    lastMaintenanceAt = lastRun?.finished_at || "";
  } catch {}

  const { results: judgeUsers } = await env.DB.prepare(`
    SELECT id, username, display_name
    FROM cat_users
    WHERE username IN ('judge1', 'judge2', 'judge3')
    ORDER BY username ASC
  `).all<{ id: string; username: string; display_name: string }>();

  const judgesList = [];
  const archiveFilterSql = hasCol
    ? "(m.corpus_status = 'archive' OR (m.corpus_status IS NULL AND m.status = 'archived'))"
    : "m.status = 'archived'";

  for (const judge of judgeUsers || []) {
    const votesRes = await env.DB.prepare(`
      SELECT c.corpus_status, COUNT(*) as cnt
      FROM meme_curation c
      JOIN memes m ON c.meme_id = m.id
      WHERE c.user_id = ?
      GROUP BY c.corpus_status
    `).bind(judge.id).all<{ corpus_status: string; cnt: number }>();

    let keep = 0;
    let exclude = 0;
    let duplicate = 0;
    for (const v of votesRes.results || []) {
      if (v.corpus_status === "keep") keep = Number(v.cnt) || 0;
      else if (v.corpus_status === "excluded") exclude = Number(v.cnt) || 0;
      else if (v.corpus_status === "duplicate") duplicate = Number(v.cnt) || 0;
    }

    // High-performance anti-join using primary key index instead of slow NOT IN full scan
    const queueLeftRes = await env.DB.prepare(`
      SELECT COUNT(*) as cnt
      FROM memes m
      LEFT JOIN meme_curation c ON m.id = c.meme_id AND c.user_id = ?
      WHERE ${archiveFilterSql}
        AND c.id IS NULL
    `).bind(judge.id).first<{ cnt: number }>();

    judgesList.push({
      name: judge.display_name || judge.username,
      reviewed: keep + exclude + duplicate,
      keep,
      exclude,
      duplicate,
      queue_left: Number(queueLeftRes?.cnt) || 0
    });
  }

  let aiJudged = 0;
  try {
    const aiRes = await env.DB.prepare(`
      SELECT COUNT(DISTINCT meme_id) as cnt
      FROM ingestion_ai_evaluations
      WHERE judge_key = 'judge4' AND state = 'succeeded'
    `).first<{ cnt: number }>();
    aiJudged = Number(aiRes?.cnt) || 0;
  } catch {}

  return {
    draft: counts.draft,
    archive: counts.archive,
    active: counts.active,
    conflict: counts.conflict,
    excluded: counts.excluded,
    total: sumOfStates,
    integrity: {
      ok,
      rows_in_table: rowsInTable,
      sum_of_states: sumOfStates
    },
    last_maintenance_at: lastMaintenanceAt,
    judges: judgesList,
    ai_judge: {
      judged: aiJudged
    }
  };
}
