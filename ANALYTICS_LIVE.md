# Live analytics

Live analytics uses additive D1 rollups (`android_live_minute`, `android_live_hourly`,
`android_live_presence`, and `android_pipeline_health`). Raw events remain append-only and
responses never expose hashes, sessions, tokens, IPs, or raw properties. Presence is deleted
by the verified deletion flow and expires after 48 hours; minute and hourly rollups expire after
48 hours and 35 days.

SuperAdmin-only endpoints are:

- `GET /api/analytics/live/summary?fresh=1`
- `GET /api/analytics/live/feed?cursor=`
- `GET /api/analytics/live/insights`
- `GET /api/analytics/live/health`
- `POST /api/analytics/live/rebuild`

The dashboard polls LIVE every 10 seconds by default and supports 30/60 seconds or OFF. Apply
migration 021, deploy the Analytics Worker, deploy Pages, then call `live/rebuild` once. The
Worker refreshes today and yesterday before purging data, writes hourly buckets and a heartbeat,
and preserves completed daily summaries.

`LIVE` means events are arriving and the Worker is healthy; `DELAYED` means event age is over
five minutes; `STALE` means it is over ten minutes or the Worker is over 45 minutes old;
`SESSION EXPIRED` means authentication returned 401. Investigate the APK queue, consent,
token rotation, Pages route, D1 migration, and Worker cron in that order.

