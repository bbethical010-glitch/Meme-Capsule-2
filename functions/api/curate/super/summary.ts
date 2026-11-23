/**
 * GET /api/curate/super/summary
 * 
 * Aggregates multi-judge curation statistics, consensus metrics, and resolution progress.
 * Now unified with /api/admin/corpus/summary to guarantee single source of truth across all portals.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";
import { getCorpusSummary } from "../../../_shared/corpus";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);
    if (!sessionUser || sessionUser.role !== "superadmin") {
      return json({ error: "Superadmin credentials required." }, { status: 401 });
    }

    const summary = await getCorpusSummary(env);
    return json(summary);
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error computing curation summary";
    return json({ error: msg }, { status: 500 });
  }
};
