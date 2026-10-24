# PRIVACY, COOKIES & DATA FLOW SPECIFICATION
### Technical Audit & Compliance Reference for Meme Capsule Web & Mobile

> **Document Type:** Data Governance, Privacy Audit & Regulatory Specification  
> **App / System:** Meme Capsule  
> **Android Package Identifier:** `com.meme.capsule`  
> **Public Web Presence:** [https://memecapsule.wtf/](https://memecapsule.wtf/)  
> **Project Team:**  
> - **Anmol Verma** (Lead Backend Developer — `editorav010-dev`)  
> - **Pratham Pandey** (Lead Frontend Developer & Original Ideator — `bbethical010-glitch`)  
> - **Faraz Ahmed** (Social Media & Marketing Lead)  
> **Official App Email (User Support & Marketing):** `support@memecapsule.wtf`  
> **Last Verified:** October 2026  
> **Status:** Production Reference  

---

## TABLE OF CONTENTS

1. [Executive Summary & Scope](#1-executive-summary--scope)
2. [Public Web Platform (`memecapsule.wtf`) Audit](#2-public-web-platform-memecapsulewtf-audit)
   - 2.1 [Contact Form (Formspree)](#21-contact-form-formspree)
   - 2.2 [Web Analytics (Google Analytics 4 / Google Tag Manager)](#22-web-analytics-google-analytics-4--google-tag-manager)
   - 2.3 [Cookie Inventory & Consent Status](#23-cookie-inventory--consent-status)
   - 2.4 [Newsletters, Waitlists & Marketing Pixels Audit](#24-newsletters-waitlists--marketing-pixels-audit)
   - 2.5 [External CDNs & Third-Party Assets](#25-external-cdns--third-party-assets)
3. [Android Mobile Application (`com.meme.capsule`) Audit](#3-android-mobile-application-commemecapsule-audit)
   - 3.1 [Advertising SDK (Google AdMob)](#31-advertising-sdk-google-admob)
   - 3.2 [In-App Purchases & Billing (Google Play)](#32-in-app-purchases--billing-google-play)
   - 3.3 [Zero-Storage Media Saving (Android MediaStore Bridge)](#33-zero-storage-media-saving-android-mediastore-bridge)
   - 3.4 [Native Sharing (Android FileProvider Bridge)](#34-native-sharing-android-fileprovider-bridge)
   - 3.5 [Local Device Isolation (Meme Vault & Mood Boards)](#35-local-device-isolation-meme-vault--mood-boards)
   - 3.6 [Content Moderation & In-App Reporting](#36-content-moderation--in-app-reporting)
4. [Backend Telemetry & Edge Data Processing](#4-backend-telemetry--edge-data-processing)
   - 4.1 [Event Telemetry Queue (`/api/events`)](#41-event-telemetry-queue-apievents)
   - 4.2 [Client Device Anonymization (SHA-256 Hashing)](#42-client-device-anonymization-sha-256-hashing)
   - 4.3 [Cloudflare D1 Storage & Aggregation Metrics](#43-cloudflare-d1-storage--aggregation-metrics)
5. [Third-Party Subprocessor Directory](#5-third-party-subprocessor-directory)
6. [Regulatory Compliance & App Store Declarations](#6-regulatory-compliance--app-store-declarations)
   - 6.1 [Google Play Data Safety Form Guide](#61-google-play-data-safety-form-guide)
   - 6.2 [GDPR & ePrivacy Assessment (EU/UK Visitors)](#62-gdpr--eprivacy-assessment-euuk-visitors)
   - 6.3 [California Consumer Privacy Act (CCPA / CPRA)](#63-california-consumer-privacy-act-ccpa--cpra)
7. [Recommended Enhancements & Roadmap Actions](#7-recommended-enhancements--roadmap-actions)

---

## 1. EXECUTIVE SUMMARY & SCOPE

Meme Capsule operates with an intentional **privacy-first, data-minimization philosophy**:
- **No User Accounts:** Ordinary users do not register, log in, or provide phone numbers/passwords.
- **No Infinite Tracking:** Feed generation is randomized serendipity; no behavioral ad-profiling algorithms are deployed to dictate content.
- **Surface Segregation:** Data collection differs strictly between the **Promotional Website** (`memecapsule.wtf`) and the **Native Mobile Application** (`com.meme.capsule`).

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DATA COLLECTION MATRIX                                │
├─────────────────────────┬───────────────────────┬───────────────────────────────┤
│ Category                │ Web (memecapsule.wtf) │ Mobile App (com.meme.capsule) │
├─────────────────────────┼───────────────────────┼───────────────────────────────┤
│ Contact Form            │ YES (Formspree)       │ NO                            │
│ Web Analytics           │ YES (GA4 G-8VMD4ZNQQK)│ NO (Custom Event Queue Only)  │
│ Browser Cookies         │ YES (_ga, _ga_*)      │ NO (Native WebKit Sandbox)    │
│ Newsletter / Waitlists  │ NO                    │ NO                            │
│ Ad Marketing Pixels     │ NO                    │ NO                            │
│ In-App Advertising      │ NO                    │ YES (Google AdMob SDK)        │
│ In-App Purchases        │ NO                    │ YES (Google Play Billing ₹99) │
│ Gallery Downloads       │ N/A                   │ YES (MediaStore, zero-perm)   │
│ Client Telemetry Queue  │ NO                    │ YES (Flushed to /api/events)  │
│ Safety Reporting        │ YES (Contact Form)    │ YES (/api/report endpoint)    │
└─────────────────────────┴───────────────────────┴───────────────────────────────┘
```

---

## 2. PUBLIC WEB PLATFORM (`memecapsule.wtf`) AUDIT

### 2.1 Contact Form (Formspree)
The landing site features a contact and support form in Section `07 — GET IN TOUCH` (`#contact`).

- **Service Provider:** [Formspree Inc.](https://formspree.io)
- **Endpoint URL:** `https://formspree.io/f/xwlenwzr`
- **Form Action:** Direct HTTP `POST` submission.
- **Target Recipients:**
  - Official User Support, App & Technical inquiries: `support@memecapsule.wtf`
  - Backup & Operations inbox: `memecapsule.app@gmail.com`
- **Data Collected:**
  1. `name` (*Required, text*): Name provided by the user.
  2. `email` (*Required, email*): Return email address for responses.
  3. `subject` (*Dropdown*): Category selection (`General Question`, `Bug Report`, `Feature Request`, `Content Issue`, `Other`).
  4. `message` (*Required, textarea*): Freeform user inquiry.
- **Data Retention & Security:** Formspree acts as an email forwarding proxy. Submissions are transmitted over TLS/HTTPS directly to the recipient mailbox. No marketing mailing lists are automatically populated from this form.

### 2.2 Web Analytics (Google Analytics 4 / Google Tag Manager)
The website embeds standard Google Analytics 4 (GA4) via the Google Tag Manager loader script in the document `<head>`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-8VMD4ZNQQK"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-8VMD4ZNQQK');
</script>
```

- **Service Provider:** Google LLC
- **Measurement ID:** `G-8VMD4ZNQQK`
- **Purpose:** Aggregate web traffic reporting (total pageviews, landing bounce rates, device types, top geographic regions, outbound clicks to Google Play).
- **Personally Identifiable Information (PII):** IP anonymization is active by default in GA4. No visitor names, precise GPS coordinates, or cross-site tracking identities are harvested.

### 2.3 Cookie Inventory & Consent Status
When visiting `https://memecapsule.wtf/`, the browser receives first-party analytics cookies created by Google Analytics:

| Cookie Name | Provider | Expiration | Purpose | Category |
|---|---|---|---|---|
| `_ga` | Google Analytics | 2 Years | Distinguishes unique browser sessions/visitors | Analytics |
| `_ga_8VMD4ZNQQK` | Google Analytics | 2 Years | Maintains session state across page views | Analytics |

- **Third-Party Advertising Cookies:** **NONE.** No marketing cookies or ad-network cookies are set by `memecapsule.wtf`.
- **Consent Banner Status:** Currently, `memecapsule.wtf` does **not** include a Cookie Consent Banner (CMP). Cookies are dropped upon initial page visit. *(See Section 6.2 for regulatory implications)*.

### 2.4 Newsletters, Waitlists & Marketing Pixels Audit
- **Newsletter Subscriptions:** **NONE.** There is no newsletter form, email subscription widget, or drip campaign provider (e.g. Mailchimp, ConvertKit, Beehiiv, Substack, Brevo, Sendgrid) active on the site.
- **Waitlist Forms:** **NONE.** The app is actively launched; no pre-launch waitlists exist.
- **Social Marketing Pixels:** **NONE.**
  - Meta (Facebook) Pixel: `NOT INSTALLED`
  - TikTok Pixel: `NOT INSTALLED`
  - Twitter / X Pixel: `NOT INSTALLED`
  - LinkedIn Insight Tag: `NOT INSTALLED`
  - Google Ads Remarketing (`AW-`): `NOT INSTALLED`

### 2.5 External CDNs & Third-Party Assets
- **Google Fonts CDN:** Preconnects to `fonts.googleapis.com` and `fonts.gstatic.com` to fetch the `Anton` and `Oswald` web fonts. Standard HTTP request metadata (IP address, user-agent) is processed by Google's CDN as part of delivering the font files.
- **Google Play Badge:** Renders static SVG assets linking outbound to the Google Play Store.

---

## 3. ANDROID MOBILE APPLICATION (`com.meme.capsule`) AUDIT

### 3.1 Advertising SDK (Google AdMob)
The production Android APK monetizes free-tier users through non-intrusive mobile ads using the official Capacitor AdMob plugin (`@capacitor-community/admob`).

- **Ad Types & Cadence:**
  - *Interstitial Ads:* Full-screen ad displayed once after every **4th completed meme drop**.
  - *Rewarded Ads:* Optional ads triggered solely when the user requests a "Bonus Drop" or "Multi-Drop".
- **Data Processed by AdMob SDK:**
  - Mobile Advertising ID (AAID / GAID) for ad personalization (unless user opted out in Android OS settings).
  - Approximate coarse location derived from IP address.
  - Crash reporting and ad diagnostic data (render time, viewability).
- **Pro Tier Exemption:** Users who purchase the one-time ₹99 Pro upgrade have AdMob SDK initialization completely disabled.

### 3.2 In-App Purchases & Billing (Google Play)
The Android application includes a native in-app purchase flow powered by `@capgo/native-purchases`.

- **Product Identifier:** `remove_ads_forever`
- **Pricing:** ₹99 (One-Time In-App Purchase)
- **Features Unlocked:** Lifetime zero ads, unlimited local vault storage, priority drop access.
- **Billing Security:** 100% processed through the **Google Play Billing Library**. Meme Capsule servers never handle, process, store, or transmit credit card numbers, billing addresses, or financial data.

### 3.3 Zero-Storage Media Saving (Android MediaStore Bridge)
Legacy Android apps demand broad `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` permissions, presenting intrusive system permission warnings to users.

Meme Capsule avoids this entirely using a custom native bridge in `MainActivity.java`:
- **API Mechanism:** Uses the **Android Scoped MediaStore API** (`MediaStore.Images.Media.EXTERNAL_CONTENT_URI`).
- **Android 10+ (API 29 to 35):** Writing an image directly to the public `Pictures/Meme Capsule` gallery requires **zero runtime permissions**.
- **User Experience:** Tapping `SAVE` or long-pressing (600ms) streams the image in the background and commits it to the gallery without requesting dangerous filesystem permissions.

### 3.4 Native Sharing (Android FileProvider Bridge)
When a user shares a meme to WhatsApp, Instagram, or Discord:
- The image is cached locally in the application's secure sandbox directory (`context.getCacheDir()`).
- A content URI is minted via **Android FileProvider** (`androidx.core.content.FileProvider`).
- The system launches the native Android `ACTION_SEND` intent sheet, ensuring clean sharing with no watermarks and no external server uploads.

### 3.5 Local Device Isolation (Meme Vault & Mood Boards)
- **Storage Location:** Browser `localStorage` and client SQLite inside the Capacitor WebView sandbox.
- **Items Stored:**
  - `meme_favorites`: Array of saved meme objects.
  - `mood_boards`: User-created thematic collections ("Pinned Energy").
  - `streak_data`: Days active and current rank (`FRESH` to `MEME GOD`).
  - `reported_memes`: Local blacklist of hidden memes.
- **Cloud Sync:** **NONE.** All vault memes and mood boards reside strictly on the user's phone. No cloud account or external database sync is currently performed.

### 3.6 Content Moderation & In-App Reporting
In compliance with Google Play User Generated Content (UGC) safety requirements:
- Every meme card exposes a content reporting modal (`ReportModal.tsx`).
- Submitting a report performs two actions:
  1. **Immediate Local Blacklist:** The meme URL is committed to `reported_memes` in local storage, guaranteeing it will never be rendered again for that user.
  2. **Upstream Report Transmission:** An HTTP POST request is sent to `/api/report` containing:
     - `meme_id` (Identifier of flagged item)
     - `reason` (`NSFW`, `Hate Speech`, `Harassment`, `Copyright`)
     - `device_id` (Client-generated SHA-256 hash, see Section 4.2)
     - `details` (Optional user description)

---

## 4. BACKEND TELEMETRY & EDGE DATA PROCESSING

### 4.1 Event Telemetry Queue (`/api/events`)
To understand meme quality and calculate virality/skip metrics, the application employs a silent background event pipeline:

```text
User Action (View, Skip, Like, Share, Download)
                  │
                  ▼
  AnalyticsQueue.enqueue() (Circular Memory Buffer, Max 200)
                  │
                  ├─► Flushed every 60 seconds
                  ├─► Flushed immediately if queue > 100
                  └─► Flushed on document.visibilityState === 'hidden'
                  │
                  ▼
  POST https://meme-capsule-eww.pages.dev/api/events
                  │
                  ▼
  Cloudflare D1 Batch Insert (meme_events table)
```

### 4.2 Client Device Anonymization (SHA-256 Hashing)
To prevent tracking users across visits or linking behavior to physical devices:
- The app generates a randomized client UUID on first launch (`crypto.randomUUID()`).
- Before transmitting telemetry to `/api/events` or `/api/report`, the UUID is hashed via:
  ```typescript
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawUuid));
  ```
- **Result:** Hardware identifiers (IMEI, MAC address, Android ID, Advertising ID) are **never** collected or stored in the backend database.

### 4.3 Cloudflare D1 Storage & Aggregation Metrics
Telemetric events in `meme_events` are aggregated by the background worker into `meme_analytics`:
- **Skip Rate:** Recorded when view duration is < 2,000 milliseconds.
- **Long View Rate:** Recorded when view duration is > 10,000 milliseconds.
- **Virality Score:** Ratio of shares and downloads to total impressions.
- **Engagement Rank:** Percentile distribution used internally for editorial curation.

---

## 5. THIRD-PARTY SUBPROCESSOR DIRECTORY

| Subprocessor | Purpose | Surface | Data Transferred | Privacy Policy |
|---|---|---|---|---|
| **Cloudflare Inc.** | Serverless hosting, D1 database, R2 media storage, CDN caching | Global Infrastructure | IP address, HTTP headers, telemetry events | [Cloudflare Privacy](https://www.cloudflare.com/privacypolicy/) |
| **Formspree Inc.** | Contact form email forwarding | `memecapsule.wtf` | Name, email address, message body | [Formspree Privacy](https://formspree.io/legal/privacy-policy) |
| **Google LLC (GA4)** | Website usage analytics | `memecapsule.wtf` | Anonymous browser telemetry, device type, country | [Google Privacy](https://policies.google.com/privacy) |
| **Google LLC (AdMob)** | In-app mobile advertising | Android App | Mobile Advertising ID (AAID), coarse IP location | [Google Partner Policy](https://policies.google.com/technologies/partner-sites) |
| **Google LLC (Play)** | App distribution & in-app purchases | Android App | Google Play account token, purchase state | [Google Play Terms](https://play.google.com/about/play-terms/) |
| **Reddit Inc.** | Secondary meme sourcing gateway (`meme-api.com`) | App Backend | None (Public read-only GET requests) | [Reddit Privacy](https://www.reddit.com/policies/privacy-policy) |

---

## 6. REGULATORY COMPLIANCE & APP STORE DECLARATIONS

### 6.1 Google Play Data Safety Form Guide
When submitting or updating Meme Capsule in the **Google Play Console**, use the following declarations:

1. **Does your app collect or share user data?**
   - Select: **YES**
2. **Is all of the user data collected by your app encrypted in transit?**
   - Select: **YES** (All traffic uses HTTPS/TLS).
3. **Do you provide a way for users to request that their data be deleted?**
   - Select: **YES** (Users can clear local data anytime by clearing app storage, and can email support for telemetry dissociation).
4. **Specific Data Types Collected:**
   - **Location:**
     - *Coarse location (approximate)*: Collected by Google AdMob SDK for ad serving. Ephemeral, not linked to user identity.
   - **Personal Info:**
     - *User IDs / Contact info*: None collected inside the app (only voluntarily on the website contact form).
   - **App Activity:**
     - *App interactions (Meme views, likes, shares, skips)*: Collected for Analytics and App Functionality. Anonymized via SHA-256 hash.
   - **Device or other IDs:**
     - *Advertising ID (AAID)*: Collected by Google AdMob SDK for ad delivery and fraud prevention.

### 6.2 GDPR & ePrivacy Assessment (EU/UK Visitors)
- **Current Status:** `memecapsule.wtf` loads Google Analytics (`_ga` cookies) prior to visitor consent.
- **Assessment:** Under the EU ePrivacy Directive and GDPR guidelines, non-essential analytics cookies require prior, affirmative, opt-in consent from European visitors.
- **Actionable Recommendation:**
  1. *Option A (Cookieless GA4):* Update the web GA4 snippet to disable cookie storage:
     ```javascript
     gtag('config', 'G-8VMD4ZNQQK', { client_storage: 'none' });
     ```
     This allows basic pageview telemetry without setting persistent tracking cookies.
  2. *Option B (Cookie Banner):* Add a lightweight Neo-Brutalist cookie consent modal with Accept/Decline options.

### 6.3 California Consumer Privacy Act (CCPA / CPRA)
- Meme Capsule does **not** sell or share personal information with third-party data brokers.
- AdMob displays ads compliant with restricted data processing (RDP) modes where applicable.

---

## 7. RECOMMENDED ENHANCEMENTS & ROADMAP ACTIONS

1. **Update `memecapsule.wtf/privacy` Copy:**
   - Add Formspree explicitly as a contact form subprocessor in Section 5 of the web privacy policy.
2. **GA4 Cookieless Optimization:**
   - Enable `client_storage: 'none'` on `memecapsule.wtf` to completely eliminate cookie consent overhead for EU compliance.
3. **Automate Markdown Doc Maintenance:**
   - In accordance with `AGENT_RULES.md`, coding agents must keep this document and companion architectural references synchronized whenever new third-party integrations, SDKs, or data pipelines are added.
## Live analytics privacy coverage

Live analytics exposes only aggregate counters and a feed projection containing allowlisted
event names, groups, receive times, app versions, and up to three scalar allowlisted
properties. It never returns user hashes, session IDs, raw property blobs, tokens, IP
addresses, or geographic data. `android_live_presence` is covered by the verified deletion
flow and 48-hour last-seen retention; minute and hourly rollups contain no user hashes.
