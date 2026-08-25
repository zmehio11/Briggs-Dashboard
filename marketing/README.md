# Briggs Marketing

A marketing dashboard for Briggs (Township). Separate app from the
operations dashboard (`../backend` + `../frontend`) — different purpose
(marketing/fractional-CMO function vs. sales/labor/COGS), different stack
(Next.js + Tailwind + Recharts, deployed as its own Vercel project), same
repo for convenience.

**Current status: Phase 1.** The dashboard renders on realistic, deterministic
mock data — every number is fake but internally consistent (the Health
Score is computed from the same numbers the detail pages show, not a
separate random figure). The **Marketing Engine** (content calendar
generator, review response drafts, campaign brief generator, community
outreach tracker, VIP CRM, weekly auto-report) described in the original
spec is **not built yet** — this phase is the dashboard + the integration
adapters, stubbed and ready to wire up one at a time.

## Quick start

```bash
npm install
npm run dev   # http://localhost:3000
```

Nothing needs an API key to run — every adapter defaults to mock data.

## Architecture: the adapter pattern

Every data source is its own module under `src/lib/adapters/`, each
exporting a small interface (e.g. `PosAdapter`, `SocialAdapter`) and a
`mock*Adapter` implementation that satisfies it. Pages import from
`src/lib/adapters/index.ts` — that's the **only** file you touch to go
live: implement the real client in the adapter's own file, then change
that one export from the mock to the real implementation. Nothing in
`src/app/**` needs to change, since it only ever depends on the shared
interface, not on where the data came from.

```
src/lib/
  types.ts             — shared domain types every adapter returns
  healthScore.ts        — composes the 60-second summary FROM the adapters
  mock/                — deterministic mock-data generators (seeded RNG)
  adapters/
    index.ts            — <- the one file you edit to swap mock for live
    pos.ts               (Toast)
    reservations.ts      (OpenTable / Resy)
    social.ts             (Meta + TikTok)
    email.ts              (Mailchimp/Klaviyo + Twilio/Attentive)
    reviews.ts             (Google Business Profile + Yelp)
    gbp.ts                  (Google Business Profile Performance API)
    attribution.ts          (composite — see below)
```

## What each integration needs

Copy `.env.example` to `.env.local` and fill in as you wire each one up.

### POS (Toast)

The Briggs **operations dashboard** (`../backend`) already has a working,
verified Toast integration for this exact restaurant —
`../backend/src/services/toastClient.ts` has the real auth flow and order
field mappings, hard-won against this account's actual API responses.
**Reuse it** rather than re-registering a second Toast app: either call
that backend's API from here over HTTP, or extract the shared client into
a package both apps import.

- `TOAST_CLIENT_ID` / `TOAST_CLIENT_SECRET` — Standard API access
  credentials, from Toast's developer portal or your Toast partner rep.
- `TOAST_RESTAURANT_GUID` — this restaurant's GUID (not the client ID —
  see the note in `../backend/README.md` if you mix them up like we did
  once already).

Feeds: Revenue & Covers, Customer Segments, Promo Performance.

### Reservations (OpenTable / Resy)

- `OPENTABLE_API_KEY` + `OPENTABLE_RESTAURANT_ID` — from OpenTable's
  Guest Center / partner API program (requires an approved partner
  application; self-serve keys aren't generally available).
- `RESY_API_KEY` — from Resy's partner API (also approval-gated).

Feeds: the "OpenTable" row in Marketing Attribution (booking-referral volume).

### Social: Meta (Instagram + Facebook)

Requires a Meta Developer app with **Instagram Graph API** access (not the
legacy Basic Display API — that one can't read business insights).

- Create an app at [developers.facebook.com](https://developers.facebook.com).
- OAuth scopes needed: `pages_read_engagement`, `pages_show_list`,
  `instagram_basic`, `instagram_manage_insights`, `business_management`.
- `META_PAGE_ACCESS_TOKEN` — a long-lived Page access token (exchange a
  short-lived user token for this; Page tokens don't expire unless the
  underlying user token is revoked).
- `META_INSTAGRAM_BUSINESS_ACCOUNT_ID` — the IG Business account linked to
  the Facebook Page (fetch via `GET /{page-id}?fields=instagram_business_account`).

Feeds: Social Media Performance.

### Social: TikTok

- Requires a TikTok for Business Developer account and app approval
  (TikTok's Business API access is manually reviewed, plan for a lead
  time here).
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` — from the TikTok for
  Business developer portal.
- `TIKTOK_ACCESS_TOKEN` — OAuth token scoped to `business.basic` +
  `video.list` + `video.insights` at minimum.

Feeds: Social Media Performance.

### Email (Mailchimp or Klaviyo)

Pick one — the adapter interface (`CampaignStat[]`) is the same either way.

- **Mailchimp**: `MAILCHIMP_API_KEY` (Account → Extras → API keys) +
  `MAILCHIMP_SERVER_PREFIX` (the `usX` suffix in your API key, e.g. `us21`).
- **Klaviyo**: `KLAVIYO_API_KEY` — a private API key with `campaigns:read`
  and `metrics:read` scopes.

Feeds: Email/SMS Campaign Performance.

### SMS (Twilio or Attentive)

- **Twilio**: `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` from the Twilio
  Console. Twilio itself doesn't track opens/clicks/redemptions the way a
  marketing platform does — you'd likely pair Twilio (send/delivery) with
  your own redemption-code tracking in the POS.
- **Attentive**: `ATTENTIVE_API_KEY` — a purpose-built SMS marketing
  platform, tracks campaign performance natively (closer fit for the
  open/click/redemption metrics this dashboard wants).

Feeds: Email/SMS Campaign Performance.

### Reviews: Google Business Profile

- Requires a Google Cloud project with the **Business Profile API**
  (formerly Google My Business API) enabled — access is manually granted
  by Google per project, budget a few days for approval.
- OAuth scope: `https://www.googleapis.com/auth/business.manage`.
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — from the Cloud
  project's OAuth consent screen.
- `GOOGLE_OAUTH_REFRESH_TOKEN` — obtained once via the OAuth consent flow,
  then used server-side to mint access tokens without re-prompting.
- `GOOGLE_BUSINESS_ACCOUNT_ID` / `GOOGLE_BUSINESS_LOCATION_ID` — identify
  this specific restaurant location within the Business Profile account.

Feeds: Review Sentiment Tracker (Google reviews) and Local Visibility
(profile views, search impressions, direction requests — this is the same
API, different endpoints).

### Reviews: Yelp Fusion

- `YELP_API_KEY` — free tier from
  [Yelp Fusion](https://fusion.yelp.com/) (self-serve, no approval wait).
- `YELP_BUSINESS_ID` — Briggs' Yelp business ID (visible in the Yelp
  business URL).
- Note: Yelp's Fusion API is **read-only for ratings/review counts** — it
  does not return full review text at scale, only a few excerpts. Full
  review text for reply drafting (Phase 2) would need Yelp's separate,
  more restricted Review Response API or manual export.

Feeds: Review Sentiment Tracker.

### Marketing Attribution (composite — no single vendor)

Unlike the others, `src/lib/adapters/attribution.ts` isn't backed by one
API. In practice it's built from:

1. **POS** — which promo code or UTM-tagged offer a check redeemed
   (requires a promo-code convention in Toast, e.g. one code per
   campaign).
2. **Reservations** — booking source (OpenTable's "Discover" traffic vs.
   direct).
3. **Ad platforms** — Meta Ads and Google Ads APIs for paid-channel spend
   and reported conversions.

This becomes either a small nightly ETL job that joins these on
date + channel into a table this adapter reads, or a live join across the
other adapters at request time. Decide the UTM/promo-code convention
*before* wiring this one — attribution is only as good as the tracking
discipline feeding it.

## Deploying

Not deployed yet. When ready, this is a standard Next.js app — deploy it
as its **own** Vercel project (separate from the ops dashboard's Vercel
project), pointing its root directory at `marketing/`, with the env vars
above set in that project's settings.

## What's next (Phase 2 — not built)

The Marketing Engine automation/content layer from the original spec:
content calendar generator, review response drafts, campaign brief
generator, local community outreach tracker, a simple CRM for repeat/VIP
customers, and the weekly auto-generated report. These weren't built in
this pass — ask for them once the dashboard + a few real adapters are
live, since several of them (review drafts, the weekly report) read from
the same adapters this phase already set up.
