import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { getCorpusSummary } from "../../../_shared/corpus";

/**
 * GET /api/admin/corpus/summary
 *
 * Single Source of Truth for all Meme Capsule counts.
 * Protected by Admin token or Curator session.
 * Total is strictly the sum of the 5 states.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authHeader = request.headers.get("Authorization");
  const adminToken = env.ADMIN_API_TOKEN;
  const isSuperToken = Boolean(authHeader && adminToken && authHeader === `Bearer ${adminToken}`);
  const sessionUser = await validateSession(request, env);

  if (!isSuperToken && !sessionUser) {
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
