# Cultory 🏛️

Multi-tenant platform that digitizes, preserves and monetizes intangible cultural heritage.
Hybrid revenue model: **B2G** heritage digitization packages (€15k–€25k), **B2B** data-API
subscriptions (€500–€2,000/mo) and a **B2B2C** experience marketplace (25% platform fee).

## Stack

- **Frontend**: Vite · React 18 · TypeScript · Recharts — glassmorphism purple theme
- **Backend**: Node.js · Express · TypeScript · Zod validation
- **Database**: SQLite via the built-in `node:sqlite` driver (zero native deps)
- **Auth**: JWT in HttpOnly `SameSite=Lax` cookies for the web app, Bearer tokens for API clients, hashed API keys (`cul_live_…`, shown once) for partners

## Quick start

```bash
npm install          # installs root tooling
npm run install:all  # installs server + client deps
npm run dev          # API on :4000, web on :5173
```

The database auto-seeds on first boot (`server/data/cultory.db`).
Reseed anytime with `npm run seed` (add `-- --force` to wipe).

## Deployment (Vercel)

Live: **https://cultory.vercel.app**

Single Vercel project serves both halves:

- **Frontend** — static Vite build (`client/dist`) with SPA rewrites.
- **API** — `api/index.mjs` wraps the compiled Express app (`server/dist/app.js`)
  as a serverless function; `/api/*` is rewritten to it. SQLite runs via the
  better-sqlite3 prebuilt binary (auto-fallback to Node's built-in driver).

Deploy from the CLI:

```bash
vercel link && vercel env add JWT_SECRET production   # once
vercel deploy --prod
```

> **Ephemeral data notice:** serverless instances keep their own temp SQLite copy
> seeded deterministically, so all demo content (tours, stories, dashboards) is
> identical and browsable everywhere — but *new* writes (bookings, saved stories,
> API keys) can disappear when instances recycle. For durable state, point the DB
> layer at a hosted libSQL/Turso instance or move the API to a host with a
> persistent disk.

## Demo accounts (password `cultory123`)

| Role | Email | Lands on |
|---|---|---|
| Super Admin | admin@cultory.eu | /dashboard |
| Municipality (B2G) | metsovo@cultory.eu | /dashboard |
| Enterprise / OTA (B2B) | partners@getyourguide.example | /developers |
| Elder contributor | maria@elders.cultory.eu | /elder |
| Certified guide | elena@cultory.eu | /elder |

## Modules

| Module | Route | Notes |
|---|---|---|
| Elder Story Studio | `/elder` | Tablet-first high-contrast UI, mock voice→ASR→translate→structure pipeline |
| Municipal Dashboard | `/dashboard` | KPIs, footfall/demographics/revenue charts with 3/6/12-month filters, package activation |
| Developer Portal | `/developers` | Tiered SaaS plans, key generation/revocation, live sandbox tester |
| Marketplace | `/marketplace` | Tour browsing, story-stop timelines, booking + mock checkout (test card `4242 4242 4242 4242`) |

Partner data API (requires API key): `GET /api/v1/stories`, `/api/v1/itineraries`, `/api/v1/municipalities`.

## Project layout

```
server/src
├── index.ts            Express app & route mounting
├── db.ts               node:sqlite schema + helpers
├── auth.ts             JWT cookie/Bearer auth, role guard, API-key guard
├── seed-run.ts         Deterministic demo data (users, stories, tours, 12 months of bookings)
└── routes/
    ├── auth.ts         register/login/me/logout (Zod validated)
    ├── interview.ts    Mock AI interviewer prompts + transcribe/translate/structure pipeline
    ├── stories.ts      Story CRUD with validation
    ├── dashboard.ts    Aggregated stats (range-filtered) + B2G package engine
    ├── dev.ts          API tiers, key lifecycle
    ├── marketplace.ts  Tours, stops, bookings
    ├── payments.ts     Mock gateway, 25% fee split transactions
    └── v1.ts           Public partner data API

client/src
├── App.tsx             Auth context, protected routes by role
├── components/Layout   Glass navbar w/ role-aware links
└── pages/              Landing, Login, Register, Dashboard, ElderPortal,
                        DevPortal, Marketplace, TourDetail
```
