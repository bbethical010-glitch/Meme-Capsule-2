import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { scanGhosts, purgeGhosts } from "../../../_shared/ghosts";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  const sessionUser = adminError ? await validateSession(request, env) : null;
  if (adminError && (!sessionUser || sessionUser.role !== "superadmin")) {
    return json({ error: "Superadmin required" }, { status: 401 });
  }

  try {
    const report = await scanGhosts(env);
    return json(report);
  } catch (error: any) {
    return json({ error: error?.message || "Failed scanning integrity" }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  const sessionUser = adminError ? await validateSession(request, env) : null;
  if (adminError && (!sessionUser || sessionUser.role !== "superadmin")) {
    return json({ error: "Superadmin required" }, { status: 401 });
  }

  try {
    const purgeResult = await purgeGhosts(env, { actor: sessionUser?.username || "admin" });
    return json(purgeResult);
  } catch (error: any) {
    return json({ error: error?.message || "Failed purging ghosts" }, { status: 500 });
  }
};
