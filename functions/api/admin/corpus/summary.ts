import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { getCorpusSummary } from "../../../_shared/corpus";

/**
 * GET /api/admin/corpus/summary
 *
 * Single Source of Truth for all Meme Capsule counts.
 * Protected by Admin token (Bearer or X-Admin-Token) or Curator/SuperAdmin session.
 * Total is strictly the sum of the 5 states.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  const sessionUser = adminError ? await validateSession(request, env) : null;

  if (adminError && !sessionUser) {
    return json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const summary = await getCorpusSummary(env);
    return json(summary);
  } catch (error: any) {
    return json({
      error: "Failed calculating corpus summary",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};
