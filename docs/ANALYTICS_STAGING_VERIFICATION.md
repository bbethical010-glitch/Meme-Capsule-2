# Analytics Staging Verification Runbook

Use this runbook after the Pages Functions, migration 020, and the analytics
Worker are deployed to a staging environment. Do not use production tokens or
real user hashes in staging.

## 1. Apply and verify schema

```bash
npx wrangler d1 migrations apply meme-capsule-db --remote
npx wrangler d1 execute meme-capsule-db --remote \
  --command "PRAGMA table_info(android_analytics_events);"
npx wrangler d1 execute meme-capsule-db --remote \
  --command "PRAGMA table_info(android_analytics_daily_summary);"
```

Confirm `schema_version` and `consent_version` exist on the raw table and that
the daily summary table exists before deploying the Worker.

## 2. Send a synthetic QA batch

Use a generated 64-character SHA-256-shaped value and a fresh hexadecimal event
ID. Never use a production user hash or token in shell history.

```bash
curl -i -X POST "$STAGING_URL/api/analytics/events" \
  -H "Content-Type: application/json" \
  -H "X-Analytics-App-Token: $STAGING_ANALYTICS_APP_TOKEN" \
  --data '{"events":[{"schema_version":1,"event_id":"a1b2c3d4e5f60708","event_name":"app_open","user_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","session_id":"b1c2d3e4f5a60718","timestamp_utc":"2026-10-23T18:00:00Z","platform":"android","app_version":"qa","consent_status":"granted","consent_version":"v2"}]}'
```

Expected response: HTTP 200 with `accepted: 1`. Repeating the same request
must return HTTP 200 with `accepted: 0` and `rejected: 1`.

## 3. Verify dashboard and aggregation

1. Sign in to the staging curator dashboard.
2. Confirm overview and trends show the QA event.
3. Trigger the analytics Worker with its separate worker token, or wait for
   the scheduled run.
4. Confirm the response reports `android_summary_rows`.
5. Query the raw and summary tables without selecting `user_hash` in shared
   screenshots or exported artifacts.

## 4. Negative-path checks

Verify these responses without logging request bodies:

| Scenario | Expected |
|---|---|
| Wrong app token | `401` |
| Missing JSON content type | `415` |
| `consent_status: denied` | `400`, no D1 write |
| Unsupported `schema_version` | `400`, no D1 write |
| Forbidden nested property such as `email` | `400`, no D1 write |
| Oversized body | `413` |
| Repeated requests over limit | `429` with `Retry-After` |

## 5. Release decision

Record the staging URL, deployment timestamp, migration status, test batch
reference, dashboard result, Worker result, and operator in the release record.
Production remains blocked if any contract, privacy, deletion, retry, or
authorization check fails.
