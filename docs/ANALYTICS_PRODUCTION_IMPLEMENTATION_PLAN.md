# Android Analytics Production Implementation Plan

> **Status:** Foundation implemented; production rollout pending
> **Scope:** Android telemetry ingestion, live KPI dashboard, privacy controls, operations, and deployment
> **Repository:** Meme Capsule serverless backend and internal workbenches

## 1. Current baseline

The backend foundation is implemented:

- D1 migrations `015` through `018` for Android analytics are applied to the production database.
- `POST /api/analytics/events` validates consented Android batches, enforces the app token, and deduplicates by `event_id`.
- Curator-session-protected readers exist for overview, trends, retention, funnel, content, audience, and deterministic insights.
- `#/curate/analytics` displays live KPI data and refreshes every 30 seconds.
- The dashboard does not expose raw user hashes or event properties.
- `npm run build` and the existing 9-test curation suite pass.

The production table currently contains no Android events. The companion Android application still needs to be instrumented and pointed at the deployed ingestion endpoint.

## 2. Phase plan

### Phase 0 — Contract and environment freeze

**Goal:** Establish one versioned contract before client rollout.

**Work**

- Freeze the event allowlist and payload shape in `ANALYTICS_API_SPEC.md`.
- Require `schema_version: 1` on every Android event.
- Define production, staging, and local `ANALYTICS_APP_TOKEN` values.
- Document token rotation and emergency revocation.
- Confirm the Android app version and endpoint environment mapping.
- Confirm live D1 schema with `PRAGMA table_info(android_analytics_events)`.

**Exit criteria**

- Contract reviewed by backend, Android, privacy, and product owners.
- No production secret exists in source control or the frontend bundle.
- Staging and production configuration values are separately managed.

### Phase 1 — Android telemetry client

**Goal:** Collect only consented, anonymous, operationally useful events.

**Work**

- Initialize analytics only after consent is granted.
- Store a salted anonymous install identifier; never collect IMEI, MAC, contact data, precise location, or gallery data.
- Generate a session identifier and attach app version and OS version.
- Instrument required events:
  `app_open`, `app_background`, `session_start`, `session_end`,
  `meme_view`, `meme_like`, `meme_share`, `meme_save`,
  `meme_scroll`, `category_click`, `onboarding_complete`,
  `profile_open`, `subscription_click`, and `screen_view`.
- Add optional events only when their product and privacy purpose is documented.
- Add schema versioning and client-side payload validation.

**Exit criteria**

- Consent denial prevents behavioral event transmission.
- Every event has a unique `event_id`, valid UTC timestamp, session ID, and anonymous user hash.
- QA builds can inspect queued events without exposing production user data.

### Phase 2 — Offline queue and delivery

**Goal:** Make Android delivery reliable without blocking the UI or draining battery.

**Work**

- Implement a Room/SQLite event queue.
- Flush at 50–100 events, every 30–60 seconds, on app background, and on session close.
- Use exponential backoff with a bounded retry count.
- Preserve events when offline and enforce a maximum queue size.
- Send batches to `POST /api/analytics/events` with `X-Analytics-App-Token`.
- Handle 400, 401, 429, and 5xx responses distinctly.
- Avoid sending the same batch indefinitely after permanent validation failure.

**Exit criteria**

- Offline events survive process restarts.
- Retry behavior is bounded and observable.
- Main-thread performance is unaffected.
- Duplicate retries produce no duplicate rows.

### Phase 3 — Ingestion hardening

**Goal:** Protect the edge endpoint from abuse, malformed clients, and traffic spikes.

**Work**

- Add per-token and per-IP rate limiting. The current edge implementation uses
  bounded fixed windows in `ANALYTICS_KV`; replace or tune this after measured
  traffic and quota review if normal batches create excessive KV writes.
- Enforce the 2 MiB request body and per-event property/metadata limits at the edge.
- Add structured rejection responses without logging payloads or hashes.
- Add token rotation and revocation support.
- Add aggregate anomaly counters for accepted, duplicate-containing,
  unauthorized, rejected, and rate-limited requests.
- Add an ingestion health endpoint or protected operational metric.
- Confirm Cloudflare request, D1 write, and KV quotas against the active plan.

**Exit criteria**

- Unauthorized clients cannot write events.
- Abuse tests return controlled 401/413/429 responses.
- No sensitive payload data appears in logs.
- Ingestion remains within documented quota assumptions under load.
- Manual aggregation and retention triggers require a separate worker token.

The current codebase now satisfies the request-size, content-type, rate-limit,
and aggregate-counter portions of this phase. Token rotation policy, Cloudflare
quota tuning, and stronger app attestation remain deployment tasks.

### Phase 4 — Analytics data lifecycle

**Goal:** Meet retention, deletion, and data-lineage requirements.

**Work**

- Add a raw-event retention job for the documented 60–90 day window. The
  scheduled analytics worker now purges up to 10,000 expired Android events per
  run, defaulting to 90 days and accepting `ANALYTICS_RAW_RETENTION_DAYS`
  between 1 and 365.
- Add a deletion workflow for a supplied anonymous user hash or deletion request reference.
- Implemented as superadmin-only `POST /api/analytics/deletion` with immutable
  request references and `android_analytics_deletion_audit` records.
- Record consent policy version with every event. Migration 019 adds
  `consent_version` with a backward-compatible `v1` default; consent denial
  and revocation remain local and do not emit behavioral events.
- Keep aggregate tables free from reconstructable user-level data.
- Document deletion completion and audit metadata.
- Add scheduled aggregation tables when direct raw-table queries become expensive.
- Protect the worker's manual `POST` trigger with `ANALYTICS_WORKER_TOKEN`.

**Exit criteria**

- Raw event retention is enforced automatically.
- Deletion requests are authenticated, auditable, and testable.
- Consent-policy lineage is retained without collecting PII.
- Aggregated dashboards continue working after raw event deletion.
- Privacy documentation and Play Data Safety declarations match implementation.

### Phase 5 — Production dashboard completion

**Goal:** Remove preview behavior and make every dashboard surface trustworthy.

**Work**

- Remove static fallback KPI values from production paths.
- Keep an explicit empty-state for zero-event environments.
- Add consistent date-range, platform, app-version, source, and cohort filters.
- Add visible data freshness and ingestion health indicators.
- Add real audience, retention, funnel, and content charts.
- Add role-specific visibility:
  - Superadmin: global aggregates and exports.
  - Curator/editor: content and aggregate performance only.
  - Analyst/product: aggregate cohorts and funnels only.
- Add export controls only for approved aggregate data.
- Add audit logging for sensitive dashboard access and exports.

**Exit criteria**

- Every displayed production number is backed by an API response.
- No mock data is rendered silently.
- No raw event, user hash, or PII is visible in the UI or exports.
- Unauthorized and expired sessions are handled cleanly.

**Implementation status (current repository):** The analytics preview now renders only API-backed Android aggregates, with explicit loading and zero-event states. Legacy static KPI, curation verdict, judge, acquisition, demographic, and behavior values were removed; unsupported surfaces identify the missing telemetry contract instead of presenting mock values. Freshness and refresh timestamps are visible in the live-feed status line. Remaining deployment-gated work includes role-specific export controls and production audit verification.

### Phase 6 — Backend performance and scale

**Goal:** Keep KPI reads fast as Android traffic grows.

**Work**

- Add time-bounded composite indexes for Android KPI queries. Migration 017
  adds timestamp/platform, timestamp/event, timestamp/category, and
  timestamp/session indexes.
- Benchmark ingestion with realistic batch sizes and release-spike traffic.
- Benchmark dashboard queries against production-sized event volumes.
- Add summary tables for daily users, sessions, funnel stages, retention cohorts, and content performance.
- Move expensive calculations to the scheduled analytics worker.
- Add short-lived KV caching for hot aggregate responses.
- Monitor D1 rows read/written, Worker requests, KV operations, and R2 usage.
- Define alert thresholds and a paid-plan migration trigger.

**Exit criteria**

- Dashboard queries meet an agreed latency target under representative load.
- Ingestion stays within D1 and Worker quotas.
- Aggregation lag and cache freshness are measurable.
- Capacity assumptions are updated with measured results.

**Implementation status (current repository):** Migration 020 adds a bounded 90-day daily Android summary table with date/event/category/app-version indexes. The analytics worker refreshes those summaries after retention cleanup and reports refreshed-row counts. All Android dashboard aggregate endpoints use a one-minute KV cache, and the worker invalidates the Android cache namespace after successful aggregation. Load-test measurements and quota alerting remain deployment/operations work.

### Phase 7 — Verification and staged release

**Goal:** Release safely without corrupting telemetry or exposing private data.

**Work**

- Add unit tests for payload validation and metric calculations.
- Add Pages Function integration tests for:
  - valid ingestion
  - invalid consent
  - invalid token
  - malformed payload
  - duplicate `event_id`
  - batch limits
  - curator authorization
  - empty-state responses
- Run local Wrangler D1 tests with representative fixtures.
- Deploy to staging and send events from a QA Android build.
- Verify D1 rows, dashboard values, retries, rate limits, and deletion behavior.
- Run a privacy and security review.
- Deploy Pages Functions and frontend.
- Enable the production Android endpoint gradually.

**Exit criteria**

- All automated and integration tests pass.
- Staging telemetry matches dashboard aggregates.
- Rollback and token-revocation procedures are documented.
- Production deployment has an owner, timestamp, and verification record.

**Implementation status (current repository):** Added `tests/analytics.test.ts`
with ingestion contract coverage for valid consent lineage, denied consent,
token/content-type authorization, forbidden nested PII, schema rejection, and
duplicate accounting. Added `npm run test:analytics` and the staging
verification runbook in `docs/ANALYTICS_STAGING_VERIFICATION.md`. Cloudflare
staging deployment and QA Android execution remain manual release-owner steps.

## 3. Release gates

The analytics system must not be called production-ready until all gates pass:

1. **Contract gate:** Android and backend schemas are versioned and aligned.
2. **Privacy gate:** consent, minimization, retention, and deletion are implemented.
3. **Security gate:** app token, curator auth, rate limiting, and audit controls are verified.
4. **Reliability gate:** offline queueing, retry, deduplication, and backpressure pass tests.
5. **Data gate:** dashboard values reconcile with known test fixtures.
6. **Performance gate:** representative load stays within Cloudflare quotas and latency targets.
7. **Documentation gate:** API, database, privacy, state, and runbook docs are synchronized.
8. **Deployment gate:** staging verification and rollback procedures are complete.

## 4. Ownership

| Area | Primary responsibility |
|---|---|
| Cloudflare Functions, D1, ingestion, aggregation, security | Backend owner |
| Android instrumentation, queue, consent UI, release build | Android/client owner |
| Dashboard UI, responsive layout, interaction design | Frontend owner |
| Privacy policy, Play Data Safety, retention/deletion approval | Product/privacy owner |
| Load testing, monitoring, release verification | Shared release owner |

## 5. Immediate next actions

1. Implement and test the Android event client against staging.
2. Add token/IP rate limiting and structured ingestion metrics.
3. Add deletion-request handling and audit records; scheduled retention cleanup
   is now implemented in the analytics worker.
4. Replace dashboard mock fallbacks with explicit empty states.
5. Add endpoint and integration test coverage.
6. Run staging load and privacy validation.
7. Deploy only after all release gates pass.
