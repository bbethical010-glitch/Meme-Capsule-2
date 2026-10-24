# Live Analytics Implementation TODO

## Step 0 - Read and verify

- [DONE] a) `android_analytics_events` already has server-side `received_at` in migration 015; no duplicate `ALTER TABLE` is safe. Legacy rows can be NULL only if created before that column existed.
- [DONE] b) The raw table is an ordinary SQLite rowid table because it has `id INTEGER PRIMARY KEY`; the feed cursor uses `id`.
- [DONE] c) The existing Worker purges before recomputing the full 90-day summary, which can corrupt the retention boundary. This implementation recomputes today/yesterday before purge and keeps older summary days immutable.
- [DONE] d) The existing Worker reads all grouped `meme_events`, all daily legacy rows, and up to 90 days of Android raw rows; it is not bounded for live analytics.
- [DONE] e) Existing readers authenticate before KV reads. New readers preserve this ordering; tests cover unauthorized cache bypass.
- [DONE] f) Existing analytics readers allow any authenticated curator/judge. Live analytics and updated analytics readers are SuperAdmin-only.
- [DONE] g) `app_version` was length-bounded only and properties were size/forbidden-key checked. This implementation adds strict app-version and scalar-property validation; the dashboard previously rendered only aggregate app versions/content.
- [DONE] h) Event names are the allowlist in `functions/api/analytics/events.ts`; live feed groups them by lifecycle, view, interaction, ads, purchase, and system. Property keys are now explicitly allowlisted.
- [DONE] i) The dashboard previously surfaced a generic error. Live UI distinguishes expired sessions from empty/stale pipeline states.

## Steps 1-11

- [DONE] Step 1: additive live tables and received-time index.
- [DONE] Step 2: server receive time, rollups, quota, token rotation, strict validation.
- [DONE] Step 3: Worker live rollups, purges, heartbeat, bounded daily refresh.
- [DONE] Step 4: verified deletion removes live presence.
- [DONE] Step 5: SuperAdmin-only live APIs.
- [IN PROGRESS] Step 6: live-day reads, fresh bypass, SuperAdmin restriction.
- [DONE] Step 7: deterministic live insights.
- [IN PROGRESS] Step 8: LIVE dashboard, polling, feed, and status states. Refresh/backoff/visibility controls remain.
- [IN PROGRESS] Step 9: baseline contract tests pass; live-specific tests and load simulator remain.
- [DONE] Step 10: live operations and Android request documentation.
- [IN PROGRESS] Step 11: build and analytics tests pass; commit and push remain.
