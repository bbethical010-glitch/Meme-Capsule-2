/**
 * GET /api/curate/super/summary
 * 
 * Aggregates multi-judge curation statistics, consensus metrics, and resolution progress.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";

interface JudgeCountRow {
  user_id: string;
  user_name: string;
  total_reviewed: number;
  kept: number;
  excluded: number;
  duplicates: number;
  review_later: number;
  force_removed?: number;
  last_active: string;
}

interface CurationRow {
  meme_id: string;
  user_id: string;
  corpus_status: string;
  duplicate_of: string | null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);
    if (!sessionUser || sessionUser.role !== "superadmin") {
      return json({ error: "Superadmin credentials required." }, { status: 401 });
    }

    // 1. Total memes in corpus (excluding force-removed)
    let totalMemes = 0;
    try {
      const totalCountRes = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM memes WHERE id NOT IN (SELECT meme_id FROM meme_force_removals)"
      ).first<{ cnt: number }>();
      totalMemes = totalCountRes?.cnt ?? 0;
    } catch {
      const totalCountRes = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM memes"
      ).first<{ cnt: number }>();
      totalMemes = totalCountRes?.cnt ?? 0;
    }

    // 2. Final resolved count (Authoritative Keep / Active vs Excluded)
    let resolvedActiveCount = 0;
    let resolvedExcludedCount = 0;
    let totalResolvedCount = 0;
    try {
      const finalRes = await env.DB.prepare(`
        SELECT 
          COUNT(*) as total_resolved,
          SUM(CASE WHEN corpus_status = 'keep' THEN 1 ELSE 0 END) as resolved_active,
          SUM(CASE WHEN corpus_status = 'excluded' THEN 1 ELSE 0 END) as resolved_excluded
        FROM meme_curation_final
      `).first<{ total_resolved: number; resolved_active: number; resolved_excluded: number }>();

      totalResolvedCount = finalRes?.total_resolved ?? 0;
      resolvedActiveCount = finalRes?.resolved_active ?? 0;
      resolvedExcludedCount = finalRes?.resolved_excluded ?? 0;
    } catch {
      totalResolvedCount = 0;
      resolvedActiveCount = 0;
      resolvedExcludedCount = 0;
    }

    // 3. Per-judge progress breakdown (All 5 configured judges: 3 Human + 2 AI)
    // Using LEFT JOIN on cat_users ensures every judge is represented even with 0 reviews
    const { results: judgeResults } = await env.DB.prepare(`
      SELECT 
        u.id as user_id,
        u.display_name as user_name,
        COUNT(c.id) as total_reviewed,
        SUM(CASE WHEN c.corpus_status = 'keep' THEN 1 ELSE 0 END) as kept,
        SUM(CASE WHEN c.corpus_status = 'excluded' THEN 1 ELSE 0 END) as excluded,
        SUM(CASE WHEN c.corpus_status = 'duplicate' THEN 1 ELSE 0 END) as duplicates,
        SUM(CASE WHEN c.corpus_status = 'review_later' THEN 1 ELSE 0 END) as review_later,
        MAX(c.reviewed_at) as last_active
      FROM cat_users u
      LEFT JOIN meme_curation c ON c.user_id = u.id
      WHERE u.username IN ('judge1', 'judge2', 'judge3', 'judge4', 'judge5')
      GROUP BY u.id, u.display_name, u.username
      ORDER BY 
        CASE u.username
          WHEN 'judge1' THEN 1
          WHEN 'judge2' THEN 2
          WHEN 'judge3' THEN 3
          WHEN 'judge4' THEN 4
          WHEN 'judge5' THEN 5
          ELSE 6
        END ASC
    `).all<JudgeCountRow>();

    // Query force-removals per judge if table exists
    const { results: forceRemovedRows } = await env.DB.prepare(`
      SELECT removed_by, COUNT(*) as cnt
      FROM meme_force_removals
      GROUP BY removed_by
    `).all<{ removed_by: string; cnt: number }>().catch(() => ({ results: [] as { removed_by: string; cnt: number }[] }));
    const forceRemovedMap = new Map((forceRemovedRows || []).map((r) => [r.removed_by, r.cnt]));

    // Query total force-removals across entire database
    let totalForceRemoved = 0;
    try {
      const frRes = await env.DB.prepare("SELECT COUNT(*) as cnt FROM meme_force_removals").first<{ cnt: number }>();
      totalForceRemoved = frRes?.cnt ?? 0;
    } catch {
      totalForceRemoved = 0;
    }

    const judges = (judgeResults || []).map((j) => {
      const purged = forceRemovedMap.get(j.user_id) || 0;
      const activeReviewed = j.total_reviewed || 0;
      return {
        ...j,
        total_reviewed: activeReviewed + purged,
        active_reviewed: activeReviewed,
        kept: j.kept || 0,
        excluded: j.excluded || 0,
        duplicates: j.duplicates || 0,
        review_later: j.review_later || 0,
        force_removed: purged
      };
    });

    // Calculate total exclude votes across all judges
    const totalExcludeVotes = judges.reduce((sum, j) => sum + (j.excluded || 0), 0);

    // 4. Consensus & disagreement analysis across multi-judge reviews (Human judges ONLY)
    // As per policy, AI Judges (4 & 5) provide reference context only and NEVER trigger consensus conflicts.
    const { results: allReviews } = await env.DB.prepare(`
      SELECT c.meme_id, c.user_id, c.corpus_status, c.duplicate_of
      FROM meme_curation c
      JOIN cat_users u ON u.id = c.user_id
      WHERE u.username IN ('judge1', 'judge2', 'judge3')
    `).all<CurationRow>();

    const reviews = allReviews || [];
    const memeReviewMap = new Map<string, CurationRow[]>();

    for (const r of reviews) {
      if (!memeReviewMap.has(r.meme_id)) {
        memeReviewMap.set(r.meme_id, []);
      }
      memeReviewMap.get(r.meme_id)!.push(r);
    }

    let unanimousKeep = 0;
    let unanimousExclude = 0;
    let conflicts = 0;
    let singleReview = 0;
    let reviewedMemeCount = memeReviewMap.size;

    for (const [, statuses] of memeReviewMap.entries()) {
      if (statuses.length === 1) {
        singleReview++;
      } else if (statuses.length > 1) {
        if (statuses.length === 3) {
          const distinctStatuses = new Set(statuses.map((vote) => vote.corpus_status));
          if (distinctStatuses.size === 3) {
            conflicts++;
          } else {
            const duplicateVotes = statuses.filter((vote) => vote.corpus_status === "duplicate");
            if (
              duplicateVotes.length >= 2 &&
              (duplicateVotes.some((vote) => !vote.duplicate_of?.trim()) ||
                new Set(duplicateVotes.map((vote) => vote.duplicate_of?.trim() || null)).size > 1)
            ) conflicts++;
          }
          if (distinctStatuses.size === 1) {
            const onlyStatus = statuses[0].corpus_status;
            if (onlyStatus === "keep") unanimousKeep++;
            else if (onlyStatus === "excluded") unanimousExclude++;
          }
        }
      }
    }

    // 5. Query pending unfinalized majority and unanimous consensus counts for instant action CTAs
    let majorityKeepCount = 0;
    let majorityExcludeCount = 0;
    let pendingUnanimousKeep = 0;
    let pendingUnanimousExclude = 0;

    try {
      const { results: pendingConsensusRows } = await env.DB.prepare(`
        SELECT 
          c.meme_id,
          SUM(CASE WHEN c.corpus_status = 'keep' THEN 1 ELSE 0 END) as keep_count,
          SUM(CASE WHEN c.corpus_status = 'excluded' THEN 1 ELSE 0 END) as exclude_count,
          COUNT(*) as total_reviews
        FROM meme_curation c
        JOIN cat_users u ON u.id = c.user_id
        WHERE c.meme_id NOT IN (SELECT meme_id FROM meme_curation_final)
          AND u.username IN ('judge1', 'judge2', 'judge3')
        GROUP BY c.meme_id
        HAVING total_reviews >= 2
      `).all<{ meme_id: string; keep_count: number; exclude_count: number; total_reviews: number }>();

      for (const r of (pendingConsensusRows || [])) {
        if (r.keep_count >= 2) {
          majorityKeepCount++;
          if (r.keep_count === r.total_reviews) pendingUnanimousKeep++;
        } else if (r.exclude_count >= 2) {
          majorityExcludeCount++;
          if (r.exclude_count === r.total_reviews) pendingUnanimousExclude++;
        }
      }
    } catch {
      // Graceful fallback
    }

    const unreviewed = Math.max(0, totalMemes - reviewedMemeCount);

    return json({
      total_memes: totalMemes,
      resolved_count: resolvedActiveCount, // Canonical Authoritative Active count
      resolved_active_count: resolvedActiveCount,
      resolved_excluded_count: resolvedExcludedCount,
      total_resolved_count: totalResolvedCount,
      total_force_removed: totalForceRemoved,
      total_exclude_votes: totalExcludeVotes,
      percent_resolved: totalMemes > 0 ? Math.round((resolvedActiveCount / totalMemes) * 100) : 0,
      consensus_metrics: {
        unreviewed,
        single_review: singleReview,
        unanimous_keep: unanimousKeep,
        unanimous_exclude: unanimousExclude,
        majority_keep: majorityKeepCount,
        majority_exclude: majorityExcludeCount,
        pending_majority_keep: majorityKeepCount,
        pending_majority_exclude: majorityExcludeCount,
        pending_unanimous_keep: pendingUnanimousKeep,
        pending_unanimous_exclude: pendingUnanimousExclude,
        conflicts,
        total_with_reviews: reviewedMemeCount
      },
      judges
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error generating superadmin summary";
    return json({ error: msg }, { status: 500 });
  }
};
