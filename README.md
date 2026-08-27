# Briggs Restaurant — Sales / Labor / COGS Dashboard

A hosted dashboard that syncs data nightly from **Toast POS** (sales), **Push Operations**
(labor), **MarginEdge** (cost of sales), and **QuickBooks Online** (operating
expenses), stores it in Postgres, and shows labor/COGS/opex-vs-sales trends
by **week / month / year**.

## Why it's built this way

This can't run as a single static page — it needs somewhere to hold state (so
"weekly" and "yearly" views don't require re-pulling a year of data from three
APIs every time you load the page) and somewhere to run a nightly job that
pulls new data even when nobody has the dashboard open. So it's two pieces:

- **`backend/`** — Node.js + TypeScript API. A scheduled job pulls yesterday's
  sales, labor, and COGS data from each vendor every night, normalizes it,
  and upserts it into Postgres. A small REST API then serves pre-aggregated
  weekly/monthly/yearly numbers to the frontend.
- **`frontend/`** — React dashboard (Vite) that charts labor % of sales, COGS
  (food cost) % of sales, and prime cost %, with a period toggle.

## Before you run this

The three vendor API clients (`backend/src/services/*Client.ts`) are built
against each platform's *documented* auth pattern and typical reporting
endpoints, but **all three vendors version-gate and contract-gate their
APIs** — the exact endpoint paths and field names available to your account
depend on your specific API agreement with each vendor. Every client has
`// VERIFY:` comments marking the spots to check against your own developer
portal docs (Toast: `doc.toasttab.com`, Push Operations: your Push API docs,
MarginEdge: your MarginEdge partner API docs) once you plug in real
credentials — I couldn't call these APIs live to confirm exact field names
since they're not reachable from this environment.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env      # fill in DB + API credentials
npm install
npx prisma migrate dev --name init
npm run dev                # starts API on :4000 + registers the nightly cron

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                # starts on :5173, proxies /api to :4000
```

## Deploying it as a hosted web app

Simplest path:

1. **Backend + Postgres → Railway or Render.** Both give you a Postgres
   instance and a place to run a long-lived Node process (needed for the
   cron job — this won't work on a serverless platform that spins down
   between requests, like Vercel functions, unless you move the sync job to
   a separate scheduled job/cron trigger on that platform instead).
2. **Frontend → Vercel or Netlify**, pointed at the backend's public URL via
   `VITE_API_URL`.
3. Set the vendor credentials and `DATABASE_URL` as environment variables on
   the backend host — never commit `.env`.
4. Toast, Push Operations, and MarginEdge all only allow listed IPs / OAuth
   redirect URLs in some tiers — check whether your API agreement requires
   allow-listing the backend host's outbound IP.

For iterating on this further (wiring exact field mappings once you've
confirmed them against your live API access, testing the sync jobs against
real data, and actually deploying it), **Claude Code** is a better fit than
this chat — it can run the dev servers, hit your real APIs, and push to your
hosting provider directly.

## QuickBooks Online (operating expenses)

Unlike Toast/Push/MarginEdge, QuickBooks uses OAuth2 (log in and authorize)
rather than a static API key, since it's scoped to whichever real company
the owner connects — there's no vendor-issued credential to just paste in.

- Create a Production app at [developer.intuit.com](https://developer.intuit.com)
  (Development/sandbox keys only talk to Intuit's fake test company, not real
  books). Set `QUICKBOOKS_CLIENT_ID` / `QUICKBOOKS_CLIENT_SECRET` from its
  Production keys.
- Register `{backend URL}/api/quickbooks/callback` under that app's
  **Production** Redirect URIs (Keys & OAuth → Production tab) — must match
  exactly, and Development/Production keep separate redirect-URI lists.
- Visit `GET /api/quickbooks/connect` in a browser, log into the real QBO
  company, and authorize. The connection (refresh token + company/realm ID)
  is stored in Postgres (`QuickbooksConnection`), not an env var, since the
  refresh token rotates on every use.
- `GET /api/quickbooks/sync-now` triggers an immediate sync (useful right
  after connecting) instead of waiting for the nightly cron.
- Pulls the Profit & Loss report's **Expenses** section only — COGS stays
  MarginEdge's job — summarized by month into `MonthlyExpense`.

## Data model

- `DailySales` — one row per business date: gross sales, net sales, order count
- `DailyLabor` — one row per business date: regular/OT hours, total labor cost, headcount
- `DailyCogs` — one row per business date + category: COGS amount (food, beverage, etc.)
- `MonthlyExpense` — one row per calendar month + QuickBooks account category: operating expense amount
- `QuickbooksConnection` — the OAuth connection (realm ID, access/refresh tokens)
- `SyncLog` — audit trail of each nightly sync run (source, status, rows written)

Weekly/monthly/yearly aggregation happens in the API layer (`backend/src/routes/dashboard.ts`),
grouping daily rows by ISO week / calendar month / calendar year, and computing:

- **Labor %** = total labor cost ÷ net sales
- **COGS %** (food cost %) = total COGS ÷ net sales
- **Prime cost %** = (labor cost + COGS) ÷ net sales — the standard restaurant
  health metric; most operators target 55–65% combined.
