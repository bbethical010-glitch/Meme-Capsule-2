# Database and Storage Plan

## Current Storage

The project uses Cloudflare R2 + D1 as its production edge database and storage layer. The repository now includes additive migrations through `018`, including Android analytics schema versioning, query indexes, and deletion auditing; apply them to each D1 environment before deploying code that uses those features.

Current storage layers:

- `src/data/fallbackMemes.ts`: static placeholder/starter memes bundled into the app.
- Browser `localStorage`: local admin dashboard drafts stored under `meme-capsule:admin-collection`.
- `d1/schema.sql`: production database schema for Cloudflare D1 (SQLite).
- `functions/api/random-meme.ts` and `functions/api/daily-meme.ts`: Cloudflare Pages Functions that query D1 when bindings exist and fall back safely when they do not.
- `functions/api/admin/memes.ts`: admin metadata API for listing, creating, updating, and archiving memes via D1.
- `functions/api/admin/upload.ts`: admin upload API for sending files to Cloudflare R2.

Local admin changes sync to the public app only in the same browser. This is useful for review, but it is not global production sync.

## Production Architecture

Use this order:

1. **Cloudflare R2** for curated meme file storage (zero egress fees).
2. **Cloudflare D1** for meme metadata (SQLite at the edge).
3. **Cloudflare Pages Functions** for public random/daily API routes.
4. **Cloudflare Pages** for hosting the PWA.

Why R2 + D1 is the best v1 fit:

- Zero-cost friendly (generous free tiers on all services).
- Zero egress bandwidth fees on R2 — never pay for serving images.
- No external vendor dependency — everything on Cloudflare.
- Native bindings — no API keys, no auth headers, no HTTP hops.
- SQLite metadata is simple and easy to manage.
- Faster — D1 runs at the edge, right next to the Functions.

## Previous Architecture (Supabase — replaced)

The project originally planned to use Supabase Storage + Postgres. That code exists in `functions/_shared/supabase.ts` and `supabase/schema.sql` but is being replaced. The Supabase approach used external REST API calls with API keys. The R2+D1 approach uses native Cloudflare bindings instead.

## Alternatives Considered

| Option | Use Case | Tradeoff |
|---|---|---|
| Supabase | Good SQL database + storage in one | External vendor, 5 GB/month bandwidth cap on free tier, requires API keys |
| Google Drive | Staging area for your personal uploads | Not a reliable public CDN; sharing links may be awkward for direct display. |
| MEGA | Large free storage | Encrypted private storage, not a public CDN, rate-limited bandwidth |
| Cloudinary | Best image/video delivery and transformations | Great upgrade path, but free credits can be exhausted by heavy media traffic. |
| Firebase Storage | Good if the app later becomes Firebase-native | SDK incompatible with Cloudflare Workers, NoSQL mismatch. |
| GitHub/static files | Tiny prototype only | Editing content requires commits and redeploys. |

## Meme Metadata Shape

Production table: `memes` (D1 SQLite)

Core fields:

- `id`: stable text ID such as `meme-exam-001`.
- `title`: admin-facing name.
- `image_url`: direct CDN URL, only if externally hosted.
- `storage_path`: path inside R2 bucket `memes`.
- `source_link`: original source or staging link.
- `category`: loose grouping.
- `tags`: JSON text array (SQLite stores as TEXT).
- `rarity`: `Common`, `Rare`, or `Legendary`.
- `status`: `draft`, `active`, or `archived`.
- `media_type`: `image` or `video`.
- `input_method`: `url`, `upload`, `google-drive`, or `seed`.
- `is_active`: public eligibility switch (integer 0/1 in SQLite).
- `uploaded_at`: created/upload timestamp (ISO string).
- `shown_count`: optional analytics counter.
- `share_count`: optional analytics counter.
- `likes_count`: global like analytics counter (integer, default 0).
- `rights_note`: `original`, `licensed`, `permission`, or `reviewed`.
- `share_text`: text used by share actions.
- `random_key`: indexed random selection helper (REAL type).
- `curation_status`: `keep`, `excluded`, `duplicate`, `review_later`, or `NULL`. Added in Migration 012 and now records final majority outcomes.
- `duplicate_of`: majority-resolved duplicate target. Added in Migration 014.
- `topics`, `tone`, `humour_mechanisms`: resolved secondary curation fields stored on finalized memes. Added in Migration 014; `tags` and `category` retain their existing topic mapping.
- `is_nsfw`: 18+ content flag (`INTEGER NOT NULL DEFAULT 0`). Added in Migration 013 (`013_add_nsfw_flag.sql`). Gated on public delivery routes (`is_nsfw = 0` by default; requested via `?nsfw=1`).
- `nsfw_flagged_by`: Flag source (`'ai-judge'`, `'curator'`, `'report'`, or `NULL`). Added in Migration 013.
- Index: `idx_memes_is_nsfw` on `memes(is_nsfw)`.

Only records with `status = 'active'`, `is_active = 1`, and `is_nsfw = 0` (unless `?nsfw=1` requested) should be returned to users.

### Reporting System Table: `meme_reports`
- `id`: Auto-incrementing integer primary key.
- `meme_id`: ID of the reported meme (if known).
- `meme_url`: URL of the reported meme.
- `meme_title`: Title of the reported meme.
- `author`: Name or identifier of the reporting user.
- `source`: Source of the report (e.g. "Meme Capsule").
- `reason`: Primary reason for the report.
- `details`: Optional extra details provided by the user.
- `device_id`: Device identifier of the reporting user.
- `status`: State of the report (`pending`, `resolved`, `dismissed`).
- `created_at`: Creation timestamp.
- `updated_at`: Last updated timestamp.

### Force Removals Audit Table: `meme_force_removals`
Created in Migration 011 (`011_force_removals.sql`) to provide an immutable audit trail when non-meme media or corrupt files are permanently expunged:
- `id`: Auto-generated string ID (`frm-` prefix followed by hex random blob).
- `meme_id`: Unique target meme ID (foreign key to `memes(id)`).
- `title`: Cached title of the removed meme.
- `image_url`: Original delivery/staging URL.
- `storage_path`: Original R2 storage path.
- `r2_key`: Extracted object key within Cloudflare R2 bucket `memes`.
- `removed_by`: ID of the judge who executed the removal (foreign key to `cat_users(id)`).
- `removed_by_name`: Display name of the judge.
- `reason`: Optional reason specified during removal (up to 200 characters).
- `r2_deleted`: Integer boolean (1 if object was deleted from R2, 0 if R2 deletion failed or media was non-R2/Reddit).
- `r2_error`: Error message text if R2 deletion encountered an exception.
- `removed_at`: ISO timestamp when removal was executed.
- `r2_deleted_at`: ISO timestamp when R2 deletion was confirmed.

### Android Analytics Table: `android_analytics_events`
Migration 015 stores consented, anonymized Android telemetry separately from
the legacy `meme_events` contract:
- unique `event_id` for retry-safe ingestion
- required `schema_version` for payload contract compatibility
- hashed `user_hash`, session, event name, UTC timestamp, app/OS version
- optional country, meme, category, source, screen, and bounded properties JSON
- `consent_status` constrained to `granted`

Dashboard reads aggregate this table and never expose raw event payloads or
user hashes.

Ingestion rate-limit and operational counters are stored separately in the
`ANALYTICS_KV` namespace with expiring keys. These counters do not contain raw
events, user hashes, client IP addresses, or app tokens.

The scheduled analytics worker deletes expired raw Android events in bounded
batches. The default retention is 90 days; `ANALYTICS_RAW_RETENTION_DAYS` may
configure a value from 1 through 365 days.

Migration 017 adds composite indexes on Android event time with platform,
event name, category, and session to keep Phase 3 dashboard queries
time-bounded as the raw table grows.

Migration 018 adds `android_analytics_deletion_audit`, which records the
request reference, anonymous user hash, deleted event count, superadmin
operator, status, and completion timestamps for verified deletion requests.

Migration 019 adds `consent_version` to `android_analytics_events`, defaulting
legacy rows to `v1`, so dashboard data can be traced to the consent-policy
version active when each event was created.

Migration 020 adds `android_analytics_daily_summary`, a bounded 90-day
worker-maintained aggregate keyed by date, platform, event, category, and app
version. It contains only counts and distinct-user/session aggregates; raw
events remain the source of truth for deletion and retention operations.

### Firebase Notification Tokens

Migration 021 creates the device-token table and migration 022 renames it to
the canonical `notification_tokens` table used by Android registration and
the protected admin FCM dispatch/statistics endpoints. It stores each FCM
token, platform, app version, active flag, and created/updated timestamps.

## API Flow

Public random meme:

```text
User taps Spawn Another
  -> frontend calls getRandomMeme()
  -> local active admin drafts are checked first during development
  -> deployed app calls GET /api/random-meme
  -> Cloudflare Function queries D1 active memes via binding
  -> one approved meme is returned
```

Daily Drop:

```text
User taps Daily Drop
  -> frontend calls getDailyMeme()
  -> Function queries D1 for active memes
  -> stable daily pick returned based on date
```

## Admin Sync Plan

Phase 1.5 admin dashboard (local mode):

- Saves drafts in browser `localStorage`.
- Lets you test URLs, uploads, metadata, status, and previews quickly.
- Active local items are immediately visible in the same browser public app.

Phase 2 R2 + D1 admin (backend mode):

- Upload files to R2 bucket `memes` via `env.MEMES_BUCKET.put()`.
- Insert/update metadata rows in D1 `memes` table via `env.DB.prepare()`.
- Mark reviewed memes with `status = 'active'` and `is_active = 1`.
- Public API automatically starts returning the updated collection.

## Admin API Details

Backend mode uses same-origin Cloudflare Pages Functions. The frontend admin dashboard sends an admin token in `Authorization: Bearer <token>` and `X-Admin-Token`. The token must match `ADMIN_API_TOKEN` configured on Cloudflare.

Required Cloudflare environment variable:

- `ADMIN_API_TOKEN`

D1 and R2 are accessed via native bindings defined in `wrangler.toml` — no URL or key environment variables needed.

Routes:

- `GET /api/admin/memes`: returns all meme records for admin review.
- `POST /api/admin/memes`: creates one metadata row in D1.
- `PATCH /api/admin/memes`: updates one metadata row; pass `originalId` when changing an ID.
- `DELETE /api/admin/memes`: archives one metadata row instead of hard deleting.
- `POST /api/admin/upload`: uploads one image/video file to R2 and returns `storage_path` plus public URL.

## Report moderation

The token-protected `/reports` dashboard supports report status changes
(`pending`, `resolved`, and `dismissed`) plus destructive moderation actions for
reports linked to a `meme_id`:

- **Remove Meme** archives the row in `memes` and sets `is_active = 0`.
- **Blacklist + Remove** inserts the meme into the existing `content_blacklist`
  table, then archives it and resolves the report.
- **Mark NSFW** sets `is_nsfw = 1` and `nsfw_flagged_by = 'report'` on the meme without removing it from circulation (non-destructive moderation action for `NSFW` reports), resolving the report.

Destructive actions use the meme ID stored on the report rather than trusting a
browser-supplied target. The dashboard requires `ADMIN_API_TOKEN` and asks for
confirmation before removing or blacklisting content.

Public routes (`/api/random-meme`, `/api/daily-meme`, `/api/memes/random`) never use the admin token. They only return rows with `status = 'active'`, `is_active = 1`, and an authoritative finalization in `meme_curation_final` with `corpus_status = 'keep'`. By default, NSFW content (`is_nsfw = 1`) is strictly excluded (`AND (m.is_nsfw IS NULL OR m.is_nsfw = 0)`). Clients can request NSFW-inclusive results by supplying `?nsfw=1`. All unfinalized or excluded memes are maintained in `status = 'archived'` (`is_active = 0`) and are excluded at the SQL query level.

## Authoritative Resolution & Active Pool Synchronization

Human Layer 0 curation is a three-judge majority workflow. Judges 1-3 each have one independent `meme_curation` row per meme. The queue excludes only the current judge's own vote and finalized/arbitration cases, and the regular judge response never exposes another human's vote.

- Fewer than three human votes: retain only the per-judge vote. Do not write `meme_curation_final` or finalize `memes`.
- 3:0 or 2:1 keep: write `meme_curation_final` as `keep`, set `memes.curation_status='keep'`, `status='active'`, `is_active=1`, and preserve `tags=JSON.stringify(topics)` plus `category=topics[0]` when topics exist.
- 3:0 or 2:1 excluded: write `meme_curation_final` as `excluded` and soft-archive. Only unanimous 3:0 excluded uses the existing Force Remove path for the R2 object and related D1 rows.
- Duplicate: set `memes.curation_status='duplicate'`, `duplicate_of`, and archive. A majority pair must agree on the target. Any target split under unanimous duplicate status routes to arbitration.
- Review later: set `memes.curation_status='review_later'` and archive into the secondary queue.
- 1:1:1 Layer 0 splits and unresolved duplicate targets remain without a final row and surface in the SuperAdmin arbitration queue.

`meme_curation_final` is limited to `keep` and `excluded`; duplicate and review_later outcomes plus resolved topics/tone/mechanisms are stored directly on `memes`. The additive Migration 014 adds `duplicate_of`, `topics`, `tone`, and `humour_mechanisms`. Historical migrations are unchanged. Apply migration 014 before deploying the updated Pages Functions.

Public routes (`/api/random-meme`, `/api/daily-meme`, `/api/memes/random`) continue to require `status='active'`, `is_active=1`, and a `meme_curation_final` row with `corpus_status='keep'`. Duplicate, review_later, excluded, unfinalized, and NSFW-filtered content remains ineligible for public delivery.

## Google Drive Workflow

Recommended use:

1. Upload raw memes to Google Drive as a private staging folder.
2. Copy the Drive link into the admin dashboard as `source_link`.
3. Review title, category, tags, rarity, and rights note.
4. Before production, upload the optimized file to R2 via the admin upload API.
5. Keep the Drive link as an audit/source reference, not the primary public delivery URL.

Google Drive is convenient for collecting content, but R2 is better for serving content to users.
## Migration 021: live Android analytics

Migration 021 adds the receive-time index plus `android_live_minute`,
`android_live_hourly`, `android_live_presence`, and `android_pipeline_health`. Minute
rollups retain 48 hours, hourly rollups retain 35 days, presence retains 48 hours after
last seen, and health rows are operational metadata. Only presence contains a user hash;
deletion removes it through the existing verified-deletion endpoint.
