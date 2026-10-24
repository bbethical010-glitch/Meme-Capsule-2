# Android Analytics Data Collection Standard

## 1. Purpose

This document defines how the Meme Capsule Android app sends behavioral and performance data to the backend analytics system while respecting privacy and platform rules. The system must support future product growth without collecting unnecessary personal information.

## 2. Design principles

- data minimization
- consent-first collection
- no PII by default
- anonymous device identifiers only
- event schema versioning
- offline-safe local buffering
- batch uploads to minimize network and battery cost

## 3. Collection categories

### Required analytics events
- app_open
- app_background
- session_start
- session_end
- meme_view
- meme_like
- meme_share
- meme_save
- meme_scroll
- category_click
- onboarding_complete
- profile_open
- subscription_click
- screen_view

### Optional product events
- feed_refresh
- meme_reported
- ad_impression
- ad_reward_viewed
- retention_checkin

## 4. Privacy model

- use a salted anonymous identifier or hashed device key
- never send email, phone number, or contact list
- do not collect raw GPS coordinates unless explicit consent exists
- do not upload content files or user gallery data to analytics servers
- separate analytics data from user account data if such data ever exists

## 5. Consent model

The Android app must check consent before sending analytics events. Consent record structure:

```json
{
  "analytics_consent": true,
  "advertising_consent": false,
  "consent_version": "v1",
  "timestamp_utc": "2026-10-23T00:00:00Z"
}
```

If consent is denied, the app must not send behavioral events beyond essential crash diagnostics if permitted by platform policy.

## 6. Event payload format

```json
{
  "schema_version": 1,
  "event_id": "uuid",
  "event_name": "meme_view",
  "user_hash": "sha256_anonymous_id",
  "session_id": "uuid",
  "app_version": "3.3.0",
  "platform": "android",
  "os_version": "14",
  "country": "IN",
  "timestamp_utc": "2026-10-23T00:00:00Z",
  "meme_id": "meme_123",
  "category": "office",
  "source_channel": "feed",
  "screen_name": "home_feed",
  "consent_version": "v1",
  "properties": {
    "time_on_screen_ms": 4300,
    "is_repeat_view": false,
    "source_variant": "A"
  },
  "consent_status": "granted"
}
```

`schema_version` is required and must be `1` for the current contract. A future
breaking payload change must introduce a new version and an explicitly
compatible server parser.

`consent_version` identifies the consent-policy text and controls accepted by
the app when the event was created. It is stored with each raw event for
lineage. Legacy clients that omit it are interpreted as `v1`. Consent denial
and revocation must remain local and must not emit behavioral events.

## 7. Local buffering and batching

The Android app must queue events locally and send them in batches. Recommended design:

- Room or SQLite table for offline event queue
- max queue length before flush: 50–100 events
- flush interval: every 30–60 seconds
- flush on app background or session close
- retry with exponential backoff
- do not block the main UI thread

## 8. Security and trust model

- use a signed app token or JWT issued to the app build
- validate client identity on every batch upload
- enforce per-app rate limits
- reject malformed events
- reject duplicate event IDs
- log suspicious traffic without exposing PII

## 9. Data retention policy

Raw event data:
- raw event retention: 60–90 days maximum for operational analytics

Aggregated metrics:
- summary tables: longer retention allowed when needed for product intelligence

Event deletion:
- support deletion request handling for user-level analytics where required by law.
  The backend accepts a verified anonymous `user_hash`; the Android client must
  expose the install identifier only through the approved privacy/deletion
  support process and must never display or log the hash during normal use.

Deletion support workflow:
1. Support verifies the request through the approved privacy process.
2. Support creates a unique request reference without placing PII in it.
3. An authorized superadmin submits the verified anonymous hash and reference
   to `POST /api/analytics/deletion`.
4. The superadmin confirms the deleted count in the protected audit listing.

## 10. Android app implementation responsibilities

### App-level responsibilities
- initialize analytics client at startup
- generate anonymous user key once per install
- track session lifecycle
- attach metadata such as app version and device OS
- flush queued events in background

### Server-side responsibilities
- validate app signature
- deduplicate event IDs
- normalize schema
- aggregate into summary metrics
- provide admin analytics queries and exports

## 11. Operational risks

- event storm during app release
- low-quality events from beta versions
- device clocks out of sync
- offline queue overflow
- app update breaking schema compatibility

### Mitigations
- versioned schema and compatibility parsing
- queue size threshold enforcement
- fallback to server-side normalization
- analytics debug mode in QA builds
- monitoring of dropped and invalid events

## 12. Minimum acceptance criteria

The Android app is considered production-ready for analytics when:
- every event contains valid schema and timestamp
- raw data remains anonymized
- consent is enforced before event sending
- queueing works while offline
- server can accept and validate batches
- dashboards show event-backed trends and cohorts
- admin access is protected and logged
