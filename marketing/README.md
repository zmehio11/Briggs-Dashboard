# Briggs Marketing

A marketing dashboard for Briggs (Township). Separate app from the
operations dashboard (`../backend` + `../frontend`) — different purpose
(marketing/fractional-CMO function vs. sales/labor/COGS), different stack
(Next.js + Tailwind + Recharts, deployed as its own Vercel project), same
repo for convenience.

**Current status: Phase 2, in progress.** Revenue & Covers is **live**,
backed by the ops dashboard's Toast data (see "POS (Toast)" below).
Social Media Performance follower counts are **live** (Meta Graph API —
see "Social: Meta" below); reach/engagement/posts on that same page are
still mock. Customer Segments, Promo Performance, and everything on the
other 6 pages still render deterministic mock data — internally consistent (the Health
Score is computed from the same numbers the detail pages show, not a
separate random figure), but fake, until their adapters go live one at a
time the same way. The **Marketing Engine** (content calendar generator,
review response drafts, campaign brief generator, community outreach
tracker, VIP CRM, weekly auto-report) described in the original spec is
**not built yet** — that starts once every adapter here is real.

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

### POS (Toast) — LIVE

Revenue & Covers calls the Briggs **operations dashboard's** own API
(`GET /api/daily-sales` on `../backend`) rather than talking to Toast
directly — that backend already has a working, verified Toast integration
for this exact restaurant (`../backend/src/services/toastClient.ts`, hard-won
against this account's actual API responses), so there was no reason to
re-implement Toast auth here.

- `OPS_BACKEND_URL` — defaults to the deployed backend's Railway URL;
  only override this if that backend moves.
- No Toast credentials needed in *this* app.

**Still mock** within `pos.ts`: `getCustomerSegments()` and
`getPromoPerformance()`. Both need data the ops backend doesn't track
yet — per-guest identity for new/repeat/VIP segmentation, and promo-tagged
sales for baseline-vs-during uplift. Wiring these for real is new work on
`../backend`'s Toast integration (guest profiles, a promo-code convention
in Toast), not just a new adapter call here.

Feeds: Revenue & Covers, Customer Segments, Promo Performance.

### Reservations (OpenTable / Resy)

- `OPENTABLE_API_KEY` + `OPENTABLE_RESTAURANT_ID` — from OpenTable's
  Guest Center / partner API program (requires an approved partner
  application; self-serve keys aren't generally available).
- `RESY_API_KEY` — from Resy's partner API (also approval-gated).

Feeds: the "OpenTable" row in Marketing Attribution (booking-referral volume).

### Social: Meta (Instagram + Facebook) — PARTIALLY LIVE

Follower counts are real. Requires a Meta Developer app with **Instagram
Graph API** access (not the legacy Basic Display API — that one can't read
business insights), and the Instagram account must be a Business/Creator
account **linked to a Facebook Page** (a hard requirement of the Instagram
Graph API — Briggs didn't have a Page originally, so one was created and
linked via the Page's own Settings → Linked Accounts; Accounts Center's
"Add accounts" flow looked like it linked them but didn't actually connect
at the API level).

- App created at [developers.facebook.com](https://developers.facebook.com)
  with the "Manage messaging & content on Instagram" and "Manage everything
  on your Page" use cases — no App Review needed, since this only ever reads
  Briggs' own Page/IG account, not other businesses' data.
- `META_PAGE_ACCESS_TOKEN` — a long-lived Page access token (generated via
  Graph API Explorer: get a User token with `pages_read_engagement`,
  `pages_show_list`, `instagram_basic`, `instagram_manage_insights`,
  `business_management`, extend it via the Access Token Debugger's "Extend
  Access Token" button, then call `me/accounts` to get the Page's own
  token). Expires in ~60 days — will need periodic renewal, or upgrading to
  a Business Manager System User token for one that doesn't expire.
- `META_FACEBOOK_PAGE_ID` / `META_INSTAGRAM_BUSINESS_ACCOUNT_ID` — from
  that same `me/accounts` call and a follow-up
  `GET /{page-id}?fields=instagram_business_account` once the Page and IG
  account are linked.

**Still mock:** follower delta, reach, engagement rate, and posts count
(`social.ts` returns `null` for these rather than fake numbers) — real
values need the Instagram/Facebook **Insights API**, which wasn't wired up
blind since its metric names have a real history of breaking changes
across API versions (`impressions` was deprecated for many accounts, for
instance). Worth live-testing against Briggs' actual account before
trusting it, the same way follower counts were verified here. `getPostTrend`
(the reach-by-platform chart) is fully mock for the same reason.

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
