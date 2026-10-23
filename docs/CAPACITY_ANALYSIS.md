# Meme Capsule Capacity Analysis

> **Scope:** Current `Meme-Capsule-2` parent branch
> **Repository role:** Cloudflare Pages backend, D1/R2 data layer, and internal curation/admin workbenches
> **Prepared:** 2026-10-20
> **Status:** Quota-based planning estimate; not a production load-test result

## Executive summary

The frontend is mostly static React content served by Cloudflare Pages and its CDN. Static page and asset delivery is therefore not expected to be the first bottleneck. The practical limits are the Pages Functions request quota, D1 reads/writes, Workers KV operations used by analytics rate limiting, and the request pattern of the companion mobile application.

Under the documented Free-tier assumptions used by this repository:

| Scenario | Planning capacity |
|---|---:|
| Current backend with analytics KV rate limiting enabled | **~100–1,000 active users/day** |
| After removing per-flush KV writes as a bottleneck | **~4,000–10,000 public DAU** |
| With reliable mobile prefetch/batching and cached media | **~10,000–25,000 public DAU** |
| One human judge, sustainable 8-hour day | **~500–1,000 memes/day** |
| One human judge, very fast review pace | **~2,000–4,000 memes/day** |
| Worker-request ceiling for one judge | **~50,000 memes/day** |

The last number is an infrastructure ceiling, not a realistic human-review capacity. Quality, fatigue, image loading, D1 writes, and the other two human judges are the real constraints.

## Infrastructure assumptions

The estimates below use the limits recorded in [CLOUDFLARE_FREE_TIER_CAPACITY_AUDIT.md](./CLOUDFLARE_FREE_TIER_CAPACITY_AUDIT.md):

| Resource | Assumed Free-tier limit | Relevant implementation |
|---|---:|---|
| Pages Functions / Workers requests | 100,000/day | Public and internal `/api/*` routes |
| D1 row reads | 5,000,000/day | Public delivery, curation, dashboards |
| D1 row writes | 100,000/day | Votes, likes, telemetry, metadata |
| Workers KV writes | 1,000/day | `/api/events` device rate limiter |
| R2 storage | 10 GB-month | Meme media objects |
| R2 Class B operations | 10,000,000/month | Media reads, subject to CDN/cache behavior |

Cloudflare quotas and pricing can change. Verify the account's current plan and dashboard quotas before launch. These figures should not be treated as a service-level guarantee.

## Public frontend and backend capacity

### Request model

The public random-meme routes call `randomMemeOrFallback()`:

- `GET /api/random-meme`
- `GET /api/memes/random`

The normal database path performs an indexed random-key lookup over active, finalized memes in `functions/_shared/d1r2.ts`. If the lookup fails or returns no row, the application returns a static fallback meme instead of failing the user request. The daily route is a separate D1 read and also has a fallback.

The simple request ceiling is:

```text
100,000 daily API requests / API requests per user per day
```

| Direct API activity | Approximate public DAU ceiling |
|---:|---:|
| 8 requests/user/day | 12,500 |
| 10 requests/user/day | 10,000 |
| 20 requests/user/day | 5,000 |
| 25 requests/user/day | 4,000 |
| 50 requests/user/day | 2,000 |

These values assume each meme request reaches the backend. A companion mobile client that prefetches several memes per request can reduce API requests per user substantially. That higher estimate must be validated against the mobile repository; this repository does not contain the full public Android client.

### Analytics bottleneck

The analytics frontend queues events locally and flushes them every 60 seconds or when a document becomes hidden (`src/analytics/analyticsFlush.ts`). Each flush calls `POST /api/events`. The endpoint:

1. Reads a device-specific counter from `ANALYTICS_KV`.
2. Writes the incremented counter back to `ANALYTICS_KV`.
3. Inserts the event batch into D1.

The endpoint accepts up to 200 events per batch and allows 10 requests per device per minute (`functions/api/events.ts`).

If the assumed 1,000 KV writes/day limit applies, analytics can fail before public meme delivery reaches its request ceiling:

| Flushes per active user/day | Approximate KV-limited users/day |
|---:|---:|
| 1 | 1,000 |
| 2 | 500 |
| 10 | 100 |

Consequently, the conservative launch capacity of the **unmodified** system is approximately **100–1,000 active users/day**, depending on client flush behavior. Moving rate limiting away from a KV write on every batch, or otherwise redesigning the counter, is required before relying on the larger public-user estimates.

Analytics also writes one D1 row per accepted event. At 20–30 events per user/day:

```text
5,000 users × 20–30 events = 100,000–150,000 D1 writes/day
```

That can exhaust the assumed D1 write quota even after the KV issue is addressed. Client-side aggregation and lower-frequency summaries should be considered for high traffic.

## Internal curation and admin capacity

### One judge reviewing memes

A normal curation cycle requires approximately:

1. `GET /api/curate/next`
2. `POST /api/curate/approve` or `POST /api/curate/save`

The curation `next` endpoint now uses a 10-minute isolate-local statistics cache and avoids repeated count scans during continuous swiping. The cache is not globally shared across Cloudflare isolates, so it reduces typical load but does not provide a strict global guarantee.

The Worker-request ceiling for one judge is therefore approximately:

```text
100,000 requests/day ÷ 2 requests/meme = 50,000 memes/day
```

That is not a human limit. Expected review throughput is:

| Review pace | 24-hour theoretical pace | Realistic 8-hour pace |
|---:|---:|---:|
| 15 seconds/meme | 5,760 | 1,920 |
| 30 seconds/meme | 2,880 | 960 |
| 45 seconds/meme | 1,920 | 640 |
| 60 seconds/meme | 1,440 | 480 |

### Recommended single-judge operating range

- **Sustainable, quality-focused target:** **500–1,000 memes per judge per 8-hour day**
- **Fast repetitive review:** **1,000–2,000/day**
- **Aggressive upper range:** **2,000–4,000/day**
- **Absolute Worker-request ceiling:** approximately **50,000/day**, not practically achievable by one person

These figures describe decisions submitted by one judge. They do not mean that the memes are finalized for public release. The human consensus workflow still requires judges 1, 2, and 3; AI judges 4 and 5 are advisory pre-evaluators and do not replace human consensus.

### Admin and SuperAdmin auto-refresh

The SuperAdmin dashboard loads a summary and meme list on each refresh. Its default auto-refresh interval is 10 seconds:

```text
6 requests/minute × 60 × 24 = 8,640 requests/day per continuously open tab
```

At that rate, approximately 11 continuously open tabs could consume 100,000 daily Worker requests before public traffic is included. Internal dashboards should use a longer interval or manual refresh during public traffic peaks.

## D1 and R2 considerations

### D1 reads

Public random selection is designed around an indexed `random_key`. Curation and reporting endpoints can be more expensive because they join curation tables, calculate counts, or list large result sets. The current curation stats cache reduces repeated count work, but cold starts and cache expiry still cause database reads.

The most important operational rule is to avoid unindexed table scans on user-facing paths. A query equivalent to `ORDER BY RANDOM()` over the entire memes table would scale with corpus size and could exhaust the daily row-read quota quickly. The indexed random-key approach is preferred.

### D1 writes

D1 writes are generated by:

- Human curation votes and finalization records
- Likes and moderation actions
- Batched analytics events
- Admin metadata changes

Three human judges reviewing a corpus means one meme requires up to three human decisions before consensus. At high curation throughput, D1 writes—not Worker requests—can become the limiting resource.

### R2 media

R2 has no meaningful bandwidth cost under the stated plan assumptions, but media storage and Class B read operations still need monitoring. Immutable image/video URLs should be served with long-lived cache headers through a CDN/custom domain. Browser and edge caching can reduce repeated R2 reads substantially.

## Phase 6 implementation controls

The analytics worker now refreshes `android_analytics_daily_summary` for a bounded
90-day window and reports the number of summary rows refreshed. Dashboard Android
aggregate responses use a one-minute KV TTL and are invalidated after a successful
worker run. This reduces repeated D1 scans while keeping dashboard freshness
bounded; it does not replace representative load testing or account quota monitoring.

## Capacity states and recommendations

| State | Expected capacity | Main limiting factor |
|---|---:|---|
| Current, analytics unchanged | 100–1,000 DAU | KV writes from event flushes |
| Analytics KV bottleneck removed | 4,000–10,000 DAU | 100,000 Worker requests/day |
| Prefetch/batching and media caching verified | 10,000–25,000 DAU | D1 writes and actual client behavior |
| Beyond these levels | Measure and upgrade | Account quotas, D1 workload, and traffic mix |

Before a public growth campaign:

1. Measure actual API requests per user and analytics flushes per session.
2. Monitor Workers requests, D1 rows read/written, KV operations, and R2 operations.
3. Change analytics rate limiting so normal event ingestion does not require a KV write per batch.
4. Confirm the companion mobile app's prefetch/batch behavior against the backend routes.
5. Load-test with a production-sized D1 dataset and representative media.
6. Move to a paid Cloudflare plan before sustained traffic approaches the Free-tier ceilings.

## Limitations of this analysis

This document is a static capacity model based on source inspection and assumed platform quotas. It does not measure:

- Cloudflare isolate concurrency or tail latency under load
- Actual D1 row counts returned/scanned in production
- R2 cache-hit ratio
- Real mobile session length and swipe rate
- AI provider throughput or rate limits
- The current Cloudflare account's billing-plan configuration

The numbers should be used for planning and alert thresholds, not as a guarantee of maximum concurrent connections or uptime.
