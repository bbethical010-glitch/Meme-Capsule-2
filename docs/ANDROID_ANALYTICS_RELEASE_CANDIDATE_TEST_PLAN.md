# Android Analytics Release Candidate Test Plan

This document is for the separate `com.meme.capsule` Android repository. It
covers the client changes that integrate with the backend analytics contract
through Phase 7.

## Recent backend/client context

- `schema_version` remains immutable at `1`.
- Every accepted event requires `consent_status: "granted"`.
- `consent_version` is persisted as a string such as `v1` or `v2`; legacy
  integer preferences normalize safely.
- Consent denial and revocation never emit behavioral events.
- Revocation purges the native offline queue and blocks future uploads.
- Events use the allowlisted Android contract and must not contain PII,
  credentials, raw payloads, or hashes in logs.
- The backend validates JSON, app-token authentication, event shape, clock
  skew, body/batch limits, nested PII keys, deduplication, and rate limits.
- The dashboard reads aggregate Android KPIs only. It does not expose raw
  event payloads or `user_hash`.

## Required automated checks

Run from the Android repository:

```bash
./gradlew testDebugUnitTest
```

Confirm all analytics tests pass, including:

1. Default, explicit, and integer-normalized `consent_version`.
2. Legacy offline payload deserialization defaults to `v1`.
3. `schema_version` remains `1`.
4. Granted events contain consent lineage.
5. Denied consent creates no queue item and no network request.
6. Revocation clears persisted and in-memory queues.
7. Revocation blocks future tracking and uploads.
8. PII fields are absent from event properties and diagnostics.
9. Tokens, hashes, payloads, and authorization headers never reach logs.
10. Retry and duplicate-event handling remain idempotent.

For the web/Capacitor layer:

```bash
npx vitest run
npm run lint
npm run build
npx cap sync android
```

## Staging end-to-end checks

Use a staging token and staging endpoint only.

1. Install a QA build with analytics enabled and staging configuration.
2. Grant analytics consent with policy version `v2`.
3. Generate `app_open`, `session_start`, `meme_view`, like, share, and save
   events.
4. Confirm the queued JSON contains `schema_version: 1`,
   `consent_status: "granted"`, and `consent_version: "v2"`.
5. Flush while online and verify HTTP 200 and accepted events.
6. Repeat the same batch and verify duplicate events are not counted twice.
7. Disable consent and confirm no denial/revocation event is uploaded.
8. Revoke consent and confirm the queue is empty immediately.
9. Re-enable consent under `v3`; verify new events carry `v3`.
10. Test offline queueing, process restart recovery, retry backoff, and flush
    when connectivity returns.
11. Verify malformed payloads and wrong tokens fail without retry loops.
12. Verify `429` responses honor `Retry-After` and preserve queued events.

## Privacy and security checks

- Inspect Logcat in both debug and release-like builds.
- Search logs and crash diagnostics for `user_hash`, token values, email,
  phone, IMEI, MAC, latitude, longitude, gallery, and contacts.
- Verify no `VITE_ANALYTICS_APP_TOKEN` or production token is bundled into web
  assets.
- Verify release packaging fails when the token is missing or a placeholder.
- Verify the token is injected through CI/local environment only.
- Confirm consent UI text identifies the active policy version.

## Release-candidate build checks

```bash
export ANALYTICS_APP_TOKEN="<staging-or-production-pages-analytics-token>"
./gradlew clean
./gradlew testDebugUnitTest
./gradlew bundleRelease
```

Do not place the token in committed Gradle files. Use a staging token for QA
and a separately rotated production token for the production candidate.

## Backend reconciliation

After the QA batch reaches staging, verify:

- raw row count increases by the accepted count;
- `consent_version` is persisted correctly;
- retrying the same `event_id` does not increase the row count;
- overview and trends reflect the event window;
- retention, funnel, content, audience, and insight endpoints remain healthy;
- migration 020 daily summaries refresh after the Worker runs;
- deletion removes raw rows and creates an audit record;
- no dashboard response contains raw hashes or properties.

Record build SHA, app version, endpoint environment, token rotation reference,
test timestamp, accepted/duplicate counts, and operator before promotion.

## Prompt for the Android build agent

```text
You are working in the separate Meme Capsule Android repository
(com.meme.capsule). Build a new Analytics Release Candidate against the
backend's current Phase 7 contract.

Context:
- schema_version is fixed at 1.
- Every granted event must include consent_version as a normalized string
  (v1, v2, v3, etc.). Legacy integer/string preferences must normalize safely.
- Consent denial and revocation must never create behavioral events.
- Revocation must immediately purge native SQLite and in-memory queues and
  block future tracking/uploads until consent is granted again.
- Keep the existing allowlisted event names, anonymous SHA-256 user hash,
  session IDs, batching, offline queue, retry/backoff, and deduplication.
- Never log tokens, hashes, payloads, authorization headers, consent values,
  or PII. Preserve BuildConfig.DEBUG guards.
- The backend validates JSON, X-Analytics-App-Token, schema_version, consent,
  timestamps, batch/body limits, nested PII keys, and rate limits.
- The web/Capacitor bridge must preserve the same contract and privacy behavior.

Tasks:
1. Review the current analytics implementation and do not rewrite unrelated
   app features.
2. Ensure every native and bridge event builder emits schema_version: 1,
   consent_status: granted, and consent_version.
3. Verify legacy queue/localStorage payloads without consent_version default to
   v1 and cannot crash deserialization.
4. Verify denied/revoked consent creates no upload, clears pending queues on
   revocation, and blocks retries.
5. Add or update tests for granted lineage, legacy normalization, denial,
   revocation purge, PII scrubbing, offline recovery, retry/backoff, and
   duplicate IDs.
6. Build and run:
   ./gradlew testDebugUnitTest
   npx vitest run
   npm run lint
   npm run build
   npx cap sync android
7. Inject ANALYTICS_APP_TOKEN only from the environment for the release build;
   never commit it. Use the staging token for QA.
8. Run the release guard and produce the AAB:
   ./gradlew bundleRelease
9. Report the app version, versionCode, build SHA, test results, endpoint
   environment, and whether any token/PII appeared in logs or artifacts.
```
