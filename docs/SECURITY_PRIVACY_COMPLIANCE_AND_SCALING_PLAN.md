# Security, Privacy, Compliance, and Scaling Plan

## 1. Goal

Protect the analytics platform, preserve user trust, and ensure production readiness as the Android app and admin dashboards begin collecting and processing user behavior signals.

## 2. Security architecture

### Identity and access
- curator and superadmin sessions remain the primary dashboard auth layer
- app ingestion uses signed app tokens or client identifiers
- all admin endpoints validate role and session before access
- actions are logged with actor, action, timestamp, and object ID

### API protection
- request throttling per IP and per app key
- strict body validation for all analytics payloads
- 2 MiB request body limit and bounded optional-field/property sizes
- reject nested analytics property keys associated with PII or secrets
- JSON content-type enforcement with structured `400`, `413`, `415`, and `429` responses
- DDoS and abuse filtering at the edge
- rejection of malformed JSON or oversized payloads
- aggregate ingestion counters in KV without storing IPs, tokens, hashes, or payloads

### Secret handling
- no hard-coded production secrets in frontend code
- store tokens in environment variables and secure Cloudflare bindings
- treat any token shipped inside an APK as extractable; do not use it as a
  long-term secret or sole proof of app identity
- rotate credentials on a regular schedule
- separate admin and app credentials
- protect any manual analytics-worker trigger with a separate worker credential

## 3. Privacy controls

- analytics collection is consent-based
- no direct PII in app telemetry
- no collection of raw contact data or personal media metadata unless explicitly required
- user-level analytics are protected behind strict admin routes
- product dashboards read summary tables, not raw event sets

## 4. Legal and policy compliance

### Minimum compliance posture
- Privacy Policy updated before app analytics rollout
- Consent screen included in Android app for tracking preferences
- user opt-out and data-deletion path documented
- retention schedule published
- external vendor review if analytics processing is delegated

### Required legal review areas
- GDPR / UK GDPR readiness
- CCPA / CPRA if US users are included
- Android Play Data Safety alignment
- cookie policy for any web analytics exposure
- DPA and vendor review for third-party analytics processors

## 5. Data retention policy

### Raw event retention
- 60–90 days for operational telemetry

### Aggregated metrics retention
- indefinite or extended retention if used for business reporting and trend analysis

### Deletion workflow
- support lawful deletion requests for user-linked analytics data
- ensure deletion is logged and auditable through the superadmin-only
  `/api/analytics/deletion` route and `android_analytics_deletion_audit` table
- keep aggregated reports free from individual-level reconstruction where possible

## 6. Operational scaling risks

### High variance in data quality
- bad or missing event fields
- mismatched schema versions
- duplicate uploads

Mitigation:
- schema versioning
- validation middleware
- event deduplication by event_id
- QA validation before app release

### High ingestion volume
- spikes during campaign or release windows
- app crash loops or invalid flush behavior

Mitigation:
- local batching in app
- queue-depth thresholds
- rate-limiting and queue backpressure
- worker-level ingestion scaling

### Query latency
- large raw tables slow dashboard reads

Mitigation:
- pre-aggregated summary tables
- time-bounded queries
- caching on hot metrics
- separate analytical read layer for historical reports

## 7. Audit requirements

- log admin access to analytics dashboard
- log app ingestion events and API errors
- record consent changes and deletion requests
- retain the consent-policy version alongside accepted events while keeping
  denial and revocation local
- maintain data lineage from raw event to aggregated summary

## 8. Production readiness checklist

Before launch, confirm:
- analytics API is auth-protected
- admin dashboard access is role-based
- consent is enforced on Android
- event payload schema is versioned
- retention policy and deletion route exist
- raw event table is separate from derived reporting tables
- dashboard loads under realistic traffic
- no PII is exposed through UI or exports

## 9. Recommended governance approach

- designate an owner for analytics data quality
- establish a release gate for schema changes
- review event names, properties, and retention policy before deployment
- document exceptions and compliance decisions
- maintain a changelog for analytics contract changes

## 10. Final recommendation

The platform should be built as a privacy-aware analytics system from day one: anonymized event ingestion, strict access control, summary-based reporting, and legal/compliance review before full Android rollout. This reduces risk, keeps costs lower, and ensures the dashboard remains trustworthy as user volume grows.
