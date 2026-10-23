# Meme Capsule Analytics 📊

This document outlines the architecture, deployment, and local development of the Meme Capsule Analytics system.

## Architecture

The analytics system is built natively on Cloudflare using three core components:

1.  **Frontend Tracking SDK (`src/analytics/`)**: A robust TypeScript layer inside the Capacitor/web app that queues events (`view`, `skip`, `like`, `share`, etc.) and flushes them in batches via `fetch` or `navigator.sendBeacon`. It prevents UI blocking and handles offline requeuing. Device IDs are anonymized using SHA-256 browser fingerprints.
2.  **Ingestion API (`functions/api/events.ts`)**: A Cloudflare Pages Function that receives batched events. It validates, deduplicates, and inserts raw event data into the `meme_events` D1 table.
3.  **Aggregation Worker (`workers/analyticsAggregator.ts`)**: A standalone Cloudflare Worker triggered via Cron (`*/30 * * * *`). It reads the raw `meme_events` table, calculates heavy metrics (engagement, virality, retention, percentiles) using pure functions (`analyticsFormulas.ts`), and writes the consolidated state to the `meme_analytics` table for fast O(1) reads.
4.  **Dashboard UI (`src/admin/analytics-dashboard/`)**: A standalone React dashboard integrated into the Admin panel, protected by `AdminGate` (PIN based). Pure SVG charts, actionable insights, and full metric breakdowns.

The Android KPI path is now available separately from the legacy web interaction
path: `POST /api/analytics/events` validates consented Android batches and writes
to `android_analytics_events` (migrations 015-016), while the curator-session-protected
`GET /api/analytics/overview` and `GET /api/analytics/trends` endpoints aggregate
the raw Android table directly for a 30-second live dashboard refresh. Configure
`ANALYTICS_APP_TOKEN` before enabling Android ingestion.
Retention, funnel, content, audience, and deterministic insight endpoints are
also available under `/api/analytics/*` and are consumed by the corresponding
dashboard tabs. These readers use aggregate SQL only and never return hashes or
raw properties.

The scheduled analytics worker also removes expired rows from
`android_analytics_events` in bounded batches. Set
`ANALYTICS_RAW_RETENTION_DAYS` in the worker environment when a value other than
the 90-day default is required. Manual `POST` execution requires the separate
`ANALYTICS_WORKER_TOKEN` via `Authorization: Bearer ...` or
`X-Analytics-Worker-Token`; scheduled execution does not require this header.
Overview and trend responses include freshness metadata and explicit empty-state
flags for environments that have not received Android events yet.
Phase 6 adds a worker-maintained 90-day daily Android summary table and
one-minute KV caching for Android aggregate readers. Phase 7 verification is
available with `npm run test:analytics`; staging checks are documented in
`docs/ANALYTICS_STAGING_VERIFICATION.md`.

## Local Development & Testing

You will need two separate Wrangler processes to fully test the pipeline locally, because the aggregator is a separate Worker, while the API is a Pages Function.

### 1. Setup Environment Variables

Add the following to your `.dev.vars` file:

```env
ADMIN_API_TOKEN="your_super_secret_token"
VITE_ADMIN_PIN="123456"
```

### 2. Create the Local KV Namespace

```bash
npx wrangler kv:namespace create ANALYTICS_KV --preview
```
Update your `wrangler.toml` with the generated ID.

### 3. Run the System

**Terminal A: Run the Pages App & Ingestion API**
```bash
npm run dev
```

**Terminal B: Run the Aggregation Worker**
```bash
npx wrangler dev workers/analyticsAggregator.ts --local
```

### 4. Triggering Aggregation Manually

Instead of waiting for the cron schedule, you can trigger the pipeline manually via the admin UI by clicking **"Recalculate Now"** in the Analytics Dashboard, or via CURL:

```bash
curl -X POST http://localhost:8788/api/admin/analytics/recalculate \
  -H "Authorization: Bearer your_super_secret_token"
```

## Deployment to Cloudflare

Deployment involves two separate entities:

1.  **Deploy the Main Pages App**:
    ```bash
    npm run build
    npx wrangler pages deploy dist --project-name meme-capsule
    ```

2.  **Deploy the Aggregation Worker**:
    ```bash
    npx wrangler deploy src/workers/analyticsAggregator.ts --name meme-capsule-aggregator
    ```

Ensure that both projects have the `DB` (D1) and `ANALYTICS_KV` bindings attached in the Cloudflare Dashboard.

## Schema Highlights

The system separates "raw events" from "aggregated analytics" to ensure the ingestion endpoint remains blazing fast.

-   `meme_events`: Append-only table storing atomic actions (view, like, skip, etc).
-   `meme_analytics`: Flattened O(1) read table storing computed scores, ranks, and rates.
-   `app_global_stats`: KV-style table for global app metrics (total views, total unique devices, etc).
