/**
 * POST /api/admin/sql
 *
 * Executes raw SQL queries and migration scripts against the D1 database.
 * Supports both SELECT queries and multi-statement DDL/DML batches.
 * Restricted to admin tokens.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, requireAdmin, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  const sessionUser = authError ? await validateSession(request, env) : null;

  if (authError && (!sessionUser || (sessionUser.role !== "superadmin" && sessionUser.role !== "admin"))) {
    return json({ success: false, error: "Unauthorized: Admin API token or Superadmin session required." }, { status: 401 });
  }

  let query: string;
  try {
    const body = await request.json() as { query?: string };
    if (!body.query || typeof body.query !== "string") {
      return json({ success: false, error: "Missing or invalid 'query' field in request body." }, { status: 400 });
    }
    query = body.query.trim();
  } catch {
    return json({ success: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  if (query.length === 0) {
    return json({ success: false, error: "Query cannot be empty." }, { status: 400 });
  }

  try {
    // Strip SQL comments and normalize CRLF line endings to prevent D1 multiline syntax errors
    const cleanedQuery = query
      .replace(/\r\n/g, "\n")
      .replace(/--.*$/gm, "")
      .trim();

    // Check if query contains multiple statements
    const statements = cleanedQuery
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (statements.length === 0) {
      return json({ success: false, error: "Query cannot be empty after stripping comments." }, { status: 400 });
    }

    if (statements.length > 1) {
      const batchStmts = statements.map((s) => env.DB.prepare(s));
      const batchResults = await env.DB.batch(batchStmts);
      return json({
        success: true,
        results: [{ status: `Executed ${batchResults.length} statements successfully.` }],
        meta: { duration: batchResults[0]?.meta?.duration }
      });
    }

    // Single statement: check if SELECT / read-only query
    const single = statements[0];
    const upper = single.toUpperCase();

    if (upper.startsWith("SELECT") || upper.startsWith("PRAGMA") || upper.startsWith("EXPLAIN")) {
      const result = await env.DB.prepare(single).all();
      return json({
        success: true,
        results: result.results,
        meta: result.meta
      });
    }

    // DDL or single modification (CREATE, INSERT, UPDATE, DELETE)
    const runResult = await env.DB.prepare(single).run();
    return json({
      success: true,
      results: [{ status: "Statement executed successfully." }],
      meta: { duration: runResult.meta?.duration }
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Database execution failed.";
    return json({
      success: false,
      error: errorMsg
    });
  }
};
