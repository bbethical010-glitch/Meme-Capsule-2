# Production Analytics Dashboard Plan

## 1. Objective

Build a secure, admin-only analytics cockpit for Meme Capsule that gives internal teams visibility into app engagement, retention, content performance, AI recommendations, funnel health, and curation effectiveness. The dashboard must support both existing internal curation workflows and future Android app telemetry integration without exposing private user data.

## 2. Product scope

The dashboard will provide:

- KPI overview and scorecards
- user acquisition and behaviour trends
- retention cohort analysis
- content cluster performance
- curation verdict distribution
- AI insights and recommendation scoring
- churn-risk and engagement analysis
- role-based access for superadmin and curated internal operators

## 3. User roles and access

### Superadmin
- Full dashboard access
- Global data views and export
- All cohorts, sources, regions, app versions
- Audit logs and admin actions

### Curator / editor
- Content and performance view
- Limited cross-user metrics
- No raw user record access
- No PII or device-level export

### Analyst / product
- Aggregated cohorts, trend analysis, funnel analytics
- No direct access to unfiltered raw event payloads

### Public consumers
- No access to admin analytics

## 4. Dashboard structure

### Top-level screens

1. Overview
   - total active users
   - engagement rate
   - conversion rate
   - retention score
   - session duration
   - churn risk
2. Audience
   - segments by age group, behavior, region, platform
   - retention cohorts
   - churn prediction
3. Content
   - top meme categories and content clusters
   - CTR, saves, shares, likes
   - post-performance by topic and format
4. AI Insights
   - AI recommendation confidence
   - anomaly detection
   - content strategy suggestions
5. Funnel
   - app open → view → like/share → save → conversion
6. Retention
   - D1, D7, D30 retention curves
   - drop-off analysis

## 5. Technical architecture

### Frontend
- React dashboard integrated into the existing `/curate` experience
- Protected by the current curator auth model
- Same design language as existing neo-brutalist UI
- Support for filters: date range, platform, app version, source, cohort

### Backend
- Cloudflare Pages Functions for secure API endpoints
- Cloudflare D1 for operational and summary-level analytics tables
- Optional Cloudflare R2 for raw event payload backups or archive exports
- Optional ClickHouse / BigQuery later for heavy analytical workloads

### Data flow

```text
Android app / web app
    ↓
Analytics ingestion API
    ↓
Raw event validation + deduplication
    ↓
Aggregated metrics tables
    ↓
Dashboard reads from pre-aggregated models
    ↓
Admin visibility and exports
```

## 6. Data model

### Core event table
- event_id
- user_hash
- session_id
- event_name
- event_time_utc
- platform
- app_version
- source_channel
- country
- meme_id
- category
- properties_json
- consent_status

### Summary tables
- daily_user_metrics
- session_summary
- meme_performance
- retention_cohort
- acquisition_funnel
- ai_insights_summary

## 7. Dashboard technical requirements

- responsive layout for desktop and tablet views
- caching for hot queries
- role-based access middleware
- export support for CSV/Excel for trend reviews
- audit logging for sensitive admin views
- API response contracts with strict types

## 8. Security requirements

- all dashboard routes behind curator/superadmin auth
- session validation on every request
- no direct raw user data in UI
- strict rate limiting on analytics APIs
- signature validation for Android app ingestion
- event ingestion limited to authenticated app clients
- logs for all abnormal or suspicious access

## 9. Privacy and compliance requirements

- only aggregate analytics visible to admins
- no direct PII in production dashboards
- explicit consent flow in Android app before telemetry collection
- deletion request support for user-level analytics where legal requirements apply
- retention policies for raw events and derived analytics
- separate storage for consent records and analytics data

## 10. Obstacles to anticipate

### Common scaling issues
- event volume spikes during release weeks
- schema drift from app updates
- bad data quality from inconsistent instrumentation
- heavy queries impacting admin dashboard latency
- incompatible analytics across Android versions
- retention and churn analysis becoming expensive if computed live

### Mitigations
- batch analytics ingestion
- versioned event schema
- schema validation and fallback mapping
- pre-aggregation and materialized summary tables
- separate event store from read-optimized dashboards

## 11. Recommended rollout phases

### Phase 1: Static mock dashboard
- visual UI validation
- internal stakeholder review
- route and auth gating prototype

### Phase 2: Ingestion API
- secure event endpoint
- schema validation
- basic metrics

### Phase 3: Android event integration
- Room queue and app-level batching
- daily metrics and session summaries

### Phase 4: Product analytics
- retention, cohort, funnel, content performance

### Phase 5: AI analytics
- recommendation effectiveness and churn scoring

### Phase 6: Production hardening
- scaling reviews, privacy audits, compliance sign-off

## 12. Exit criteria

The dashboard is ready for production when:
- all routes are auth-protected
- analytics are valid and deduplicated
- dashboard loads quickly under real event volume
- no PII is exposed in the admin UI
- retention and funnel metrics are consistent with Android app events
- security, privacy, and legal review sign-off is complete
