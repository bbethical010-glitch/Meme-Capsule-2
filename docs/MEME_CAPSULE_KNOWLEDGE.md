# MEME CAPSULE — MASTER KNOWLEDGE DOCUMENT & CANONICAL SYSTEM SPECIFICATION
### The Definitive System Reference for Developers, AI Coding Agents, Curators, Product Teams & Marketers

> **Document Type:** Canonical Master Architecture, Technical & Product Specification  
> **Classification:** Living Project Context & Reusable AI Operating Reference Across All Codebases  
> **App / System Name:** Meme Capsule  
> **Android Package Identifier:** `com.meme.capsule`  
> **Mobile App Version:** `v3.7` (`versionCode 28`) — Built APKs in `builds/`  
> **Official Web Platform:** [https://memecapsule.wtf](https://memecapsule.wtf) (Vite / React Multi-Page Static Prerendered)  
> **Serverless Edge Backend:** [https://meme-capsule-eww.pages.dev](https://meme-capsule-eww.pages.dev) (Cloudflare Pages, D1 SQLite, R2 CDN)  
> **Project Team & Engineering Leadership:**  
> - **Anmol Verma** (`editorav010-dev`): Lead Backend Developer — Full backend engineering, serverless architecture, core algorithms, AI tools implementation, security, curation systems, and all internal backend workbenches.  
> - **Pratham Pandey** (`bbethical010-glitch`): Lead Frontend Developer & Original Ideator — Founding concept, frontend landing pages, Android APK development, app theme, typography, UI/UX, Java Android bridge, and client-side integrations.  
> - **Faraz Ahmed**: Social Media & Marketing Lead — Social media management, content planning, niche analysis, scripting, and marketing campaigns.  
> **Official App Email (User Support & Marketing):** `support@memecapsule.wtf`  
> **Official Social Media:**  
> Instagram: https://www.instagram.com/capsule.meme/ | X: https://x.com/memecapsule_ | Threads: https://www.threads.com/@capsule.meme  
> **Last Master Synchronization:** September 26, 2026   

---

## TABLE OF CONTENTS

1. [Meme Capsule — Core Product Questions (Stand-Alone FAQ)](#1-meme-capsule--core-product-questions-stand-alone-faq)
2. [Executive System Summary: Three Distinct Codebases](#2-executive-system-summary-three-distinct-codebases)
   - 2.1 [Collaborative Development & Engineering Division](#21-collaborative-development--engineering-division)
   - 2.2 [The Three Decoupled Codebases](#22-the-three-decoupled-codebases)
3. [PART A: PUBLIC MOBILE APPLICATION (`com.meme.capsule`)](#3-part-a-public-mobile-application-commemecapsule)
   - 3.1 [Product Identity, Philosophy & Vision](#31-product-identity-philosophy--vision)
   - 3.2 [Target Users, Personas & Core Scenarios](#32-target-users-personas--core-scenarios)
   - 3.3 [Complete End-User Feature Inventory (v2.7 / VersionCode 18)](#33-complete-end-user-feature-inventory-v27--versioncode-18)
   - 3.4 [Card Deck, Gestures & Instant-Touch Overlay Architecture](#34-card-deck-gestures--instant-touch-overlay-architecture)
   - 3.5 [Neo-Brutalist Viral Share Bottom Sheet & Social Dispatch System](#35-neo-brutalist-viral-share-bottom-sheet--social-dispatch-system)
   - 3.6 [Native Android Bridge & Scoped MediaStore Storage (`MainActivity.java`)](#36-native-android-bridge--scoped-mediastore-storage-mainactivityjava)
   - 3.7 [Meme Vault, Mood Boards ("Pinned Energy") & Offline Collections](#37-meme-vault-mood-boards-pinned-energy--offline-collections)
   - 3.8 [Mobile Monetization (AdMob + Google Play In-App Purchases & Neo-Brutalist Store)](#38-mobile-monetization-admob--google-play-in-app-purchases--neo-brutalist-store)
   - 3.9 [Mobile Safety, Age Verification (DOB) & Content Reporting](#39-mobile-safety-age-verification-dob--content-reporting)
   - 3.10 [Google Play Store In-App Rating & Review Engine (`RatingModal.tsx`)](#310-google-play-store-in-app-rating--review-engine-ratingmodaltsx)
   - 3.11 [Critical Engineering Guardrails & Styling Gotchas (Tailwind v4)](#311-critical-engineering-guardrails--styling-gotchas-tailwind-v4)
4. [PART B: PROMOTIONAL, PRESS & WEB PLATFORM (`memecapsule.wtf`)](#4-part-b-promotional-press--web-platform-memecapsulewtf)
   - 4.1 [Platform Architecture, Modernized Stack & Static HTML Prerendering](#41-platform-architecture-modernized-stack--static-html-prerendering)
   - 4.2 [Interactive Live Drop Preview Simulator & Quota Lockout Bumper](#42-interactive-live-drop-preview-simulator--quota-lockout-bumper)
   - 4.3 [3D Interactive Device Mockups with Authentic WebP Screenshots & Lightbox](#43-3d-interactive-device-mockups-with-authentic-webp-screenshots--lightbox)
   - 4.4 [Kage-Inspired Atmospheric Web UI](#44-kage-inspired-atmospheric-web-ui)
   - 4.5 [Complete Removal of Acid Glitch UI Mode](#45-complete-removal-of-acid-glitch-ui-mode)
   - 4.6 [Technical Transparency & "How It Works" Section](#46-technical-transparency--how-it-works-section)
   - 4.7 [Multi-Page Web Routing & Dedicated Pages](#47-multi-page-web-routing--dedicated-pages)
   - 4.8 [Serverless Contact API via Resend Edge Function](#48-serverless-contact-api-via-resend-edge-function)
   - 4.9 [Web Monetization: Google AdSense Unit `meme1`](#49-web-monetization-google-adsense-unit-meme1)
   - 4.10 [Search, Generative & AI Engine Optimization (SEO, GEO & AEO)](#410-search-generative--ai-engine-optimization-seo-geo--aeo)
5. [PART C: DEVELOPER / INTERNAL BACKEND & EDGE INFRASTRUCTURE](#5-part-c-developer--internal-backend--edge-infrastructure)
   - 5.1 [Serverless Edge Infrastructure (Cloudflare Pages Functions)](#51-serverless-edge-infrastructure-cloudflare-pages-functions)
   - 5.2 [Cloudflare D1 Database Schemas & 3-Tier Partitioning Architecture (Migration 012)](#52-cloudflare-d1-database-schemas--3-tier-partitioning-architecture-migration-012)
   - 5.3 [Object Storage & Media Delivery (Cloudflare R2 Bucket `memes`)](#53-object-storage--media-delivery-cloudflare-r2-bucket-memes)
   - 5.4 [Multi-Judge Consensus & Layer 0 Keyboard Curation (`/curate`, `/categorise`)](#54-multi-judge-consensus--layer-0-keyboard-curation-curate-categorise)
   - 5.5 [SuperAdmin Arbitration & Authoritative Active Synchronization](#55-superadmin-arbitration--authoritative-active-synchronization)
   - 5.6 [Admin Console, 5-Metric Status Bar & SQL Runner (`/admin`)](#56-admin-console-5-metric-status-bar--sql-runner-admin)
   - 5.7 [Token-Gated Safety Moderation & Blacklisting (`/reports`)](#57-token-gated-safety-moderation--blacklisting-reports)
   - 5.8 [Multimodal AI Pre-Curator Loop (`/ai-judge` & NVIDIA NIM Llama 3.2 Vision)](#58-multimodal-ai-pre-curator-loop-ai-judge--nvidia-nim-llama-32-vision)
   - 5.9 [Telemetry Pipeline & Edge Ranking Recalculation Engine](#59-telemetry-pipeline--edge-ranking-recalculation-engine)
6. [Unified Neo-Brutalist Design System & Design Tokens](#6-unified-neo-brutalist-design-system--design-tokens)
7. [Comprehensive Implementation Status Audit Matrix](#7-comprehensive-implementation-status-audit-matrix)
8. [Discrepancy Reconciliation, Known Limitations & Resolved Issues](#8-discrepancy-reconciliation-known-limitations--resolved-issues)
9. [Project Terminology & Master Glossary](#9-project-terminology--master-glossary)
10. [Content Strategy, One-Liners & Copy Kit](#10-content-strategy-one-liners--copy-kit)
11. [AI Agent Portable Handoff Prompt](#11-ai-agent-portable-handoff-prompt)

---

## 1. MEME CAPSULE — CORE PRODUCT QUESTIONS (STAND-ALONE FAQ)

> [!TIP]
> This section is self-contained and formatted for instant extraction. It can be copied directly into prompts for other AI models, marketing assistants, or new developers to provide the canonical answers regarding Meme Capsule.

```text
================================================================================
          MEME CAPSULE — CORE PRODUCT QUESTIONS & AUTHORITATIVE ANSWERS
================================================================================
```

### Q1: What is Meme Capsule?
**Meme Capsule** is an anti-algorithm, single-action meme delivery platform engineered for immediate entertainment without feeds, doomscrolling, or social clutter.
- **Public Mobile Product:** A native Android application (`com.meme.capsule`, current version `v3.7` / `versionCode 28`) available on Google Play. Built with React 19, Vite 6, Tailwind CSS v4, and Capacitor 8, it operates like a digital arcade vending machine: tapping the **`HIT ME`** button dispenses exactly one hand-screened, high-variance meme onto a 4-card 3D perspective spring stack.
- **Public Web Platform:** A multi-page, statically prerendered web platform at [https://memecapsule.wtf](https://memecapsule.wtf) featuring a live interactive drop preview simulator (with a 5-drop quota and Google Play install bumper), 3D interactive phone mockups with authentic WebP screenshots, Section 04.5 "Under the Hood" technical transparency, an official `/about` Press Kit, and Google AdSense monetization (`meme1`).
- **Developer / Serverless Edge Backend:** A serverless edge architecture on Cloudflare Pages (`https://meme-capsule-eww.pages.dev`), Cloudflare D1 (SQLite database), and Cloudflare R2 (media bucket), coupled with Neo-Brutalist internal tools for human multi-judge curation (`/curate`), admin database syncing (`/admin`), user safety moderation (`/reports`), and AI-assisted pre-evaluation (`/ai-judge`).

### Q2: Why does Meme Capsule exist?
Modern internet culture is trapped inside social media feeds (Instagram, TikTok, X, Reddit) controlled by recommendation algorithms that optimize for watch time, outrage, repetitive trends, and sponsored posts. Users spend 45 minutes doomscrolling just to encounter two genuinely funny memes. Meme Capsule was created to restore the original magic of internet humor: instant, surprise-driven, zero-friction entertainment with no tracking, no accounts, and no algorithmic manipulation.

### Q3: What problem is it trying to solve?
1. **Algorithmic Fatigue & Doomscrolling:** Eliminates feed-induced sensory overload and screen addiction by replacing continuous vertical scroll with deliberate, discrete single-capsule drops.
2. **Quality Dilution & Repost Slop:** Fixes the low-effort repost problem by curating memes through a multi-stage pipeline: staging via Google Drive, automated multimodal AI pre-judging (Gemini Vision and NVIDIA NIM Llama 3.2 Vision), human multi-judge consensus, SuperAdmin arbitration, and community reporting.
3. **Saving & Sharing Friction:** Cleanly saving a meme on Android usually requires taking a screenshot, cropping black bars, or dealing with intrusive app watermarks. Meme Capsule features native Android MediaStore integration for instant, lossless 1-tap gallery saving without permission prompts, alongside a custom Neo-Brutalist Share Sheet with 6 animated social media dispatch buttons.
4. **Friction & Privacy Intrusion:** Eliminates logins, passwords, tracking cookies, and profile creation. The user opens the app or website and is instantly one tap away from humor.

### Q4: Who is Meme Capsule for?
- **Digital Natives & Group Chat Instigators (Gen Z & Millennials, Ages 18–28):** Users whose primary goal is finding fresh, non-stale memes to share directly into WhatsApp, Telegram, Discord, and Instagram group chats before anyone else sees them.
- **Micro-Break Seekers (Ages 18–35):** Students, commuters, and software engineers who want a quick, punchy 30-second dopamine reset during code builds, transit rides, or study breaks without falling into a 45-minute doomscroll trap.
- **Meme Collectors & Curators:** Users who organize personal collections into categorized, color-coded **Mood Boards** ("Pinned Energy") for situational deployment.
- **Casual Android & Web Users:** Anyone seeking clean, ad-light humor with zero personal data extraction.

### Q5: How does Meme Capsule work?
1. **Public Mobile Flow:**
   - The user opens the app and sees an arcade-inspired neo-brutalist interface with a prominent central button: **HIT ME**.
   - Tapping `HIT ME` pops the next meme instantly from a 7-meme FIFO prefetch buffer while showing an arcade hacker decryption sequence.
   - The meme is presented on an interactive 4-card 3D perspective spring stack (`@react-spring/web` & `@use-gesture/react`). The user can Swipe Right (`keep`), Swipe Left (`skip`), Swipe Up (`save`), Double-Tap (`DANK!` shake + reaction stamp), or Long-Press for 600ms to download to their gallery.
   - Instant-touch overlay buttons (`38px × 38px` Download & Share on top-right, `34px × 34px` Report on bottom-right) and a 4-button CTA bar (**LIKE**, **VAULT**, **PIN**, **SHARE**) provide immediate one-tap utility.
   - Tapping **SHARE** opens the Neo-Brutalist Share Bottom Sheet with live thumbnail preview, an auto-attached promotional message with Google Play Store download link, and 6 animated social media SVG dispatch buttons (WhatsApp, Instagram, Facebook, X, Telegram, Discord).
2. **Public Web Flow (`memecapsule.wtf`):**
   - Visitors explore an authentic live drop preview simulator with a 5-drop quota counter. After 5 drops, a conversion lockout bumper prompts Google Play app installation with UTM campaign tracking.
   - Visitors can tilt 3D interactive phone mockups showcasing real WebP screenshots, open a full-resolution lightbox zoom modal, review technical breakdowns under Section 04.5 "Under the Hood", access the official Press Kit on `/about`, and consult an expanded 15-question FAQ.
3. **Internal Backend Flow:**
   - Unreviewed memes ingested into Cloudflare D1 and R2 storage are assigned `status = 'archived'`, `is_active = 0`, and `curation_status = NULL` (Uncurated Backlog).
   - Human curators review memes in `/curate` using Layer 0 keyboard shortcuts (`K` Keep, `E` Exclude, `D` Duplicate, `L` Review Later).
   - Divergent judge votes surface in the SuperAdmin Command Center. ONLY memes authoritatively resolved as `keep` become `ACTIVE` (`status = 'active'`, `is_active = 1`, `curation_status = 'keep'`) and eligible for public capsule drops; rejected memes are strictly isolated under `curation_status = 'excluded'`.

### Q6: What are all of its major features?
- **Single-Tap Capsule Dispenser:** Discrete random meme delivery with zero feed or scroll.
- **4-Card 3D Perspective Stack:** Spring-physics gesture deck supporting Swipe Left/Right/Up, Double-Tap haptics, and Long-Press downloads.
- **7-Meme FIFO Background Prefetch Buffer:** Maintains 7 preloaded memes in memory for zero loading delay.
- **Hybrid Content Sourcing:** Cloudflare D1/R2 repository alternating every 3rd fetch (`totalMemesViewed % 3 === 0`) with Reddit (`meme-api.com/gimme`), strictly filtered for SFW non-spoiler media.
- **Instant-Touch Overlay Buttons:** `38px × 38px` Download & Share buttons executing on `onPointerDown`/`onTouchStart` with debounce guards to prevent gesture conflicts.
- **Neo-Brutalist Viral Share Bottom Sheet:** Custom bottom sheet featuring live thumbnail preview, auto-attached Play Store download message, 6 animated social media SVG logos, QuickShare, More Options (#FF8C00 native chooser), and clipboard copy.
- **Native MediaStore Downloader:** Custom Java bridge saving memes into `Pictures/Meme Capsule` with zero runtime storage permissions on Android 10+.
- **Targeted Social Share Intent Bridge:** `shareImageToApp()` targeting specific package names with automatic fallback to native chooser.
- **Meme Vault & Mood Boards:** Local offline favorites gallery (free tier limit 20, Pro unlimited) and color-coded themed binders ("Pinned Energy") with synchronized pinboard/favorites storage.
- **Arcade Hacker Decryption Console:** Terminal animations, erratic countdowns, and diagnostic logs (`CHECKING REDDIT RELAY...`, `HARVESTING D1 SHARDS...`).
- **Interactive Web Live Preview:** Web simulator on `memecapsule.wtf` with 5-drop quota counter, automated fallback recovery, and Google Play install bumper.
- **3D Interactive Phone Mockups:** 5 authentic Android app screenshots in modern WebP + JPEG format with mouse-tilt 3D physics and fullscreen lightbox zoom.
- **Kage-Inspired Atmospheric Web UI:** Preloader animation, magnetic circular cursor, GPU-accelerated film grain overlay, vignette shading, and desktop scroll rail.
- **Cyberpunk Acid Glitch Mode:** High-saturation chromatic aberration theme toggle with CRT scanlines.
- **Section 04.5 Under the Hood:** Technical transparency section detailing the 5,000+ meme library, Reddit feed safety mechanics, and zero-tracking privacy architecture.
- **Expanded 15-Question FAQ:** Search-optimized accordion backed by `FAQPage` Schema.org JSON-LD markup.
- **Dedicated About & Press Kit (`/about`):** Entity definition, quick facts grid, one-liner copy kit with copy-to-clipboard buttons, and downloadable brand assets.
- **Google AdMob & AdSense Monetization:** Mobile interstitial ads on natural screen transitions (shifting between Vault, Settings, Mood Boards, Home with 30s cooldown) + rewarded ads for bonus drops; web banner ad unit `meme1` (`slot 6291908699`, `ca-pub-2093403233028868`).
- **Pro Tier In-App Purchase:** One-time upgrade (`remove_ads_forever` via `@capgo/native-purchases`) unlocking Zero Ads, Unlimited Vault, and permanent Triple Drop access.
- **Multi-Judge Consensus & SuperAdmin Arbitration:** Human curation engine (`/curate`) with Layer 0 keyboard navigation and binding consensus arbitration.
- **3-Tier D1 Status Partitioning (Migration 012):** Explicit separation of Active Capsule (111), Superadmin Excluded (53), and Uncurated Backlog (4,947) across database, APIs, and `/admin` UI.
- **Admin Control Panel & SQL Runner (`/admin`):** 5-metric top stats bar, dedicated `[EXCLUDED]` filter tab, R2 binary uploads, R2-to-D1 sync, and analytics recalculation.
- **Token-Gated Safety Moderation (`/reports`):** Ingestion of user-flagged content (`POST /api/report`) with one-click soft-archival and `content_blacklist` enforcement.
- **Multimodal AI Pre-Curator Loop (`/ai-judge`):** Gemini Vision and Python NVIDIA NIM Llama 3.2 11B Vision pipeline categorizing humor mechanisms, topics, and safety.

### Q7: How is it technically built?
- **Mobile Native Wrapper:** Android app built with **Capacitor 8** wrapping a Vite 6 / React 19 SPA, extended with a custom Java native bridge (`MainActivity.java`).
- **Mobile Frontend:** React 19, TypeScript 5.8, Vite 6.2, Tailwind CSS v4 (`@tailwindcss/vite`), `@react-spring/web`, `@use-gesture/react`.
- **Web Platform & Pre-rendering:** React 18, Vite 5, Tailwind CSS v3, React Router DOM v6, static HTML pre-rendering via `vite-plugin-prerender` with deterministic `ReactSSRRenderer` for GitHub Actions CI.
- **Edge Backend:** **Cloudflare Pages Functions** running on V8 isolates with zero cold-start latency (`functions/api/*`, `functions/reports.ts`).
- **Database:** **Cloudflare D1** (serverless SQLite at the edge) with 13 production migrations.
- **Media Storage:** **Cloudflare R2** (S3-compatible object storage with **$0.00 egress fees**).
- **AI Evaluation Pipeline:** Multimodal Gemini Vision (`@google/genai`) on Cloudflare Functions and an offline Python runner executing **NVIDIA NIM Llama 3.2 11B Vision Instruct**.
- **SEO / GEO / AEO:** 4 linked Schema.org JSON-LD entities (`WebSite`, `Organization`, `MobileApplication`, `FAQPage`), `llms.txt` and `llms-full.txt` protocols for frontier AI crawlers, and XML Sitemap.

### Q8: How does its backend work?
The backend is completely serverless. When a client calls `GET /api/random-meme`, a Cloudflare Pages Function queries Cloudflare D1 with an inner join on `meme_curation_final`:
```sql
SELECT m.* FROM memes m
INNER JOIN meme_curation_final f ON m.id = f.meme_id
WHERE m.is_active = 1 AND m.status = 'active' AND f.corpus_status = 'keep' AND m.random_key >= ?
ORDER BY m.random_key ASC LIMIT 1;
```
Any meme that is unfinalized, in judging, or excluded is mathematically impossible to retrieve via `/api/random-meme` or `/api/daily-meme`. Media assets are served directly from Cloudflare R2 via an edge CDN URL with global caching and zero egress charges.

### Q9: How does its AI system work?
- **Public Product:** **ZERO AI RECOMMENDATION ALGORITHMS.** Content delivery is randomized serendipity.
- **Internal Backend Pipeline:**
  1. Multimodal Gemini Vision (`gemini-1.5-flash`) powers `/api/ai-judge/classify.ts` for rapid in-dashboard pre-evaluation.
  2. An asynchronous Python pipeline (`categorise.py`) inspects raw memes in R2 using **NVIDIA NIM (Llama 3.2 11B Vision Instruct)**. It performs multimodal OCR, evaluates humor mechanisms (irony, absurdity, relatability), assigns topics and tone, flags NSFW or low-effort content, and outputs structured metadata that populates D1 for human superadmin approval.

### Q10: What makes the application different?
1. **Discrete Consumption vs. Infinite Loop:** One button and one capsule at a time. The deliberate absence of a feed forces focus onto a single punchline and gives users total control over their time.
2. **Neo-Brutalist Arcade Visuals:** Pitch-dark `#131313` background, high-voltage purple (`#9b30ff`), arcade gold (`#f4c300`), hot magenta pink (`#dd0061`), 2-4px solid black borders, and hard geometric offset drop shadows.
3. **Lossless Native Android Integration:** Custom Java bridge to `MediaStore` saving memes directly into `Pictures/Meme Capsule` without browser download prompts or watermarks, plus targeted intent sharing to WhatsApp, Instagram, Telegram, and Discord.
4. **Radical Technical Transparency:** Explains exactly how memes are fetched, curated, and stored directly on the website with zero corporate obfuscation.
5. **Zero-Account Privacy:** No user accounts, passwords, or tracking cookies.

---

## 2. EXECUTIVE SYSTEM SUMMARY: THREE DISTINCT CODEBASES

### 2.1 Collaborative Development & Engineering Division

Meme Capsule is a three-person collaborative project with a clear division of architectural, consumer-facing, and marketing responsibilities:

- **Anmol Verma** (Lead Backend Developer — GitHub: [`editorav010-dev`](https://github.com/editorav010-dev)):
  - Full backend engineering & Cloudflare Pages Functions serverless architecture
  - Backend architecture and systems implementation
  - Core algorithms: randomization, deduplication, 3-tier curation status partitioning, and edge ranking
  - Application logic, workflows, multi-judge consensus, and SuperAdmin arbitration systems
  - AI tools implementation: Gemini Vision pipeline and NVIDIA NIM Llama 3.2 Vision pre-curation runner
  - Security, privacy architecture, token-gated auth, and SHA-256 session management
  - Admin, SuperAdmin, and all internal backend workbenches (/admin, /curate, /categorise, /reports, /ai-judge)
  - The underlying technical and mathematical logic behind the Meme Capsule delivery engine

- **Pratham Pandey** (Lead Frontend Developer & Original Ideator — GitHub: [`bbethical010-glitch`](https://github.com/bbethical010-glitch)):
  - **Original concept, initial vision, and founding idea behind Meme Capsule**
  - Frontend landing pages and promotional web platform (memecapsule.wtf)
  - Public Android mobile application development (`com.meme.capsule` via Capacitor 8, React 19, Tailwind CSS v4)
  - App theme, typography, visual identity, and implementing new UI/UX elements across consumer-facing surfaces
  - Client-side API call integrations and frontend request handling
  - Java Android bridge (`MainActivity.java`) and Android MediaStore integrations
  - Consumer-facing frontend engineering, animations, and client build setup

- **Faraz Ahmed** (Social Media & Marketing Lead):
  - Management of all official Meme Capsule social media handles
  - Content planning, niche analysis, and editorial quality control of all social content
  - Scripting, brand voice, and campaign copywriting
  - Marketing strategy, audience growth, and platform-specific distribution
  - **Official Handles Managed:**
    - Instagram: https://www.instagram.com/capsule.meme/
    - X: https://x.com/memecapsule_
    - Threads: https://www.threads.com/@capsule.meme

**Official App Email (User Support & Marketing):** `support@memecapsule.wtf`  
*(This is the app's public-facing contact email — not a personal developer address.)*

### 2.2 The Three Decoupled Codebases

The Meme Capsule engineering ecosystem is organized into **three distinct, decoupled codebases**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  MEME CAPSULE ECOSYSTEM                                │
│                               One Tap. One Meme. Zero Fluff.                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│  1. PUBLIC MOBILE APP (APK)   │ │ 2. PROMO & PRESS WEB PLATFORM │ │ 3. SERVERLESS EDGE & BACKEND  │
│  Package: com.meme.capsule    │ │ Domain: memecapsule.wtf       │ │ Domain: meme-capsule-eww.     │
│  Tech: Capacitor 8, React 19, │ │ Tech: React 18, Vite 5,       │ │         pages.dev             │
│        Tailwind CSS v4, Java  │ │        Tailwind v3, SSR-Prerender│ Tech: Cloudflare Pages, D1 SQL,│
│  Target: Android Google Play  │ │ Target: Desktop/Mobile Web    │ │        R2 CDN, React 19 Tools │
│  Version: v2.7 (code 18)      │ │ Focus: Conversion & Press Kit │ │ Target: Curators, Admins, API │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
```

1. **Public Android Mobile Application (`com.meme.capsule`):**
   - Companion repository containing the mobile client.
   - Built with Capacitor 8, React 19, Vite 6, Tailwind CSS v4, and custom Java bridges (`MainActivity.java`).
   - Focus: 4-card 3D perspective spring stack, 7-meme FIFO prefetch buffer, instant-touch overlay buttons, Neo-Brutalist Share Sheet with 6 animated social SVGs, MediaStore native downloads, local Meme Vault, Mood Boards, AdMob, and Google Play In-App Purchases.
2. **Promotional, Press & Web Platform (`memecapsule.wtf`):**
   - Multi-page web repository deployed on GitHub Pages with custom domain DNS routing.
   - Built with React 18, Vite 5, Tailwind CSS v3, and static HTML prerendering via `vite-plugin-prerender`.
   - Focus: Live interactive drop preview simulator (5-drop quota + lockout bumper), 3D phone mockups with authentic WebP screenshots and lightbox zoom, Kage-inspired atmospheric UI, Section 04.5 Under the Hood, `/about` Press Kit, 15-question accordion FAQ, Formspree contact form, and Google AdSense monetization (`meme1`).
3. **Serverless Edge Backend, Database & Internal Workbenches (This Repository):**
   - Deployed on Cloudflare Pages (`https://meme-capsule-eww.pages.dev`).
   - Built with Cloudflare Pages Functions, Cloudflare D1 (SQLite), Cloudflare R2 (media bucket), and internal React 19 Neo-Brutalist workbenches.
   - Focus: High-throughput edge APIs (`/api/random-meme`, `/api/daily-meme`), 3-tier status partitioning (Migration 012), multi-judge consensus curation (`/curate`), SuperAdmin arbitration, admin database synchronization and SQL runner (`/admin`), token-gated content moderation (`/reports`), and multimodal AI pre-judging (`/ai-judge`).

---

## 3. PART A: PUBLIC MOBILE APPLICATION (`com.meme.capsule`)

### 3.1 Product Identity, Philosophy & Vision
The mobile app rejects infinite feed algorithms. It is designed as an **Arcade Vending Machine for Internet Humor**:
- **One Interaction:** Tapping `HIT ME` dispenses one curated meme.
- **Finite Gratification:** Enjoy a discrete laugh, react, share, and exit.
- **Anti-Algorithm:** Random serendipity replaces recommendation algorithms.
- **Privacy by Default:** Zero tracking, zero profiles, zero mandatory accounts.

### 3.2 Target Users, Personas & Core Scenarios
1. **The Group Chat Instigator (18–28 yrs):** Needs fresh meme ammunition for WhatsApp, Telegram, Discord, or Instagram group chats. Uses instant-touch buttons, auto-attached Play Store share links, and native targeted social sharing.
2. **The Micro-Breaker (18–35 yrs):** Takes a 30-second break between tasks. Opens Meme Capsule, pops 3 capsules, laughs, and locks the phone.
3. **The Meme Collector:** Organizes top gems into themed Mood Boards ("Tech Pain", "Workplace Chaos") for quick situational replies.

### 3.3 Complete End-User Feature Inventory (v2.7 / VersionCode 18)

| Feature Category | Feature | Implementation Component | Technical Description & Behavior |
| :--- | :--- | :--- | :--- |
| **Core Dispenser** | **Hero Landing (`HIT ME`)** | `src/App.tsx` | Dominant Neo-Brutalist `HIT ME` button with pulsing glow aura, compact secondary actions (`BONUS DROP` & `TRIPLE DROP`), and header Streak & Settings shortcut badges. |
| **Feed Pipeline** | **7-Meme FIFO Prefetch Buffer** | `src/App.tsx` | Maintains an in-memory queue of 7 preloaded memes (`PIPELINE_TARGET_SIZE = 7`) for instant card swiping with zero delay. |
| **Feed Sourcing** | **Hybrid D1/R2 + SFW Reddit** | `src/App.tsx` | Fetches curated memes from Cloudflare D1/R2 (`/api/random-meme`) and alternates every 3rd fetch (`totalMemesViewed % 3 === 0`) with Reddit (`meme-api.com/gimme`), strictly dropping NSFW and spoilers. |
| **Card Deck** | **4-Card 3D Perspective Stack** | `src/components/MemeStack.tsx` & `MemeCard.tsx` | Spring-physics 4-card stack powered by `@react-spring/web` and `@use-gesture/react`. Supports Swipe Right (`keep`), Swipe Left (`skip`), Swipe Up (`save`), Double-Tap (`DANK!` shake), and Long-Press (600ms gallery download). |
| **Card Overlay** | **Instant-Touch Overlay Buttons** | `src/components/MemeCard.tsx` | Top-right `38px × 38px` Download & Share buttons executing on `onPointerDown`/`onTouchStart` with debounce timestamp guard and `pointer-events-none` on SVG icons; bottom-right `34px × 34px` Report button. |
| **Card Actions** | **4-Button Neo-Brutalist CTA Bar** | `src/App.tsx` | Main action bar below card: **LIKE**, **VAULT**, **PIN**, and **SHARE**. |
| **Viral Sharing** | **Neo-Brutalist Share Bottom Sheet** | `src/ShareModal.tsx` & `MainActivity.java` | Custom bottom sheet with live thumbnail preview (`PAYLOAD ATTACHED`), **Auto-Attached Promotional Message** with Google Play link, **6 Animated Social Media SVG Logos**, **`QUICKSHARE`**, **`MORE OPTIONS`** (#FF8C00 native chooser), and **`COPY TO CLIPBOARD`**. |
| **Native Storage** | **Scoped MediaStore Image Saving** | `MainActivity.java` | Streams media directly to `Pictures/Meme Capsule` via Android 10+ `MediaStore.Images.Media` (`IS_PENDING` atomic write, zero runtime permissions). |
| **Targeted Sharing** | **Direct Social Intent Bridge** | `MainActivity.java` | `shareImageToApp()` targets specific package names (WhatsApp, Instagram, Facebook, X, Telegram, Discord) with automatic fallback to `Intent.createChooser`. |
| **Collections** | **Meme Vault (Favorites)** | `src/App.tsx` | Searchable local gallery of saved memes with viewed/fetched/liked counters. Free tier limit: 20 memes (`FREE_VAULT_LIMIT = 20`); Pro tier: unlimited. |
| **Themed Binders** | **Mood Boards ("Pinned Energy")** | `src/App.tsx`, `CreateBoardModal.tsx`, `UnpinModal.tsx` | Custom color-coded mood boards (`primary`, `secondary`, `tertiary`) with synchronized `meme_pinboard` + `meme_favorites` storage for reliable thumbnail rendering. |
| **Settings & Privacy** | **Settings & Legal Page** | `src/App.tsx` (`activeTab === 'settings'`) | 4th bottom navigation tab & header gear shortcut consolidating **Direct Privacy Policy Link (`https://memecapsule.wtf/privacy`)**, **Website CTA Button (`https://memecapsule.wtf`)**, **Official Support Email (`support@memecapsule.wtf`)** (creator name and social handles removed from UI), **Verified 18+ Age Badge**, **Play Store Rating Trigger**, **Local Device Footprint KPIs**, **Clear Past Viewing History & Stats**, **Empty Vault & Mood Boards**, **Unblock Reported Memes**, **Delete All App History & Data** (2-step confirmation), **Capsule Feed Toggles**, **Store & Theme Equipper**, and **Replay Gesture Tour**. |
| **Age Verification** | **First-Launch Date of Birth Gate (18+)** | `src/components/DateOfBirthModal.tsx` | Non-bypassable mandatory modal (`z-[2000]`) presented immediately **after the Onboarding Guide** on first app launch before entering the deck. DD/MM/YYYY numeric inputs + native DatePicker, strict 18+ age validation, locked to `localStorage('meme_capsule_user_dob')`. |
| **Play Store Rating** | **In-App Rating & Review Engine** | `src/components/RatingModal.tsx` & `src/App.tsx` | Neo-Brutalist 5-star reaction popup (`GOD-TIER DANKNESS!`, `CERTIFIED BANGERS!`) triggered after viewed meme intervals. Redirects to Google Play Store listing (`market://details?id=com.meme.capsule` / `openPlayStoreListing`), provides **24-hour snooze deferral**, and permanently suppresses once submitted. |
| **Safety & UGC** | **Content Reporting & Blocklist** | `src/ReportModal.tsx` & `src/App.tsx` | Store-compliant reporting modal (`POST /api/report`). Reported memes are written to `localStorage('reported_memes')` and permanently filtered out of rotation. |
| **Monetization & Store** | **In-App Capsule Store & AdMob** | `src/components/store/`, `billing.ts`, `entitlements.ts` | Clash of Clans horizontal snap-scrolling store (`snap-x snap-mandatory`), sticky category tabs, 11 single unlocks + 5 bundles, live dynamic savings badges, 8s theme preview, celebratory slam animation, and **QA Testing Mode** (fallback reference pricing, simulated test purchase, and 1-tap entitlement reset). Non-intrusive AdMob interstitial shown on screen shifts between Vault, Settings, Mood Boards, and Home with a 30s frequency cooldown (zero ad interruptions during meme scrolling; suppressed permanently if `hasAdsRemoved()`). |

### 3.4 Card Deck, Gestures & Instant-Touch Overlay Architecture
The card deck is orchestrated by `MemeStack.tsx` using `@react-spring/web` and `@use-gesture/react`:
- **3D Perspective Deck:** Renders up to 4 stacked cards with dynamic scale, z-index, and perspective offsets.
- **Swipe Gestures:**
  - *Swipe Right:* Casts a `keep` vote and triggers the next card.
  - *Swipe Left:* Casts a `skip` vote.
  - *Swipe Up:* Saves the meme directly to the user's Meme Vault.
- **Double-Tap Reaction:** Double-tapping anywhere on the active card triggers a haptic recoil shake (`.animate-shake`) and stamps a visual reaction tag (`DANK!`, `CRINGE!`, `SO REAL`).
- **600ms Long-Press:** Holding down on the card executes a direct gallery download via the native Java bridge.
- **Instant-Touch Overlay Buttons (`MemeCard.tsx`):**
  - Because `MemeStack` attaches gesture handlers to the card with `touch-action: none`, standard click events can be swallowed during drag initiation.
  - The top-right `38px × 38px` Download & Share buttons and the bottom-right `34px × 34px` Report button execute on `onPointerDown` / `onTouchStart` with a `useRef` timestamp guard (250ms debounce) and `pointer-events-none` on inner SVG icons so touches register on the very first contact.

### 3.5 Neo-Brutalist Viral Share Bottom Sheet & Social Dispatch System
When the user taps Share (from the card overlay, bottom CTA bar, Meme Vault, or Mood Boards), the app opens `ShareModal.tsx`:
1. **Payload & Promotional Message Preview:**
   - Displays a live meme thumbnail, `1 Image + Invite Link` tag, `HD` stamp, and a dedicated preview box showing the exact message and Play Store link:
     ```text
     💊 Caught this wild drop on MEME CAPSULE! 🔥
     "<Meme Title>"

     📲 Download Meme Capsule on Google Play:
     https://play.google.com/store/apps/details?id=com.meme.capsule
     ```
2. **6 Animated Social Media Dispatch Buttons (`QUICK DISPATCH`):**
   - **WhatsApp** (`com.whatsapp`) — Animated ringing/pulsing SVG logo (`mc-anim-whatsapp`).
   - **Instagram** (`com.instagram.android`) — Animated rotating/glowing camera SVG logo (`mc-anim-insta`).
   - **Facebook** (`com.facebook.katana`) — Animated floating emblem SVG logo (`mc-anim-fb`).
   - **X (Twitter)** (`com.twitter.android`) — Animated kinetic slash SVG logo (`mc-anim-x`).
   - **Telegram** (`org.telegram.messenger`) — Animated soaring paper-plane SVG logo (`mc-anim-tg`).
   - **Discord** (`com.discord`) — Animated wobbling Clyde controller SVG logo (`mc-anim-discord`).
3. **QuickShare & More Options (`MORE OPTIONS`):**
   - Features a prominent `#FF8C00` tangerine button with an animated dots icon that immediately opens the native Android system share sheet (`Intent.createChooser`).
4. **Copy to Clipboard:**
   - Copies the promotional text, Play Store link, and image URL to the clipboard with tactile visual confirmation (`COPIED TO CLIPBOARD! ⚡`).

### 3.6 Native Android Bridge & Scoped MediaStore Storage (`MainActivity.java`)
Registered on the Android WebView as `window.MemeCapsuleAndroid`:
- **`downloadImage(String url, String fileName)`**:
  - Streams the image on a background thread into `Pictures/Meme Capsule` via Android 10+ `MediaStore.Images.Media` (`IS_PENDING` atomic write), eliminating the need for legacy storage permissions on modern Android devices.
- **`shareImage(String url, String fileName, String title)`**:
  - Formats `title` using `buildShareMessage(title)` so the Play Store link is always included, caches the image in `getCacheDir()/shared_images/` via `FileProvider`, and opens the native share chooser.
- **`shareImageToApp(String url, String fileName, String shareText, String targetPackage)`**:
  - Downloads the meme image into `FileProvider` cache (`content://com.meme.capsule.fileprovider/...`), attaches both `Intent.EXTRA_STREAM` (image URI + `ClipData`) and `Intent.EXTRA_TEXT` (promotional message + Play Store link).
  - Attempts to launch the target app directly via `targetedIntent.setPackage(targetPackage)`. If the target app is not installed on the device, it seamlessly falls back to `Intent.createChooser` so sharing never fails.
  - Supported package queries are declared in `AndroidManifest.xml` (`<queries>` for WhatsApp, Instagram, Facebook, Twitter, Telegram, Discord).

### 3.7 Meme Vault, Mood Boards ("Pinned Energy") & Offline Collections
- **Meme Vault:** Persistent offline favorites list stored in `localStorage('meme_favorites')` with instant client-side search. Free tier users can save up to 20 memes (`FREE_VAULT_LIMIT = 20`); Pro users have unlimited storage.
- **Mood Boards ("Pinned Energy"):** Color-coded thematic binders (`primary`, `secondary`, `tertiary`) created via `CreateBoardModal.tsx`.
- **Pinboard Synchronization:** When a meme is pinned to a board, the system synchronizes both `meme_pinboard` and `meme_favorites` records to guarantee that pinned meme thumbnails always render reliably even if the meme was not previously saved to the main vault.

### 3.8 Mobile Monetization (AdMob + Google Play In-App Purchases & Neo-Brutalist Store)
- **Google AdMob:**
  - Non-intrusive full-screen interstitial ad displayed when shifting between different app screens (Vault, Settings, Mood Boards, and Home) with a 30-second cooldown via `@capacitor-community/admob` (purged from middle-of-meme scrolling for uninterrupted viewing flow). Suppressed permanently if `hasAdsRemoved()` or during active ad-free reward windows.
  - Rewarded ads allow users to unlock optional bonus drops or temporary +1 session Mood Board slots. Rewarded ads remain fully optional even for users who purchased No Ads.
- **Neo-Brutalist In-App Capsule Store (`src/components/store/`):**
  - Full-screen game-style overlay opened via `openStore({ focus?: ProductId })`.
  - **Streamlined 3-Pack Neo-Brutalist Vertical Layout (`StoreScreen.tsx`):**
    - Streamlined store presentation replacing earlier multi-category horizontal carousels with a high-conversion, compact vertical deck. Eliminates excessive negative space by employing full-width (`w-full`), compact cards (~150px height) styled with bold borders and Neo-Brutalist drop shadows.
    - Offers exactly 3 focused packs:
      1. **COMBO PACK (`meme_capsule_pro` - ₹199):** Flagship value bundle granting both No Ads and Unlimited Mood Boards. Highlights "BEST VALUE" and "SAVE 20%" badges with gold drop shadow styling.
      2. **REMOVE ADS (`remove_ads_forever` - ₹199):** Permanent pass stripping all screen-transition interstitials across Vault, Settings, and Boards.
      3. **UNLIMITED MOOD BOARDS (`unlimited_mood_boards` - ₹49):** Permanent creator pass removing the 3-board limit.
  - **Production Google Play Billing Mode:**
    - Live purchase flows route exclusively through `@capgo/native-purchases` Google Play Billing sheet.
    - All testing toggles and simulated unlock strips are purged from the production Store UI.
    - Reference pricing fallback (`FALLBACK_PRODUCTS` in `billing.ts`): ensures prices are always formatted and displayed (`₹199`, `₹49`, etc.) while mapping live Play Console products to enforce the app's official catalog pricing.
    - Rewarded ad fallback in `App.tsx`: ensures testing the free Mood Board +1 session slot works reliably even if native AdMob test video fill is unavailable.
  - **Catalog (`src/monetization/catalog.ts`):** Single source of truth containing the 3 active store packs: `remove_ads_forever` (REMOVE ADS - ₹199), `unlimited_mood_boards` (UNLIMITED MOOD BOARDS - ₹49), and `meme_capsule_pro` (COMBO PACK - ₹199), preserving underlying type safety for legacy/future expansion.
  - **Billing Engine (`@capgo/native-purchases` v8.8.1):**
    - Displays live formatted prices from Google Play (`priceString`) with catalog reference fallback (`FALLBACK_PRODUCTS`) on test builds.
    - Live savings badge computed dynamically: `1 - (bundlePrice / sum(componentPrices))`. Hidden if any component price is missing.
    - Automatic purchase acknowledgement for all one-time non-consumable products to prevent Google Play 3-day refunds.
    - Silent cancellation handling (zero intrusive error toasts on cancel).
    - Pending payment tracking (UPI/cash delays show `PAYMENT PENDING` and reconcile on app resume / foreground).
    - `restorePurchases()` re-queries Google Play INAPP purchases directly with `PURCHASES RESTORED` or `NOTHING TO RESTORE` toasts.
  - **Entitlements System (`src/monetization/entitlements.ts`):**
    - Single source of truth: `useEntitlements()` hook backed by `EntitlementsContext` and cached in `localStorage`.
    - Union-based grants model: owning a bundle automatically expands to grant all component product IDs and entitlement keys.
    - Direct grant/revoke/reset helpers: `grantProductDirectly`, `revokeProductDirectly`, `resetAllEntitlements` for seamless QA toggling.
    - Offline resilience: persists last verified ownership snapshot; only revokes if an online Play query confirms refund/revocation.
    - Auto-reverts equipped cosmetics (themes, FX) to classic defaults if access is revoked.
  - **Interactive Features:**
    - 8-second temporary theme preview with countdown banner and auto-revert.
    - Neo-Brutalist celebratory slam animation (`PurchaseCelebration.tsx`) on purchase confirmation.
    - Honest bundle partial ownership warnings: "YOU ALREADY OWN N OF M ITEMS".
    - 4 selectable Arcade FX styles: Classic, Retro Slam, Neon Glitch, Cassette Pop.

### 3.9 App Experience, Segmented Settings & Landing Page Architecture
- **Restructured 3-Tab Settings Panel (`App.tsx`):**
  - Replaces the previous 1500px vertical scroll container with a 3-tab segmented control (`[⚡ EXPERIENCE]`, `[👑 MEMBERSHIP]`, `[🛡️ PRIVACY & DATA]`) to eliminate clutter and provide instant navigation without scrolling.
  - **Experience Tab:** Hybrid Reddit relay stream toggle, 7-meme turbo prefetch buffer toggle, card recoil & shake toggle, 4 arcade FX pills, and app color themes (`ThemePicker`).
  - **Membership Tab:** Capsule Store hero CTA, Restore Purchases button, Google Play rating modal trigger, gesture tour replay, and live entitlement status.
  - **Privacy & Data Tab:** Local device footprint counters, granular erasure (Clear Viewing History, Empty Vault & Mood Boards, Unblock Reported Memes, Master Wipe), Age Verification (DOB) locked badge, official Privacy Policy & Terms link, and build version.
- **Landing Page Header & Dynamic Dismissal:**
  - Displays a dedicated Neo-Brutalist top header on the initial landing screen (`activeTab === 'home' && screen === 'waiting'`) featuring Settings quick-access, centered branding, and Store CTA.
  - Automatically unmounts and disappears the moment the user taps "HIT ME", giving the 4-card perspective deck 100% full-screen immersive view.
  - Temporary category filters removed from the landing page pending backend category endpoint rollout.

### 3.10 Mobile Safety, Age Verification (DOB) & Content Reporting
- **First-Launch Date of Birth (DOB) Verification Modal (`DateOfBirthModal.tsx`):**
  - Integrated into the app flow and presented immediately **after the Onboarding Guide** on first download/install before entering the main card deck.
  - Mandatory full-screen modal (`z-[2000]`) non-bypassable: cannot be closed, skipped, or dismissed via backdrop click, Escape key, or Android hardware back navigation.
  - Auto-advancing Neo-Brutalist DD / MM / YYYY numerical inputs with numeric keypad, coupled with an optional native Android DatePicker calendar dialog.
  - Strict 18+ age validation: users under 18 years of age are blocked from entering.
  - Single-entry locked: once submitted, the DOB is saved to `localStorage('meme_capsule_user_dob')` alongside `meme_capsule_dob_confirmed_at` and can never be re-input or edited.
  - Displayed as a verified, locked badge in App Settings under "PRIVACY, LEGAL & ABOUT".
  - Canonical initial onboarding sequence: `Privacy Policy Consent -> Onboarding Guide -> Date of Birth Modal (18+) -> Main Home Deck`.
- **Reporting Modal (`ReportModal.tsx`):** Users can report inappropriate content (`NSFW`, `Hate Speech`, `Harassment`, `Copyright`).
- **Immediate Local Suppression:** Submitting a report triggers `POST /api/report` to Cloudflare Pages and immediately adds the meme ID to `localStorage('reported_memes')`. The client filtering loop (`fetchValidMeme()`) permanently drops reported memes from subsequent card drops.

### 3.11 Google Play Store In-App Rating & Review Engine (`RatingModal.tsx`)
To drive organic Google Play Store reviews while honoring the app's Neo-Brutalist design language and respectful UX philosophy:
- **Eligibility & Periodic Trigger Logic (`checkRatingPromptEligibility` in `src/App.tsx`):**
  - Evaluated on card deck transitions (`totalMemesViewed`).
  - **Suppression Gates:** Suppressed permanently if feedback was already registered (`localStorage('meme_capsule_rating_completed') === 'true'`).
  - **Active Session Safety:** Never opens while other modals are active (Onboarding, DOB gate, Report modal, Unpin dialog, Mood board composer, Store overlay, or active Rewarded Ad).
  - **Snooze Check:** Suppressed if the user deferred within the past 24 hours (`localStorage('meme_capsule_rating_deferred_until') > Date.now()`).
  - Triggers after an initial viewing threshold (e.g. 15 memes) and periodically re-checks at spaced intervals.
- **Neo-Brutalist Visual Design:**
  - Strict palette adherence: background `#1c1b1b` / `#131313`, gold border `#f4c300`, solid offset shadow (`shadow-[8px_8px_0px_0px_#f4c300]`), zero border radius, Anton & Oswald typography.
  - Interactive 5-star reaction selector with dynamic feedback badges:
    - 5 Stars: `GOD-TIER DANKNESS! 🔥` (`#FACC15`)
    - 4 Stars: `CERTIFIED BANGERS! ⚡` (`#00E5FF`)
    - 3 Stars: `SOLID CHUCKLES 👌` (`#34C759`)
    - 2 Stars: `NEEDS MORE SPICE 🫠` (`#FF9800`)
    - 1 Star: `MID CORP SLOP 💀` (`#FF3B30`)
- **Direct Play Store Dispatch (`redirectToPlayStore`):**
  - First attempts to call the native Java bridge: `window.MemeCapsuleAndroid.openPlayStoreListing()`.
  - Automatically falls back to opening `https://play.google.com/store/apps/details?id=com.meme.capsule` via `window.open` with `noopener,noreferrer`.
- **24-Hour Snooze Deferral:**
  - Clicking `[X]` or `SNOOZE 24H (REMIND ME LATER)` invokes `handleDeferRating()`, setting `meme_capsule_rating_deferred_until = Date.now() + 86400000` and displaying a Neo-Brutalist confirmation toast (`RATING SNOOZED FOR 24 HOURS ⏰`).
- **Permanent Dismissal:**
  - Once the user rates the app or registers feedback, `meme_capsule_rating_completed` is set to `'true'` in `localStorage`. The rating prompt will NEVER display automatically again.
- **On-Demand Settings Action:**
  - Users can manually access the rating modal at any time via the "RATE ON PLAY STORE" button on the Settings screen.

### 3.12 Critical Engineering Guardrails & Styling Gotchas (Tailwind v4)
1. **Tailwind CSS v4 `@theme` Spacing Token Gotcha (`src/index.css`):**
   - `src/index.css` defines custom spacing tokens (`--spacing-xs: 8px`, `--spacing-sm: 16px`, `--spacing-md: 24px`, `--spacing-lg: 40px`, `--spacing-xl: 64px`).
   - In Tailwind CSS v4, utility classes like `max-w-md` or `max-w-sm` resolve to `var(--spacing-md)` (`24px`) and `var(--spacing-sm)` (`16px`).
   - **MANDATORY RULE:** Always use explicit pixel values (e.g., `max-w-[460px]`, `max-w-[500px]`, or inline `style={{ width: '100%', maxWidth: '460px' }}`) for modal and container widths rather than `max-w-md` or `max-w-sm`.
2. **Touch Events in Draggable Cards:** Always use `onPointerDown`/`onTouchStart` with debounce timestamp guards and `pointer-events-none` on SVG icons for overlay action buttons.
3. **Android Build Commands:** Run `npm run lint` (`tsc --noEmit`), then `npm run build:android`, followed by `cd android && ./gradlew assembleDebug`.

---

## 4. PART B: PROMOTIONAL, PRESS & WEB PLATFORM (`memecapsule.wtf`)

### 4.1 Platform Architecture, Modernized Stack & Static HTML Prerendering
- **Hosting & Domain:** Deployed on GitHub Pages (`bbethical010-glitch.github.io`) with custom domain DNS routing to `https://memecapsule.wtf`.
- **Modernized Tech Stack:** 
  - React 19 (`^19.2.8`) & React DOM 19 (`^19.2.8`)
  - Vite 8 (`^8.2.0`) with build target set to `es2019` for broad device compatibility
  - React Router DOM v7 (`^7.18.2`)
  - Motion v13 (`^13.4.0`) for fluid micro-interactions
  - Tailwind CSS v3.4 (`^3.4.19`) with PostCSS & Autoprefixer
  - TypeScript 6 (`~6.0.2`) with strict type checking
- **Deterministic Static Prerendering (`ReactSSRRenderer`):** 
  Uses `vite-plugin-prerender` with an in-process headless `ReactSSRRenderer` (leveraging `react-dom/server` and `react-router-dom/server`'s `StaticRouter`) to produce fully-baked, SEO-ready static HTML files for all 8 active public routes (`/`, `/about`, `/team`, `/faq`, `/how-it-works`, `/privacy`, `/terms`, `/guidelines`). (Note: `/editorial` is preserved in draft status and excluded from active prerender routes).
- **Dynamic Route-Specific SEO Metadata Injection:** 
  During build-time prerendering, `ReactSSRRenderer` reads route configurations (`ROUTE_SEO`) and surgically injects route-specific `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph tags (`og:title`, `og:description`, `og:url`), and Twitter card metadata directly into each route's generated `index.html`. This ensures 100% crawl fidelity without relying on JavaScript hydration or client-side redirects (`404.html`).

### 4.2 Interactive Live Drop Preview Simulator & Quota Lockout Bumper
Located in `src/components/MemePreview.tsx`:
- **Functional Simulator:** Connects directly to the live Cloudflare edge API (`GET /api/random-meme`) with an automated fallback recovery pool (`FALLBACK_MEMES`).
- **5-Drop Quota Counter:** Users can experience 5 authentic live drops on the web (`5 -> 4 -> 3 -> 2 -> 1 -> 0`).
- **Conversion Lockout Bumper:** Upon opening the 5th capsule, a Neo-Brutalist lockout bumper covers the card:
  - Header: `CAPSULE DEPLETED`
  - Body: Encourages installing the Android app for unlimited daily drops with rolling prefetch.
  - CTA Button: Direct Google Play install button with UTM campaign attribution (`getPlayStoreUrl('web_preview_bumper')`).

### 4.3 Interactive Device Mockups, Flagship Hero Phone & Zero-Lag Architecture
- **Flagship Hero Phone Mockup (`src/components/HeroPhoneMockup.tsx` — DRAFT STATUS):**
  > **STATUS: DRAFT / INACTIVE (Preserved in Codebase, Decoupled from Live Hero)**  
  > *Context & Decision:* Implemented in commit `12f001a` as a flagship interactive phone frame showcasing real Android captures. To streamline the landing hero experience and eliminate competing visual distractions above the fold, it has been decoupled from `src/components/Hero.tsx`. The full component code, tilt mathematics, and carousel mechanics are 100% preserved in `src/components/HeroPhoneMockup.tsx` as a draft module.  
  > *Reactivation:* To restore, simply uncomment `import { HeroPhoneMockup } from './HeroPhoneMockup'` and `<HeroPhoneMockup />` in `src/components/Hero.tsx`.
  - **Component Specifications (Preserved):**
    - **Hardware Chassis:** High-fidelity obsidian Android chassis with 52px corner radius, Dynamic Island notch with camera lens aperture, hardware button cutouts, and diagonal specular glass sheen.
    - **Atmospheric Violet Bleed Glow:** Soft radial gradient (`rgba(155, 48, 255, 0.45)`) with an ambient pulse animation (`animate-glow-pulse`) bleeding into the background canvas.
    - **Floating Elevation Shadow:** Layered spread elevation shadow (`0 25px 70px -15px rgba(0, 0, 0, 0.9), 0 9px 46px 0px rgba(155, 48, 255, 0.32)`) with subtle floating keyframe physics (`animate-mockup-float`).
    - **Authentic App Screen Carousel:** Auto-cycling showcase cycling through authentic WebP captures (Home Drop, Meme Loaded, Liked Reaction, Offline Vault, Mood Boards) with pause-on-hover, direct switcher chips (`01` through `05`), and play/pause controls.
    - **Zero-Lag RAF Parallax Tilt:** Compositor-driven `requestAnimationFrame` lerp loop manipulating `mockupRef.current.style.transform` directly, generating buttery smooth 60fps/120fps 3D mouse parallax with zero React re-renders on mousemove.
- **Screenshot Carousel & Lightbox (`src/components/Screenshots.tsx`):**
  - **9 Authentic Android App Screenshots:** High-density WebP + JPEG captures of the actual Android app.
  - **Zero-Lag Direct DOM Tilt:** Optimized `PhoneMockup` to update transform via DOM ref directly rather than triggering component state updates on every mousemove, ensuring zero lag, zero frame drops, and rapid responsiveness across all devices.
  - **Fullscreen Lightbox Zoom:** Clicking any mockup opens a fullscreen lightbox zoom modal with keyboard arrow navigation, escape-key dismiss, and backdrop blur.

### 4.4 Kage-Inspired Atmospheric Web UI
- **Preloader (`Preloader.tsx`):** Animated entrance splash screen displaying the official brand emblem and `.pre-bar` progress bar.
- **Custom Magnetic Cursor (`CustomCursor.tsx`):** Fluid circular cursor (`.cur-dot`) with magnetic hover expansion (`.cur-dot.act`) over interactive elements.
- **Film Grain & Vignette (`GrainOverlay.tsx` & `Vignette.tsx`):** GPU-accelerated CRT arcade grain texture optimized for smooth Interaction to Next Paint (INP) with automatic disabling for users with `prefers-reduced-motion`.
- **Desktop Scroll Rail (`ScrollRail.tsx`):** Fixed vertical navigation indicator reflecting active page sections.

### 4.5 Complete Removal of Acid Glitch UI Mode
- **Navigation Cleanup (`Navbar.tsx`):** Completely removed the desktop and mobile Acid Glitch toggle buttons, `Zap` icon, and state management (`isGlitch`, `toggleGlitch`).
- **CSS Purge (`src/index.css`):** Purged all acid scanline overlays, 115° hue rotation filters, and keyframe skew animations (`html.theme-glitch`, `glitch-anim`, `@keyframes scanlines`) to eliminate visual clutter and ensure a focused, high-contrast Neo-Brutalist presentation.
- **Client Cache Sanitation:** Automatically clears any legacy `theme-glitch` entries from client `localStorage` and cleanses the `html` root class upon page mount to ensure existing visitors receive the clean interface.

### 4.6 Technical Transparency & "How It Works" Section
- **Homepage Summary (`src/components/HowItWorks.tsx`):** High-level 3-step explanation of the single-tap delivery mechanism, local FIFO prefetch, and zero-algorithm philosophy.
- **Dedicated Deep-Dive (`src/pages/HowItWorksPage.tsx` & `src/components/HowItWorksDetail.tsx`):** Detailed breakdown covering the curated catalog, edge delivery, Reddit auxiliary feed SFW filtering, and the zero-account, in-app privacy erasure architecture.

### 4.7 Multi-Page Web Routing & Dedicated Pages
The platform implements full client-side routing and static build prerendering across 9 distinct pages:
- **Home (`/`):** Full interactive landing experience featuring hero, live drop simulator, 3D screenshots, features grid, How It Works summary, and download CTAs.
- **Meme Culture & Editorial Hub (`/editorial` — DRAFT STATUS):** 
  > **STATUS: DRAFT / INACTIVE (Preserved in Codebase, Decoupled from Live Site)**  
  > *Context & Decision:* Implemented in commit `e1293fe` to satisfy AdSense publisher depth standards with 4 long-form cultural essays. However, because core team consensus was not established prior to live deployment, the feature has been placed into **Draft Status**. The source component (`src/pages/Editorial.tsx`), essays, and styling are 100% preserved in the codebase, but the public route, navigation tabs (Desktop & Mobile Navbar, Footer), sitemap entry, and prerendering are deactivated.  
  > *Reactivation Checklist:* To restore this page to the public site, follow the 6-step checklist in `AGENT_RULES.md`: (1) uncomment route in `src/App.tsx`, (2) uncomment links in `Navbar.tsx` desktop and mobile, (3) uncomment link in `Footer.tsx`, (4) add `'/editorial'` to `routes` in `vite.config.ts`, (5) uncomment in `public/sitemap.xml`, and (6) restore CTA target in `src/pages/ContentGuidelines.tsx`.
- **Content Guidelines (`/guidelines`):** Transparent editorial guidelines defining core principles, zero-tolerance prohibitions (hate speech, harassment, doxxing, non-consensual imagery), comedic taxonomy, and expedited DMCA takedown procedures.
- **How It Works (`/how-it-works`):** Standalone route featuring detailed system architecture and anti-algorithm delivery philosophy.
- **FAQ (`/faq`):** Standalone route housing an exhaustive 15-question accordion grid (`src/constants/faq.ts`) with quick back-navigation and direct app download banners.
- **About & Press Kit (`/about`):** Dedicated route featuring official Entity Definition, Quick Facts Grid, One-Liner Copy Kit with instant clipboard copy, and downloadable brand assets (logos, OG banners).
- **Meet the Team (`/team`):** Dedicated team page attributing core engineering leadership:
  - **Pratham Pandey:** Lead Frontend Developer & Original Ideator
  - **Anmol Verma:** Lead Backend Developer
  - **Faraz Ahmed:** Social Media & Marketing Lead
- **Terms of Service (`/terms`):** Store and ad-network compliant terms governing web usage, intellectual property, digital folklore fair use, disclaimers, liability limits, and dispute resolution.
- **Privacy Policy (`/privacy`):** Store-compliant disclosures covering Google Analytics 4, mandatory Google AdSense and DoubleClick cookie disclosures (including opt-outs via `google.com/settings/ads` and `aboutads.info`), AdMob identifiers, zero personal data collection, and local storage data deletion. Includes a canonical link referencing `https://memecapsule.wtf/privacy` to prevent crawler duplicate URL warnings against `public/privacy.html`.

### 4.8 Serverless Contact API via Resend Edge Function
Located in `functions/api/contact.ts` and `src/components/ContactForm.tsx`:
- **Cloudflare Pages Functions + Resend API:** Replaced external Formspree dependency with a custom serverless edge endpoint using the Resend API (`RESEND_API_KEY`).
- **Security & Spam Protection:** Implements invisible honeypot field (`_hp`), strict email regex validation, mandatory privacy consent verification, and HTML character escaping.
- **Structured Notifications:** Delivers formatted dark-mode HTML email notifications to `support@memecapsule.wtf` with sender details and message categorization.
- **CORS & Reliability:** Full preflight CORS headers (`POST, OPTIONS`) and friendly client-side error handling.

### 4.9 Web Monetization: Google AdSense Unit `meme1` & Low-Value Content Policy Resolution
- Integrated via `src/components/AdBanner.tsx`.
- Client ID: `ca-pub-2093403233028868`, Ad Slot: `6291908699` (`meme1`).
- **Policy Compliance & Placement Optimization:**
  - Removed ad unit from interactive client canvas in `MemePreview.tsx` to eliminate low-text/empty canvas ad serving violations.
  - Placed ad unit in content-dense editorial context (`src/pages/Editorial.tsx`) where substantial original long-form articles maintain a >90% content-to-ad ratio (preserved in draft status pending team review).
  - Added required Google AdSense and DoubleClick cookie disclosures with opt-out mechanisms in `Privacy.tsx` (v3.5).
  - Launched comprehensive Terms of Service (`/terms`) and Content Guidelines (`/guidelines`) to resolve thin-content classifications, with Editorial Hub preserved in draft state.

### 4.10 Search, Generative & AI Engine Optimization (SEO, GEO & AEO)
1. **Schema.org Structured Data (JSON-LD):**
   - `WebSite` (`@id: #website`): Canonical entity definition and site search actions.
   - `Organization` (`@id: #organization`): Canonical engineering team attribution linking to verified GitHub and Google Play profiles.
   - `MobileApplication` (`@id: #app`): Directly linked to Google Play package `com.meme.capsule`, free price rating ($0), and Android OS.
   - `FAQPage`: Formats all 15 FAQ questions into Google SERP rich snippet expandable accordions.
2. **Generative Engine Optimization (GEO):**
   - `public/llms.txt`: Concise executive summary and manifest for AI engines.
   - `public/llms-full.txt`: Deep architectural context for AI search engines (ChatGPT Search, Perplexity, Claude, Gemini).
   - `public/robots.txt`: Explicitly whitelists frontier AI scrapers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`).
3. **Google Search Console & Indexing Hygiene:**
   - `public/sitemap.xml`: Cleaned of fragment URLs (e.g. `/#features`), listing exclusively 200 OK standalone prerendered URLs (`/`, `/how-it-works`, `/faq`, `/about`, `/team`, `/privacy`) with accurate `<lastmod>` timestamps.
   - Elimination of SPA 404 redirect dependency through comprehensive static prerender files for all routes.

---

## 5. PART C: DEVELOPER / INTERNAL BACKEND & EDGE INFRASTRUCTURE

### 5.1 Serverless Edge Infrastructure (Cloudflare Pages Functions)
The backend is completely serverless, deployed on Cloudflare Pages (`https://meme-capsule-eww.pages.dev`):
- **`GET /api/random-meme`**: Fetches a random approved meme record from D1 with strict CORS headers (`Access-Control-Allow-Origin: *`).
- **`GET /api/daily-meme`**: Deterministically selects the curated daily meme based on the current UTC date.
- **`POST /api/like`**: Atomically increments `likes_count` for a given meme ID in D1.
- **`POST /api/events`**: Ingests batched telemetry events into the D1 event queue.
- **`POST /api/report`**: Receives user safety reports and logs them in `meme_reports`.
- **`/reports`**: Serves the standalone HTML/CSS moderation dashboard for reviewing flagged content.
- **`/api/cat/*` & `/api/curate/*`**: Authenticated endpoints serving the multi-judge curation system.
- **`/api/admin/*`**: Token-protected administrative endpoints for storage syncing, SQL execution, and analytics management.

### 5.2 Cloudflare D1 Database Schemas & 3-Tier Partitioning Architecture (Migration 012)
Meme Capsule uses Cloudflare D1 (serverless SQLite). The database schema has evolved through 13 migration files (`d1/migrations/`).

#### The 3-Tier Partitioning Architecture (`curation_status`):
To prevent mixing rejected memes with uncurated backlog items, Migration 012 introduced the `curation_status` column on the `memes` table:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TOTAL CORPUS (5,111)                             │
├─────────────────────────┬─────────────────────────┬─────────────────────────┤
│    ACTIVE (KEEP)        │      EXCLUDED           │     ARCHIVED (BACKLOG)  │
│       111 Memes         │       53 Memes          │       4,947 Memes       │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • status: 'active'      │ • status: 'archived'    │ • status: 'archived'    │
│ • is_active: 1          │ • is_active: 0          │ • is_active: 0          │
│ • curation_status: keep │ • curation_status: excl │ • curation_status: NULL │
│ • Eligible for Public   │ • Ineligible for Public │ • Ineligible for Public │
│   Capsule drops         │ • Admin-visible (Red)   │ • Awaiting curator rev. │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

#### Core Database Tables:
1. **`memes` (Core Media Catalog):**
   - `id` (TEXT PRIMARY KEY): Unique identifier.
   - `url` (TEXT): Public URL in Cloudflare R2.
   - `storage_path` (TEXT NOT NULL UNIQUE): R2 storage key.
   - `category` (TEXT): Primary humor category.
   - `tags` (TEXT): JSON array of string tags.
   - `rarity` (TEXT): Drop rarity (`Common`, `Rare`, `Epic`, `Legendary`).
   - `status` (TEXT): Lifecycle state (`active`, `archived`, `draft`).
   - `is_active` (INTEGER): Public delivery flag (1 = active, 0 = inactive).
   - `curation_status` (TEXT DEFAULT NULL): Explicit editorial status (`keep`, `excluded`, `duplicate`, `review_later`, or `NULL` for uncurated backlog). Added in Migration 012.
   - `random_key` (REAL): Indexed random selection helper (`abs(random()) / 9223372036854775807.0`).
   - `likes_count`, `shown_count`, `share_count` (INTEGER).
2. **`meme_curation` (Judge Consensus Votes):**
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `meme_id` (TEXT), `curator_id` (TEXT), `corpus_status` (TEXT: `keep`, `excluded`, `duplicate`, `review_later`), `topics` (TEXT JSON), `tone` (TEXT), `humour_mechanisms` (TEXT JSON), `curator_note` (TEXT), `created_at` (DATETIME).
3. **`meme_curation_final` (SuperAdmin Authoritative Resolutions):**
   - `meme_id` (TEXT PRIMARY KEY), `corpus_status` (TEXT: `keep` or `excluded`), `resolved_by` (TEXT), `resolved_at` (DATETIME). Currently holds **111 keep** and **53 excluded** decisions (164 total).
4. **`cat_users` (Curator Accounts):**
   - `username` (TEXT PRIMARY KEY), `password_hash` (SHA-256), `role` (`judge` or `superadmin`), `is_active` (INTEGER).
5. **`meme_reports` (Content Moderation Queue):**
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `meme_id` (TEXT), `reason` (TEXT), `details` (TEXT), `status` (`pending`, `resolved`, `dismissed`), `created_at` (DATETIME).
6. **`content_blacklist` (Global Ban Registry):**
   - `meme_id` (TEXT PRIMARY KEY), `reason` (TEXT), `created_at` (DATETIME).
7. **`meme_events` & `meme_analytics` (Telemetry & Rankings):**
   - Event queue and aggregated engagement/virality metrics.

### 5.3 Object Storage & Media Delivery (Cloudflare R2 Bucket `memes`)
- Media assets (WebP, JPEG, PNG, GIF, MP4) reside in Cloudflare R2 bucket `memes`.
- Serves content publicly with **zero egress bandwidth charges**, edge caching, and high availability.

### 5.4 Multi-Judge Consensus, AI-Judgement Review & Layer 0 Keyboard Curation (`/curate`, `/categorise`)
Designed for rapid, high-volume evaluation. Curators (Judges 1, 2, 3) review memes pre-evaluated by offline AI models (AI Judges 4 & 5):

**AI-Judgement Review Workflow for Human Judges (Judges 1, 2, 3):**
- **State A (AI Consensus):** When AI Judge 4 and AI Judge 5 agree (both Keep or both Exclude), the human judge can press `Space` or `Enter` to fast-approve the consensus in a single stroke. If taxonomy details differ, pressing `4` adopts Judge 4, pressing `5` adopts Judge 5, or `Space/Enter` adopts Judge 4 by default.
- **State B (AI Disagreement):** When AI Judge 4 and AI Judge 5 reach conflicting conclusions, both decisions are displayed side-by-side with hotkeys: `4` (Adopt Judge 4), `5` (Adopt Judge 5), or `O` (Manual Override).
- **Single AI Ready:** When only one AI has completed evaluation, human judges can press `Space` or `Enter` to instantly adopt the available evaluation without roadblock.
- **Authoritative Single-Judge Finality (`POST /api/curate/approve`):** Any single human judge adoption or manual approval is authoritative and immediately final: it writes to `meme_curation`, writes to `meme_curation_final`, and synchronizes `memes` (`is_active`, `status`, `curation_status`, `tags`, `category`) in an atomic transaction. Memes do not require SuperAdmin arbitration.
- **Force Remove (`Shift+Delete` / `POST /api/curate/force-remove`):** For non-meme / invalid media in the corpus, pressing `Shift+Delete` or clicking `FORCE REMOVE` permanently vanishes the file from R2 media storage and purges all records across D1 tables (`memes`, `meme_curation`, `meme_curation_final`, `ai_curation_predictions`, etc.). This destructive action is non-undoable.
- **Layer 0 Keyboard Curation (Override Mode `[O]`):**
  - `K`: **Keep** (Approved for public delivery).
  - `X`: **Exclude** (Archived; hidden from public drops).
  - `D`: **Duplicate** (Flag as duplicate with target ID).
  - `R`: **Review Later** (Deferred to secondary review queue).
  - `1-9, 0, -, =`: Toggle topic taxonomy (Max 3).
  - `Q, W, E, A, S, F`: Select humor tone (1 dominant).
  - `Z, C, V, B, N, M, J, P, O`: Select humor mechanisms (Max 2).
  - `Space / Enter`: Save & Advance.
  - `Esc`: Return from manual override to AI review view.
  - `Cmd/Ctrl + Z` or `U`: Instant undo last curation decision.


### 5.5 SuperAdmin Arbitration & Authoritative Active Synchronization
When judges diverge in their votes, the meme surfaces in the **SuperAdmin Command Center**:
- **Authoritative Keep (`corpus_status = 'keep'`)**: Automatically activates the meme in `memes` (`status = 'active'`, `is_active = 1`, `curation_status = 'keep'`), registering it in the live public spawn pool (111 memes).
- **Authoritative Excluded (`corpus_status = 'excluded'`)**: Sets the meme to `status = 'archived'`, `is_active = 0`, and `curation_status = 'excluded'`, permanently isolating it from public drops while preserving it for audit (53 memes).
- **SuperAdmin KPI Metrics**: The Superadmin dashboard displays `111 ACTIVE / 5111 (164 RESOLVED)` with a dedicated badge for `53 EXCL`.
- **Public Spawn Gating**: The public delivery APIs (`/api/random-meme`, `/api/daily-meme`) strictly require an inner join on `meme_curation_final` with `corpus_status = 'keep'`, ensuring unfinalized or excluded memes can never enter user capsule drops.

### 5.6 Admin Console, 5-Metric Status Bar & SQL Runner (`/admin`)
Token-protected control center (`ADMIN_API_TOKEN`):
- **Top Stats Bar:** Displays 5 distinct metrics:
  - `TOTAL`: **5111**
  - `ACTIVE`: **111**
  - `EXCLUDED`: **53** (High-contrast red card `#FF3B30`)
  - `ARCHIVED`: **4947** (Uncurated backlog)
  - `DRAFTS`: **0**
- **Filter Tabs:** Includes `EXCLUDED (53)` filter tab alongside `ALL (5111)`, `ACTIVE (111)`, `ARCHIVED (4947)`, and `DRAFT (0)`.
- **Row Presentation:** Excluded memes display a high-visibility red `EXCLUDED` badge and strikethrough title.
- **R2 Storage Sync:** Scans R2 bucket, identifies unindexed media files, and inserts them into D1 as new meme candidates.
- **SQL Runner:** Allows administrators to execute raw SQLite queries directly against D1 with safety guards.
- **Analytics Management:** Triggers the recalculation engine and provides CSV/Excel export capabilities.

### 5.7 Token-Gated Safety Moderation & Blacklisting (`/reports`)
Standalone, token-protected dashboard rendering directly from `functions/reports.ts`:
- Lists all pending user reports from the mobile app.
- Previews the reported meme, reason (`NSFW`, `Hate Speech`, `Harassment`, `Copyright`), and reporter details.
- **Actions:**
  - *Dismiss:* Clears report as benign.
  - *Archive Meme:* Sets meme `status = 'archived'` in D1 (soft removal).
  - *Blacklist Meme:* Sets `status = 'archived'` AND permanently records the meme in `content_blacklist`.

### 5.8 Multimodal AI Pre-Curator Loop (`/ai-judge` & NVIDIA NIM Llama 3.2 Vision)
1. **Gemini Vision Pipeline (`/api/ai-judge/classify.ts`):** Multimodal Google Gemini Vision (`gemini-1.5-flash`) analyzes uploaded memes, extracting captions, evaluating humor mechanisms, and proposing tags.
2. **NVIDIA NIM Python Runner (`categorise.py`):** An asynchronous worker passing images to **NVIDIA NIM (Llama 3.2 11B Vision Instruct)** to extract OCR text, score humor mechanisms (irony, absurdity, relatability), assign tone and topic, rate rarity, and perform automated toxicity/NSFW screening before staging in D1.

### 5.9 Telemetry Pipeline & Edge Ranking Recalculation Engine
- **Client Side:** Client actions (`view`, `skip`, `like`, `share`, `download`) are enqueued into a local circular buffer and flushed every 30 seconds to `POST /api/events`.
- **Edge Side:** Events are written into `meme_events` with timestamps and session identifiers.
- **Recalculation:** The recalculation worker aggregates events across time windows, computing:
  - *Engagement Score:* Weighted combination of likes, shares, and downloads against views.
  - *Virality Score:* Ratio of external shares to total views.
  - *Skip Rate:* Percentage of views lasting under 1.5 seconds.
  - *Percentile Rankings:* Normalized scoring used for internal editorial insight.

---

## 6. UNIFIED NEO-BRUTALIST DESIGN SYSTEM & DESIGN TOKENS

All three codebases share a unified **Neo-Brutalist Cyber-Arcade** design language:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                       UNIFIED NEO-BRUTALIST TOKENS                         │
├───────────────────┬────────────────────────────────────────────────────────┤
│ Background Canvas │ Pitch Black #121212 / #131313                          │
│ Card Surfaces     │ Dark Panel #1a1a1a / #1c1b1b                           │
│ Surface High      │ Slate Container #2a2a2a                                │
│ Primary Purple    │ High-Voltage Purple #9b30ff                            │
│ Secondary Gold    │ Arcade Gold #f4c300                                    │
│ Tertiary Pink     │ Cyber Hot Pink #dd0061                                 │
│ Terminal Green    │ Terminal Green #34c759 (Success / Active Status)       │
│ Danger Red        │ High-Voltage Red #ff3b30 / #ff2a2a (Excluded / Report) │
│ Accent Tangerine  │ More Options Tangerine #ff8c00                         │
│ Primary Font      │ Anton (Uppercase, Heavy Impact H1–H3)                  │
│ Body Font         │ Oswald / Chivo (High Legibility sans-serif)            │
│ Borders           │ Solid 2px to 4px Black or High-Voltage Accent          │
│ Box Shadows       │ Hard Offset 4px to 6px Geometric Block (No Blur)       │
└───────────────────┴────────────────────────────────────────────────────────┘
```

- **Hard Contrast:** Eliminates subtle gradients and soft blurs in favor of stark, aggressive contrast.
- **Tactile Feedback:** Buttons physically shift (`translate-x-1 translate-y-1`) and shed their hard offset box shadows on active press, simulating a physical arcade button depress.
- **Typography:** Heavy uppercase `Anton` headings convey bold authority, supported by condensed `Oswald` body copy.

---

## 7. COMPREHENSIVE IMPLEMENTATION STATUS AUDIT MATRIX

| System / Codebase | Specific Module | Status | Verification Evidence & Location |
|---|---|---|---|
| **Mobile App (APK)** | Capacitor 8 Container & React 19 UI | `[IMPLEMENTED]` | `com.meme.capsule`, `v3.7` (`versionCode 28`) |
| **Mobile App (APK)** | 4-Card 3D Perspective Spring Deck | `[IMPLEMENTED]` | `MemeStack.tsx` (`@react-spring/web` & `@use-gesture/react`) |
| **Mobile App (APK)** | 7-Meme FIFO Background Prefetch Buffer| `[IMPLEMENTED]` | `src/App.tsx` (`PIPELINE_TARGET_SIZE = 7`) |
| **Mobile App (APK)** | Instant-Touch Overlay Buttons | `[IMPLEMENTED]` | `MemeCard.tsx` (`onPointerDown` with debounce guard) |
| **Mobile App (APK)** | Neo-Brutalist Share Sheet with 6 SVGs | `[IMPLEMENTED]` | `ShareModal.tsx` (WhatsApp, Insta, FB, X, TG, Discord) |
| **Mobile App (APK)** | Scoped MediaStore Native Java Bridge | `[IMPLEMENTED]` | `MainActivity.java` (`Pictures/Meme Capsule`) |
| **Mobile App (APK)** | Targeted Social Share Intent Bridge | `[IMPLEMENTED]` | `MainActivity.java` (`shareImageToApp`) |
| **Mobile App (APK)** | Meme Vault (Favorites) & Mood Boards | `[IMPLEMENTED]` | `src/App.tsx`, `CreateBoardModal.tsx`, `UnpinModal.tsx` |
| **Mobile App (APK)** | Settings, Privacy & History Erasure Page| `[IMPLEMENTED]` | `src/App.tsx` (`activeTab === 'settings'`, full history wipe) |
| **Mobile App (APK)** | AdMob Interstitials & Rewarded Drops | `[IMPLEMENTED]` | `@capacitor-community/admob` |
| **Mobile App (APK)** | In-App Purchases (3 Packs: Ads ₹199, Boards ₹49, Combo ₹199) | `[IMPLEMENTED]` | `@capgo/native-purchases` (`StoreScreen.tsx`) |
| **Mobile App (APK)** | UGC Reporting & Local Blocklist | `[IMPLEMENTED]` | `ReportModal.tsx` + `localStorage('reported_memes')` |
| **Promo Web (`.wtf`)** | Official Multi-Page Site (`memecapsule.wtf`)| `[IMPLEMENTED]` | React 19, Vite 8, React Router v7, GitHub Pages |
| **Promo Web (`.wtf`)** | Interactive Live Drop Preview Simulator | `[IMPLEMENTED]` | `MemePreview.tsx` (5-drop quota & fallback pool) |
| **Promo Web (`.wtf`)** | Conversion Lockout Bumper | `[IMPLEMENTED]` | Bumper overlay with Play Store UTM tracking |
| **Promo Web (`.wtf`)** | 3D Interactive Phone Mockups (WebP) | `[IMPLEMENTED]` | `Screenshots.tsx` (5 authentic WebP captures + lightbox) |
| **Promo Web (`.wtf`)** | Kage Atmospheric UI (Preloader, Cursor) | `[IMPLEMENTED]` | `Preloader.tsx`, `CustomCursor.tsx`, `ScrollRail.tsx` |
| **Promo Web (`.wtf`)** | How It Works & Transparency (`/how-it-works`)| `[IMPLEMENTED]` | `HowItWorksPage.tsx` & `HowItWorksDetail.tsx` |
| **Promo Web (`.wtf`)** | Dedicated About, Press Kit & Team Pages | `[IMPLEMENTED]` | `/about`, `/team` (Leadership & downloadable assets) |
| **Promo Web (`.wtf`)** | Standalone 15-Question FAQ Route (`/faq`) | `[IMPLEMENTED]` | `FAQPage.tsx`, `faq.ts` (Rich snippet accordions) |
| **Promo Web (`.wtf`)** | Resend Edge API Contact Function | `[IMPLEMENTED]` | `functions/api/contact.ts` + `ContactForm.tsx` |
| **Promo Web (`.wtf`)** | Google AdSense Unit `meme1` | `[IMPLEMENTED]` | `AdBanner.tsx` (`slot 6291908699`, deferred load) |
| **Promo Web (`.wtf`)** | Deterministic Static Prerender (6 Routes) | `[IMPLEMENTED]` | `vite-plugin-prerender` + per-route SEO injection |
| **Edge Backend** | Serverless Edge API on Cloudflare Pages | `[IMPLEMENTED]` | `functions/api/random-meme.ts`, `daily-meme.ts`, etc. |
| **Edge Backend** | Cloudflare D1 SQLite Database (13 Migrations)| `[IMPLEMENTED]` | `d1/migrations/` (000 through 012) |
| **Edge Backend** | 3-Tier Status Partitioning (Migration 012) | `[IMPLEMENTED]` | `curation_status`: 111 Keep, 53 Excluded, 4,947 Backlog |
| **Edge Backend** | Cloudflare R2 Media Bucket (`env.BUCKET`) | `[IMPLEMENTED]` | `wrangler.toml`, zero egress public CDN |
| **Edge Backend** | Multi-Judge Consensus Portal (`/curate`) | `[IMPLEMENTED]` | `src/curate/CurateApp.tsx` (Layer 0 keyboard shortcuts) |
| **Edge Backend** | SuperAdmin Arbitration Dashboard | `[IMPLEMENTED]` | `src/curate/super/CurateSuperDashboard.tsx` |
| **Edge Backend** | Admin Console with 5 Stats Cards (`/admin`)| `[IMPLEMENTED]` | `src/admin/AdminApp.tsx` (Total, Active, Excl, Arch, Draft)|
| **Edge Backend** | Token-Gated Moderation Dashboard (`/reports`)| `[IMPLEMENTED]` | `functions/reports.ts` (Archive & Blacklist actions) |
| **Edge Backend** | Multimodal AI Pre-Curator Loop (`/ai-judge`)| `[IMPLEMENTED]` | Gemini Vision API & NVIDIA NIM Llama 3.2 Vision runner |
| **Edge Backend** | Telemetry Recalculation Engine | `[IMPLEMENTED]` | `functions/api/admin/analytics/recalculate.ts` |
| **Discontinued UI** | Legacy Pastel Landing UI (`App.tsx`) | `[REMOVED]` | Removed from backend repo; default route `/` is `/curate` |
| **Discontinued Web** | Giscus / Formspree Contact Dependencies | `[REMOVED]` | Migrated to Cloudflare Pages Functions + Resend API |
| **Discontinued Web** | Stacking Card Scroll Animation | `[REVERTED]` | Replaced with authentic Kage scroll reveal |

---

## 8. DISCREPANCY RECONCILIATION, KNOWN LIMITATIONS & RESOLVED ISSUES

### 8.1 Resolved Architectural Issues
1. **The 164 vs 111 SuperAdmin Discrepancy (RESOLVED):**
   - *Previous state:* Superadmin showed `AUTHORITATIVE RESOLVED (164)` summing both keep (111) and excluded (53), while `/admin` showed `111 Active`.
   - *Resolution:* Superadmin KPI card now displays `111` (in `#34C759` green) matching `/admin Active`, with a dedicated `53 EXCL` badge.
2. **Archived vs Excluded Ambiguity (RESOLVED - Migration 012):**
   - *Previous state:* Both excluded memes (53) and uncurated backlog items (4,947) were lumped together into `status = 'archived'`.
   - *Resolution:* Added `curation_status` column to `memes`. Backfilled `curation_status = 'keep'` (111), `'excluded'` (53), and `NULL` (4,947). Added dedicated `[EXCLUDED]` filter tab and red badge to `/admin`.
3. **Drift Between `status` and `is_active` (RESOLVED - Migration 011):**
   - *Previous state:* 11 rows had mismatched `status` and `is_active` flags.
   - *Resolution:* Enforced $\text{status} = \text{'active'} \iff \text{is\_active} = 1$ across all 5,111 memes.
4. **Placeholder Screenshots on `memecapsule.wtf` (RESOLVED):**
   - *Previous state:* External placeholder generator URLs (`via.placeholder.com`).
   - *Resolution:* Replaced with 5 authentic Android app screenshots in modern WebP + JPEG format with 3D tilt and lightbox zoom.
5. **SPA Subpage 404 Routing on GitHub Pages (RESOLVED):**
   - *Previous state:* Reloading `/about` or `/privacy` returned 404 errors.
   - *Resolution:* Added `vite-plugin-prerender` with deterministic `ReactSSRRenderer` and a fallback `privacy.html`.
6. **Card Touch Responsiveness During Gestures (RESOLVED):**
   - *Previous state:* Touch clicks on card buttons were swallowed by `@use-gesture/react`.
   - *Resolution:* Switched overlay buttons to `onPointerDown`/`onTouchStart` with debounce timestamp guards and `pointer-events-none` on SVG icons.
7. **Service Worker Clashing in Android WebView (RESOLVED):**
   - *Previous state:* Old `sw.js` caused `Failed to fetch` errors inside Capacitor WebViews.
   - *Resolution:* Service worker registration was explicitly disabled in the mobile client.

### 8.2 Critical Engineering Constraints
1. **Tailwind CSS v4 Spacing Token Collision:**
   - In Tailwind CSS v4, custom `--spacing-*` tokens cause classes like `max-w-md` to resolve to `24px` instead of `28rem`. Always use explicit pixel widths (e.g. `max-w-[460px]`).
2. **Public Spawn Inner Join Requirement:**
   - Public APIs (`/api/random-meme`, `/api/daily-meme`) MUST enforce `INNER JOIN meme_curation_final f ON m.id = f.meme_id WHERE f.corpus_status = 'keep'`. Never bypass this gate.
3. **Zero Runtime Permissions on Android 10+:**
   - Media downloads must continue using Android `MediaStore.Images.Media` via the native Java bridge. Do not request legacy `WRITE_EXTERNAL_STORAGE` permissions.

---

## 9. PROJECT TERMINOLOGY & MASTER GLOSSARY

- **Capsule:** The conceptual unit of content delivery in Meme Capsule — a sealed container that must be opened.
- **Spawn / Drop:** The act of dispensing a single meme from the cloud library.
- **HIT ME:** The primary arcade action button.
- **Meme Vault:** The user's offline collection of favorited memes stored on their device.
- **Mood Board ("Pinned Energy"):** A user-created thematic binder (e.g., "Workplace Chaos") grouping selected memes.
- **4-Card 3D Spring Stack:** The interactive physical card deck powered by `@react-spring/web` and `@use-gesture/react`.
- **FIFO Prefetch Buffer:** An in-memory queue maintaining 7 pre-validated memes for zero-latency swiping.
- **Instant-Touch Overlay:** Action buttons executing on `onPointerDown`/`onTouchStart` with debounce guards.
- **Neo-Brutalist Share Sheet:** Custom bottom sheet featuring live thumbnail preview, auto-attached Play Store link, and 6 animated social media SVGs.
- **MediaStore Bridge:** The native Android Java interface `window.MemeCapsuleAndroid` in `MainActivity.java` streaming media directly into `Pictures/Meme Capsule`.
- **Layer 0 Curation:** High-speed, keyboard-driven human screening (`K`, `E`, `D`, `L`) of raw meme corpora.
- **SuperAdmin Arbitration:** The process where a senior curator resolves diverging multi-judge votes into an authoritative consensus record in `meme_curation_final`.
- **3-Tier Partitioning:** The database architecture segregating memes into `Active (Keep)` (111), `Superadmin Excluded` (53), and `Uncurated Backlog` (4,947) via `curation_status`.
- **Content Blacklist:** Permanent platform ban table (`content_blacklist`) used by moderators to suppress unsafe media.
- **Under the Hood:** Section 04.5 on the website providing honest architectural transparency.
- **Bumper:** The modal locking web preview after 5 drops to encourage Google Play app downloads.
- **Acid / Glitch Theme:** The alternative CRT scanline and high-saturation website theme (`html.theme-glitch`).

---

## 10. CONTENT STRATEGY, ONE-LINERS & COPY KIT

### 10.1 Short & Punchy One-Liners
- **Under 10 Words:** Random memes. One tap. Zero algorithms.
- **Under 30 Words:** Meme Capsule is a free Android app that delivers hand-curated random memes with one tap. No feed, no algorithm, just pure meme chaos.
- **Under 80 Words:** Meme Capsule is an anti-algorithm entertainment app for Android that delivers hand-curated memes from a library of thousands of vetted images, supplemented by an auxiliary Reddit stream. Users tap one button to open a capsule — there is no algorithm, no tracking, and no endless scrolling. Memes can be saved to a personal offline vault, organized into mood boards, shared to any messaging app, or downloaded directly to the phone gallery.

### 10.2 Technical Pitch (For Developers / AI Agents)
> *Meme Capsule is a cross-platform content delivery ecosystem combining a Capacitor 8 native Android application (featuring a zero-permission Java MediaStore bridge and 4-card 3D perspective spring stack), a Cloudflare Pages serverless edge backend querying Cloudflare D1 SQLite and R2 object storage with zero egress fees and 3-tier status partitioning, a multimodal vision AI pre-judging pipeline (Gemini Vision and NVIDIA NIM Llama 3.2 11B Vision), and a multi-page neo-brutalist React web presence with deterministic static prerendering.*

---

## 11. AI AGENT PORTABLE HANDOFF PROMPT

> [!NOTE]
> Copy and paste this block into any prompt to give a new AI coding agent complete, unhallucinated operating context for Meme Capsule across all three codebases.

```text
=== PORTABLE CONTEXT: MEME CAPSULE (ALL THREE CODEBASES) ===
APP NAME: Meme Capsule
PACKAGE ID: com.meme.capsule
CURRENT ANDROID VERSION: v3.7 (versionCode 28)
OFFICIAL WEBSITES: https://memecapsule.wtf (Web Platform) | https://meme-capsule-eww.pages.dev (Edge Backend)
DEVELOPERS & LEADERSHIP:
- Anmol Verma (GitHub: editorav010-dev)
  Lead Backend Developer: Full backend engineering, serverless architecture, core algorithms, AI tools, security, curation, and all admin systems.
- Pratham Pandey (GitHub: bbethical010-glitch)
  Lead Frontend Developer & Original Ideator: Founding concept, APK, web platform (memecapsule.wtf), app theme, typography, UI/UX, Java Android bridge, MediaStore integrations, client build setup.
- Faraz Ahmed
  Social Media & Marketing Lead: Social handles, content planning, niche analysis, scripting, quality control, and marketing campaigns.
Official App Email (User Support & Marketing): support@memecapsule.wtf
Social Media:
  Instagram: https://www.instagram.com/capsule.meme/
  X: https://x.com/memecapsule_
  Threads: https://www.threads.com/@capsule.meme

ECOSYSTEM STRUCTURE:
1. PUBLIC MOBILE APP (com.meme.capsule - v3.7 / versionCode 28):
   - Tech: React 19, TypeScript, Vite 6, Tailwind CSS v4, Capacitor 8 Android container.
   - Core UX: 4-card 3D perspective spring deck (@react-spring/web, @use-gesture/react), 12-meme rolling FIFO prefetch buffer (STACK_BATCH_SIZE = 10, PIPELINE_TARGET_SIZE = 12) with 60%-70% stack consumption prefetch trigger (STACK_PREFETCH_CONSUMPTION_RATIO = 0.6 / FIFO_REFILL_TRIGGER_SIZE = 4) and streaming per-meme enqueueing (enqueueMemeToFifo + advanceInlineWithoutLoadingScreen so viewing flow never breaks with a full-screen loading screen), zero floating action buttons over the Meme Box, and horizontal 4-column CTA row (nav#ctaRow, max-w-[356px] w-full mt-3.5) directly below the Meme Box: LIKE (#FF2A85) -> VAULT (#A855F7) -> PIN (#FACC15) -> MORE (⋮) (#00E5FF) with translate(3px, 3px) active press, ink-spread ripple (@keyframes inkSpread), 6-tick radial shockwave bursts (@keyframes burstSparks), and pop icon animations (@keyframes neoBurst). Tapping MORE opens #moreMenu (w-48 bg-white border-4 border-black) containing SHARE (#A855F7), DOWNLOAD (#FACC15), and REPORT (#FF2A85).
   - Google Play Rating Feature (RatingModal.tsx - v3.6): Interval-based rating prompt (first triggers at >= 8 memes viewed, then every 15 memes). Features a Neo-Brutalist 5-star interactive rating deck with dynamic reaction labels ("GOD-TIER DANKNESS!", "CERTIFIED BANGERS!", etc.). Redirects to Google Play Store via native bridge `openPlayStoreListing()` (`market://details?id=com.meme.capsule` with fallback to `https://play.google.com/store/apps/details?id=com.meme.capsule`) and sets `meme_capsule_rating_completed = 'true'` so it permanently never pops up again once feedback is registered. Provides a 24-hour deferral option (`REMIND ME IN 24 HOURS`) setting `meme_capsule_rating_deferred_until`. Also includes a manual trigger button in App Settings under "MEMBERSHIP & APP GUIDE".
   - Smart Session Lifecycle (Background App-Switch Retention vs Cold-Start Homepage Reset - v3.2): Uses `sessionStorage` (`meme_capsule_active_session_v1`), a short-lived 2-minute external share handoff token (`meme_capsule_share_handoff_v1`), and native Android process/task state detection (`window.MemeCapsuleAndroid.shouldRestoreRunningSession()` + `meme-capsule-reset-to-home` in `MainActivity.java`). Switching between running apps or sharing to external apps preserves the exact loaded meme and 12-meme FIFO queue, whereas removing/closing the app from running background applications in Android Recents and reopening it starts fresh on the Homepage (`screen = 'waiting'`, `activeTab = 'home'`).
   - Top-Left Header & Settings Dismissal: Removed the leaf/seed badge (🌱 1) from the top-left header and replaced it with a redesigned Neo-Brutalist Settings icon button (#1c1c1e / #A855F7, 2px solid #000, 2.5px 2.5px 0px #000). Replaced the redundant large gear square on the top right of APP SETTINGS with a Neo-Brutalist [X] Close Button, and enabled top-left header re-tap toggle, backdrop tap-to-dismiss, and Android hardware back dismissal.
   - Viral Sharing: Persistent Share Sheet Ribbon sits 100% flush (0px breathing space) on the top border of the 3-tab bottom navigation dock (bottom: calc(60px + max(env(safe-area-inset-bottom, 0px), 16px))). Expands smoothly over 320ms cubic-bezier(0.16, 1, 0.3, 1) from behind the dock, supports Instagram-style 0-latency 1:1 finger drag-to-dismiss (26% height / 0.5px/ms velocity threshold), and removes both the 5 technical/debug labels and the visible dark promotional text preview box from the frontend while preserving 100% of the promotional message + Play Store link payload on clipboard and share intents.
   - Native Java: MainActivity.java injects "window.MemeCapsuleAndroid" for Scoped MediaStore gallery saving (Pictures/Meme Capsule), Play Store listing intent (openPlayStoreListing), and targeted intent sharing (shareImageToApp).
   - Collections, Settings & Monetization: Meme Vault (free limit 20, Pro unlimited), Mood Boards, dedicated Settings & History page (Privacy Policy v1.1, 4 granular history/data erasure controls, feed/buffer/shake toggles), AdMob screen transition interstitials (30s cooldown between Vault, Settings, Boards, Home; zero interruptions during meme scrolling), In-App Purchase (3 focused packs: Remove Ads ₹199, Unlimited Mood Boards ₹49, Combo Pack ₹199).

2. PUBLIC WEB PLATFORM (memecapsule.wtf):
   - Tech: React 18, Vite 5, Tailwind CSS v3, React Router DOM v6, static HTML prerendering (vite-plugin-prerender with ReactSSRRenderer) on GitHub Pages.
   - Core Features: Live Drop Simulator (5-drop quota + lockout bumper with Play Store UTM tracking), 3D interactive phone mockups (5 authentic WebP captures + lightbox zoom), Kage atmospheric UI (Preloader, CustomCursor, GrainOverlay, Vignette, ScrollRail), Section 04.5 Under the Hood, /about Press Kit (copy kit & brand downloads), /privacy policy, Formspree contact form (xwlenwzr with privacy consent), Google AdSense unit meme1 (slot 6291908699, ca-pub-2093403233028868), and SEO/GEO (llms.txt, Schema.org).

3. SERVERLESS EDGE BACKEND & INTERNAL WORKBENCHES (meme-capsule-eww.pages.dev - This Repo):
   - Tech: Cloudflare Pages Functions, Cloudflare D1 (SQLite with 13 migrations), Cloudflare R2 (bucket memes, $0.00 egress).
   - 3-Tier Status Partitioning (Migration 012):
     * curation_status = 'keep' (111 memes, status = 'active', is_active = 1) -> Live in public Capsule drops.
     * curation_status = 'excluded' (53 memes, status = 'archived', is_active = 0) -> Authoritatively rejected by Superadmin.
     * curation_status IS NULL (4,947 memes, status = 'archived', is_active = 0) -> Uncurated backlog.
     * Total Corpus: 5,111 memes.
   - Internal Tools (Neo-Brutalist dark theme #121212, Anton/Oswald fonts):
     * /curate & /categorise: Multi-judge consensus curation with Layer 0 keyboard shortcuts (K, E, D, L) and SuperAdmin conflict arbitration.
     * /admin: 5-metric status bar (Total 5111, Active 111, Excluded 53, Archived 4947, Drafts 0), dedicated [EXCLUDED] filter tab, D1/R2 sync, SQL runner, analytics recalculation.
     * /reports: Token-gated moderation dashboard for user-flagged memes (archive / blacklist).
     * /ai-judge: Multimodal vision loop (Gemini Vision + NVIDIA NIM Llama 3.2 Vision runner) for pre-curation recommendations.
   - Note: Old pastel root landing UI (App.tsx, styles.css) has been REMOVED. Default route / serves <CurateApp />.

CRITICAL RULES & CONSTRAINTS:
1. STRICT INTEGRITY: The public spawn query strictly requires INNER JOIN on meme_curation_final WHERE corpus_status = 'keep'. Unfinalized or excluded memes must never spawn.
2. NO ALGORITHMS: The public delivery philosophy is anti-algorithmic serendipity. Never add recommendation algorithms.
3. TAILWIND V4 GOTCHA: In Tailwind v4, custom --spacing-* tokens cause max-w-md to resolve to 24px. Always use explicit pixel widths (e.g. max-w-[460px]).
4. CLEAR CODEBASE BOUNDARIES: Maintain strict separation between Mobile APK, Promo Web, and Edge Backend.
=========================================================
```





