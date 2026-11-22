import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { runLegacyDataMigration } from "../../../_shared/corpus";

/**
 * POST /api/admin/corpus/migrate-legacy
 *
 * Executes the legacy classification migration (Step 11).
 * Translates default 'draft' memes into their true states: active, archive, conflict, excluded, draft.
 * Protected by Admin API token or Superadmin session.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  const sessionUser = adminError ? await validateSession(request, env) : null;

  if (adminError && (!sessionUser || (sessionUser.role !== "superadmin" && sessionUser.role !== "admin"))) {
    return json({ error: "Authentication required (Admin Token or Superadmin session)." }, { status: 401 });
  }

  const actor = sessionUser ? `${sessionUser.role}:${sessionUser.username}` : "admin_token";

  try {
    const result = await runLegacyDataMigration(env, actor);
    return json({
      success: true,
      message: "Legacy corpus migration executed successfully.",
      ...result
    });
  } catch (error: any) {
    return json({
      success: false,
      error: "Migration failed",
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};
