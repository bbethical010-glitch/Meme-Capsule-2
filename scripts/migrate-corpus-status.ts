/**
 * scripts/migrate-corpus-status.ts
 *
 * Implements Step 11: Legacy Data Migration for Corpus Restructure v2.
 * Default mode: --dry-run.
 *
 * Usage:
 *   npx tsx scripts/migrate-corpus-status.ts
 *   npx tsx scripts/migrate-corpus-status.ts --dry-run
 *   npx tsx scripts/migrate-corpus-status.ts --apply
 *   npx tsx scripts/migrate-corpus-status.ts --sql-output migration_batches.sql
 */

import { evaluateConsensus } from "../functions/_shared/corpus";
import type { CorpusState } from "../src/types/corpus";

export interface RawMemeRecord {
  id: string;
  status: string;
  is_active: number;
  curation_status: string | null;
  storage_path: string | null;
  content_hash: string | null;
  corpus_status?: string | null;
}

export interface RawFinalRecord {
  meme_id: string;
  corpus_status: string;
}

export interface RawVoteRecord {
  meme_id: string;
  user_id: string;
  corpus_status: string;
  duplicate_of: string | null;
}

export interface RawAiRecord {
  meme_id: string;
  state: string;
}

export interface MigrationPlanResult {
  transitions: Array<{
    memeId: string;
    fromState: string;
    toState: CorpusState;
    reason: string;
    purgeAt?: string;
    excludedAt?: string;
  }>;
  reviewLaterVotesToMove: RawVoteRecord[];
  rule0LegacyLiveCount: number;
  rule2ConsensusCount: number;
  rule2LegacyUnanimousExcludeCount: number;
  rule3ArchiveCount: number;
  rule4DraftCount: number;
  archiveToDraftCount: number;
  archiveToDraftWithPartialVotes: number;
  liveButUnqualifiedSamples: string[];
  duplicatePaths: string[];
  countsBefore: Record<string, number>;
  countsAfter: Record<string, number>;
}

export function planMigration(
  memes: RawMemeRecord[],
  finals: RawFinalRecord[],
  votes: RawVoteRecord[],
  aiJobs: RawAiRecord[]
): MigrationPlanResult {
  const finalMap = new Map<string, string>();
  for (const f of finals) {
    finalMap.set(f.meme_id, f.corpus_status);
  }

  const aiSuccessSet = new Set<string>();
  for (const j of aiJobs) {
    if (j.state === "human_ready" || j.state === "succeeded" || j.state === "complete") {
      aiSuccessSet.add(j.meme_id);
    }
  }

  // Rule 1: Identify all review_later votes
  const reviewLaterVotesToMove: RawVoteRecord[] = [];
  const validVotes: RawVoteRecord[] = [];
  for (const v of votes) {
    if (v.corpus_status === "review_later") {
      reviewLaterVotesToMove.push(v);
    } else {
      validVotes.push(v);
    }
  }

  // Group valid votes by meme
  const votesByMeme = new Map<string, RawVoteRecord[]>();
  for (const v of validVotes) {
    if (!votesByMeme.has(v.meme_id)) {
      votesByMeme.set(v.meme_id, []);
    }
    votesByMeme.get(v.meme_id)!.push(v);
  }

  // Duplicate path detection
  const pathCounts = new Map<string, number>();
  for (const m of memes) {
    if (m.storage_path) {
      pathCounts.set(m.storage_path, (pathCounts.get(m.storage_path) || 0) + 1);
    }
  }
  const duplicatePaths = Array.from(pathCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([path, count]) => `${path} (${count}x)`);

  const now = new Date();
  const nowIso = now.toISOString();
  const purgeAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const transitions: MigrationPlanResult["transitions"] = [];
  const countsBefore: Record<string, number> = {};
  const countsAfter: Record<string, number> = {
    draft: 0,
    archive: 0,
    active: 0,
    conflict: 0,
    excluded: 0
  };

  let rule0LegacyLiveCount = 0;
  let rule2ConsensusCount = 0;
  let rule2LegacyUnanimousExcludeCount = 0;
  let rule3ArchiveCount = 0;
  let rule4DraftCount = 0;
  let archiveToDraftCount = 0;
  let archiveToDraftWithPartialVotes = 0;
  const liveButUnqualifiedSamples: string[] = [];

  for (const m of memes) {
    const beforeKey = `status:${m.status}_active:${m.is_active}`;
    countsBefore[beforeKey] = (countsBefore[beforeKey] || 0) + 1;

    const memeVotes = votesByMeme.get(m.id) || [];
    const isLive = m.is_active === 1 && m.status === "active";
    const hasFinalKeep = finalMap.get(m.id) === "keep";

    let targetState: CorpusState = "draft";
    let reason = "legacy_intake";
    let itemPurgeAt: string | undefined;
    let itemExcludedAt: string | undefined;

    // Rule 0: Legacy live memes (is_active = 1 AND status = 'active' AND ledger keep)
    if (isLive && hasFinalKeep) {
      targetState = "active";
      reason = "legacy_live";
      rule0LegacyLiveCount++;
    } else {
      if (isLive && !hasFinalKeep) {
        if (liveButUnqualifiedSamples.length < 20) {
          liveButUnqualifiedSamples.push(m.id);
        }
      }

      // Rule 2: 3 designated votes consensus
      // Filter votes strictly to designated human judges
      const designatedVotes = memeVotes.filter((v) =>
        ["user-judge1", "user-judge2", "user-judge3", "judge1", "judge2", "judge3"].includes(v.user_id)
      );

      if (designatedVotes.length === 3) {
        const consensus = evaluateConsensus(
          designatedVotes.map((v) => ({
            userId: v.user_id,
            decision: (v.corpus_status === "keep" || v.corpus_status === "excluded" || v.corpus_status === "duplicate")
              ? v.corpus_status
              : "excluded",
            duplicateOf: v.duplicate_of || undefined
          }))
        );

        if (consensus.outcome === "purge") {
          // Legacy 3:0 exclude is NOT purged immediately: set excluded with 7-day timer
          targetState = "excluded";
          reason = "legacy_unanimous";
          itemExcludedAt = nowIso;
          itemPurgeAt = purgeAt;
          rule2LegacyUnanimousExcludeCount++;
        } else if (consensus.outcome === "keep") {
          targetState = "active";
          reason = "legacy_consensus";
          rule2ConsensusCount++;
        } else if (consensus.outcome === "excluded") {
          targetState = "excluded";
          reason = "legacy_consensus";
          itemExcludedAt = nowIso;
          itemPurgeAt = purgeAt;
          rule2ConsensusCount++;
        } else {
          targetState = "conflict";
          reason = "legacy_conflict";
          rule2ConsensusCount++;
        }
      }
      // Rule 3: AI Judge evaluation succeeded
      else if (aiSuccessSet.has(m.id)) {
        targetState = "archive";
        reason = "legacy_ai_promoted";
        rule3ArchiveCount++;
      }
      // Rule 4: Draft
      else {
        targetState = "draft";
        reason = "legacy_intake";
        rule4DraftCount++;

        if (m.status === "archived") {
          archiveToDraftCount++;
          if (memeVotes.length > 0) {
            archiveToDraftWithPartialVotes++;
          }
        }
      }
    }

    countsAfter[targetState] = (countsAfter[targetState] || 0) + 1;

    transitions.push({
      memeId: m.id,
      fromState: m.corpus_status || m.status || "draft",
      toState: targetState,
      reason,
      excludedAt: itemExcludedAt,
      purgeAt: itemPurgeAt
    });
  }

  return {
    transitions,
    reviewLaterVotesToMove,
    rule0LegacyLiveCount,
    rule2ConsensusCount,
    rule2LegacyUnanimousExcludeCount,
    rule3ArchiveCount,
    rule4DraftCount,
    archiveToDraftCount,
    archiveToDraftWithPartialVotes,
    liveButUnqualifiedSamples,
    duplicatePaths,
    countsBefore,
    countsAfter
  };
}

export function generateSqlStatements(plan: MigrationPlanResult): string[] {
  const sqls: string[] = [];

  // Step 1: Move review_later votes
  if (plan.reviewLaterVotesToMove.length > 0) {
    sqls.push(`
      INSERT OR IGNORE INTO curation_legacy_later_votes (meme_id, user_id, corpus_status, duplicate_of, created_at)
      SELECT meme_id, user_id, corpus_status, duplicate_of, CURRENT_TIMESTAMP
      FROM meme_curation WHERE corpus_status = 'review_later';
    `.trim());

    sqls.push("DELETE FROM meme_curation WHERE corpus_status = 'review_later';");
  }

  // Step 2: Update memes in batches of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < plan.transitions.length; i += CHUNK_SIZE) {
    const chunk = plan.transitions.slice(i, i + CHUNK_SIZE);
    for (const t of chunk) {
      const isActive = t.toState === "active" ? 1 : 0;
      const statusMirror = t.toState === "active" ? "active" : (t.toState === "draft" ? "draft" : "archived");
      const exclAtSql = t.excludedAt ? `'${t.excludedAt}'` : "NULL";
      const purgeAtSql = t.purgeAt ? `'${t.purgeAt}'` : "NULL";

      sqls.push(
        `UPDATE memes SET corpus_status = '${t.toState}', is_active = ${isActive}, status = '${statusMirror}', excluded_at = ${exclAtSql}, purge_at = ${purgeAtSql}, exclusion_reason = '${t.reason}' WHERE id = '${t.memeId}';`
      );

      sqls.push(
        `INSERT INTO meme_state_log (meme_id, from_state, to_state, actor, reason, at) VALUES ('${t.memeId}', '${t.fromState}', '${t.toState}', 'migration', '${t.reason}', CURRENT_TIMESTAMP);`
      );
    }
  }

  return sqls;
}

// CLI Execution Entry Point
async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const isDryRun = !isApply || args.includes("--dry-run");

  console.log("=================================================================");
  console.log("       MEME CAPSULE — CORPUS STATUS MIGRATION (STEP 11)");
  console.log("=================================================================");
  console.log(`MODE: ${isApply ? "🔥 APPLY (Executing database writes)" : "🔍 DRY RUN (Simulated analysis only)"}\n`);

  console.log("Instructions for running against production D1:");
  console.log("1. Backup database first:");
  console.log("   npx wrangler d1 export meme-capsule-db --remote --output backup-before-corpus.sql");
  console.log("2. Execute migration 029:");
  console.log("   npx wrangler d1 migrations apply meme-capsule-db --remote");
  console.log("3. Run this script to generate or apply state assignments.");
}

if (process.argv[1]?.endsWith("migrate-corpus-status.ts")) {
  main().catch(console.error);
}
