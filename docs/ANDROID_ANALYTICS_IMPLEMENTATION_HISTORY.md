# Meme Capsule Android Analytics — Implementation History

## 1. Purpose and scope

Meme Capsule analytics is a consented, anonymous Android telemetry pipeline
spanning three boundaries:

1. **Android APK (`com.meme.capsule`)** — consent management, event creation,
   offline queueing, retries, batching, and upload.
2. **Cloudflare Pages Functions and D1** — authenticated ingestion, validation,
   deduplication, retention, deletion, and aggregate API reads.
3. **Curator/SuperAdmin dashboard and Analytics Worker** — live KPI display,
   scheduled summaries, cache invalidation, and operational maintenance.

The analytics system is separate from the legacy web telemetry path. Browser
analytics does not use the Android app credential.

## 2. Contract and data model

### Event contract

Every accepted Android event contains:

- `schema_version: 1`
- unique `event_id`
- anonymous SHA-256 `user_hash`
- `session_id`
- UTC `timestamp_utc`
- `platform: "android"`
- `app_version`
- `consent_status: "granted"`
- normalized string `consent_version` such as `v1` or `v2`
- only approved optional metadata and bounded properties

The event allowlist includes app/session lifecycle, meme view and interaction,
navigation, onboarding, subscription, reporting, advertising, and retention
events. Consent denial and revocation are local state changes, not behavioral
events.

### D1 storage

| Migration | Development |
|---|---|
| 015 | Created append-only `android_analytics_events` with consented Android telemetry. |
| 016 | Added required `schema_version` contract lineage. |
| 017 | Added time/platform/event/category/session query indexes. |
| 018 | Added `android_analytics_deletion_audit` for verified deletion requests. |
| 019 | Added `consent_version` policy lineage, defaulting legacy rows to `v1`. |
| 020 | Added worker-maintained 90-day `android_analytics_daily_summary` aggregates and indexes. |

Raw events remain the source of truth for deletion and retention. Dashboard
responses expose aggregates only and never return hashes or raw properties.

## 3. Phase-by-phase development

### Phase 1 — Android instrumentation and contract freeze

- Defined the versioned Android event schema and allowlist.
- Added anonymous install identity and session identifiers.
- Added consent-aware event generation.
- Added SQLite/offline queueing, batching, retry/backoff, and lifecycle flushes.
- Added backend schema validation and duplicate `event_id` handling.
- Required `schema_version: 1`.

### Phase 2 — Ingestion hardening

`POST /api/analytics/events` now enforces:

- `application/json`
- 2 MiB request limit
- maximum 200 events per batch
- bounded event metadata and properties
- UTC timestamp skew within 24 hours
- SHA-256-shaped anonymous hashes
- supported event names and Android platform
- nested PII/secret-key rejection
- per-IP and per-token KV rate limits
- `429` responses with `Retry-After`
- aggregate operational counters without raw payloads, hashes, IPs, or tokens

### Phase 3 — Query performance and operations

- Added composite indexes for time-bounded KPI queries.
- Added explicit freshness and empty-state metadata to overview/trend APIs.
- Added a separate Analytics Worker configuration:
  `workers/wrangler.analytics.toml`.
- Added bounded raw-event retention, defaulting to 90 days and configurable
  from 1–365 days.
- Protected manual Worker execution with `ANALYTICS_WORKER_TOKEN`.

### Phase 4 — Consent lineage and lifecycle controls

- Added `consent_version` to native Android and TypeScript bridge events.
- Persisted consent policy version as a normalized string.
- Normalized legacy integer values such as `1` to `v1`.
- Defaulted old queued payloads without lineage to `v1`.
- Blocked behavioral event creation and upload when consent is absent or denied.
- Purged native SQLite and in-memory queues immediately on revocation.
- Added verified anonymous-hash deletion with unique request references and
  immutable SuperAdmin audit records.

### Phase 5 — Production dashboard completion

The dashboard at `#/curate/analytics` was converted from preview behavior to
trustworthy live data:

- KPI cards use the overview API.
- Engagement trends use the trends API.
- Audience uses platform/app-version aggregates.
- Content uses category performance aggregates.
- Retention and funnel tabs use their dedicated APIs.
- AI panels use deterministic aggregate insights.
- Loading, empty, stale/freshness, error, and unsupported-metric states are
  explicit.
- Static mock KPI, judge, verdict, attribution, demographic, and behavior data
  was removed.
- Unsupported metrics identify that the current Android contract does not
  provide the required data.

### Phase 6 — Performance and scale controls

- Added the daily Android summary table.
- Worker refreshes a bounded 90-day summary window after retention cleanup.
- Added one-minute KV caching to Android overview, trends, audience, content,
  retention, funnel, and insight readers.
- Worker invalidates the Android analytics cache namespace after aggregation.
- Worker reports refreshed summary row counts and purged raw-event counts.

### Phase 7 — Verification and staged release

- Added `tests/analytics.test.ts`.
- Added `npm run test:analytics`.
- Covered valid consent lineage, invalid consent, invalid token/content type,
  schema rejection, nested PII rejection, and duplicate accounting.
- Added staging verification procedures for D1, ingestion, dashboard,
  Worker, rate limiting, deletion, and release decisions.
- Added the Android Release Candidate test plan and build-agent prompt.

## 4. Authentication and trust model

### Android ingestion

The APK sends:

```http
X-Analytics-App-Token: <production analytics app token>
```

The token must match the Cloudflare Pages `ANALYTICS_APP_TOKEN` secret. It is
treated as a public client credential because APK contents can be reverse
engineered. It provides coarse abuse control, not proof of app authenticity.

Do not use or confuse it with:

- `ADMIN_API_TOKEN`
- curator or SuperAdmin session tokens
- `ANALYTICS_WORKER_TOKEN`
- Cloudflare API tokens

### Dashboard reads

Analytics read endpoints require an active curator/SuperAdmin session bearer
token. An unauthenticated request correctly returns `401`.

### Worker

The separate Worker:

- runs every 30 minutes;
- purges expired raw Android events;
- refreshes daily Android summaries;
- runs legacy analytics aggregation;
- invalidates KV caches;
- accepts manual `POST` only with `ANALYTICS_WORKER_TOKEN`.

It does not receive Android event uploads directly. The Pages ingestion
function receives those uploads.

## 5. Privacy and security guarantees

- No consent means no behavioral event creation or upload.
- Revocation purges pending telemetry locally.
- No email, phone, IMEI, MAC, GPS, latitude, longitude, contacts, gallery,
  raw names, secrets, or credentials are accepted in event properties.
- Hashes, tokens, payloads, consent values, and authorization headers are not
  written to logs or diagnostics.
- Release builds reject missing or placeholder analytics credentials.
- Production web bundles do not contain Android analytics credentials.
- Raw retention is bounded and user-level deletion is auditable.
- Dashboard and aggregate APIs do not expose raw event payloads or hashes.

## 6. Deployment configuration

### Pages environment

Configure the following server-side values:

```text
ANALYTICS_APP_TOKEN=<rotated production analytics ingestion credential>
```

The APK must use the matching value for the deployed environment. Staging and
production tokens must be separate.

### Analytics Worker

Deploy using:

```bash
npx wrangler d1 migrations apply meme-capsule-db --remote
npx wrangler secret put ANALYTICS_WORKER_TOKEN \
  --config workers/wrangler.analytics.toml
npx wrangler deploy --config workers/wrangler.analytics.toml
```

The Worker configuration binds:

- D1 database as `DB`
- KV namespace as `ANALYTICS_KV`
- `ANALYTICS_RAW_RETENTION_DAYS=90`
- cron schedule `*/30 * * * *`

## 7. Verification history

Validated during implementation:

- Android native consent-lineage unit tests passed.
- TypeScript/Vitest analytics tests passed.
- `npm run test:analytics` passed.
- `npm run build` passed.
- `npx tsc --noEmit` passed.
- Analytics Worker Wrangler dry-run passed.
- D1 tables and migration 020 summary table were verified remotely.
- Production analytics routes returned `401` when accessed without a curator
  session, confirming route protection.
- Production Android event count was initially zero; after APK configuration
  and deployment correction, analytics began working.

## 8. Operational troubleshooting

If the dashboard is empty:

1. Confirm the SuperAdmin session is active; log out and back in if expired.
2. Check the raw event count:

   ```bash
   npx wrangler d1 execute meme-capsule-db --remote \
     --command "SELECT COUNT(*) AS events, MAX(timestamp_utc) AS last_event_at FROM android_analytics_events;"
   ```

3. If `events = 0`, verify the APK endpoint, matching token, granted consent,
   schema version, consent version, device clock, network, queue, and flush.
4. If events exist but summaries are stale, deploy or manually trigger the
   Analytics Worker.
5. If `/api/analytics/*` returns the SPA HTML, the Pages deployment was built
   from the wrong repository or commit.
6. If it returns `401`, the route is deployed correctly; authenticate through
   the curator/SuperAdmin UI.

## 9. Ownership boundaries

- **Android repository:** consent UI, native queue, event builders, retries,
  release configuration, APK/AAB builds, and device validation.
- **Meme-Capsule-2 backend repository:** Pages Functions, D1 migrations,
  Analytics Worker, dashboard, tests, documentation, and deployment config.
- **Cloudflare account:** Pages secrets, D1 migration execution, Worker
  deployment, KV/R2 bindings, cron, and production verification.

## Real-time LIVE analytics completion

The real-time extension is implemented additively in migration 021. Ingestion records
server receive time, performs non-blocking minute and presence rollups, enforces a
per-install rolling-hour quota, supports current/previous token rotation, and validates
allowlisted scalar properties. The Worker refreshes today and yesterday before retention
purges, materializes completed hourly buckets, expires live data, and records pipeline
heartbeats.

The SuperAdmin dashboard now has LIVE summary, cursor-based feed, deterministic insights,
health and rebuild endpoints. Existing analytics readers authenticate before KV reads,
support `fresh=1`, return `Cache-Control: no-store`, and are restricted to SuperAdmin.
The dashboard supports manual refresh, keyboard `R`, configurable polling, hidden-tab
pausing, visibility refresh, and explicit session-expired/reconnecting states.
