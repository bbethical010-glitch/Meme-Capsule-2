# Analytics API Specification

## 1. Purpose

This API layer manages ingestion and retrieval of product, app, and curation analytics for Meme Capsule. It is designed for security, scale, and predictable internal access.

## 2. Base rules

- all admin endpoints require authenticated curator or superadmin session
- Android app ingestion endpoints require signed app token and consent validation
- all requests use strict JSON payloads
- query parameters must be validated and type-safe
- raw user data is never returned to the public UI

## 3. Ingestion endpoint

### POST /api/analytics/events

#### Purpose
Accept batched Android and browser analytics events.

#### Headers
- Authorization: App token or signed client credential
- `X-Analytics-App-Token` must match the server-side `ANALYTICS_APP_TOKEN`
- Content-Type: application/json
- request body maximum: 2 MiB

#### Request body
```json
{
  "events": [
    {
      "schema_version": 1,
      "event_id": "uuid",
      "event_name": "meme_view",
      "user_hash": "sha256_hash",
      "session_id": "uuid",
      "timestamp_utc": "2026-10-23T00:00:00Z",
      "platform": "android",
      "app_version": "3.3.0",
      "country": "IN",
      "meme_id": "meme_123",
      "category": "office",
      "source_channel": "feed",
      "screen_name": "home_feed",
      "properties": {
        "time_on_screen_ms": 4300
      },
      "consent_status": "granted",
      "consent_version": "v1"
    }
  ]
}
```

#### Server behavior
- validate event schema
- deduplicate duplicate event IDs
- reject malformed or unauthorized payloads
- enforce per-IP and per-token request limits
- reject nested property keys that indicate PII or secrets
- return `413` for oversized bodies, `415` for non-JSON requests, and `429`
  with `Retry-After` when throttled
- queue valid events for batch insertion into D1 or event table store
- return accepted and rejected counts

The ingestion endpoint records only aggregate operational counters in
`ANALYTICS_KV` (accepted batches, rejected requests, unauthorized requests,
rate-limited requests, and duplicate-containing batches). It never stores
tokens, IP addresses, user hashes, or raw event payloads in those counters.

The Android contract is stored in the append-only `android_analytics_events` table
created by migration 015. Duplicate `event_id` values are ignored.
Migration 016 adds the required `schema_version` column. Version `1` is the
current contract; incompatible future changes must use a new version.

#### Response
```json
{
  "success": true,
  "accepted": 42,
  "rejected": 0,
  "message": "events processed"
}
```

## 4. Dashboard read endpoints

### GET /api/analytics/overview
Returns live summary KPIs from consented Android events. Requires a curator
session bearer token. Supports `days=1..90` and `platform=android`.

### GET /api/analytics/trends
Returns live daily Android event counts for the selected window. Requires a
curator session bearer token.

### GET /api/analytics/retention
Returns retention cohort data by D1, D7, D30 windows.

### GET /api/analytics/funnel
Returns stage conversion and drop-off analysis.

### GET /api/analytics/content
Returns meme category and content cluster performance.

### GET /api/analytics/audience
Returns segment and cohort insights.

### GET /api/analytics/ai-insights
Returns deterministic, aggregate insight summaries. It is intentionally labeled
as analytics-derived until a separately approved AI inference provider is wired.

### POST /api/analytics/deletion
Superadmin-only deletion route for a verified analytics deletion request.
Accepts a lowercase-or-uppercase SHA-256 `user_hash` and a unique
`request_reference`, deletes matching raw Android events, and records the
completed count in an audit table. The route never accepts email, phone,
account identifiers, or arbitrary SQL.

### GET /api/analytics/deletion
Superadmin-only audit listing for completed or failed deletion requests.

## 5. Admin protection requirements

- all read endpoints must enforce curator role checks
- all endpoints must log access metadata
- export routes should require elevated permissions
- raw user-level lookup routes must be avoided in UI by default

## 6. Data contract conventions

### Response object pattern
```json
{
  "success": true,
  "generated_at": "2026-10-23T00:00:00Z",
  "data": {
    "kpis": [],
    "series": [],
    "segments": []
  }
}
```

### Validation rules
- all timestamps use UTC ISO-8601
- all IDs must be strings or UUIDs
- all numeric fields must be typed as numbers
- `consent_version` is a bounded client policy identifier; omitted legacy
  events are stored as `v1`
- unknown event names are rejected unless explicitly whitelisted

## 7. Reliability requirements

- idempotent event ingestion for retried requests
- retry-safe deduplication by event_id
- queue cutoff for invalid events
- backend error returns with structured response codes
- rate limiting by app identity and IP

## 8. Scaling rules

- keep raw ingestion lightweight and append-only
- derive summary tables asynchronously when possible
- cache hot public summary responses for a short TTL
- do not join massive raw tables directly in dashboard queries

## 9. Future API extensions

- cohort comparison by app version
- source breakdown by re-engagement campaign
- AI recommendation effectiveness reports
- legal deletion status endpoint for user analytics
- export endpoint for product and compliance reports
