# AP Food + FIF

A campus food pickup app for students, stall vendors and cafeteria administrators, backed by Supabase. Stalls, orders and payments in the demo project are fictional.

Docs: [product scope](docs/MVP.md), [engineering overview](docs/HANDOFF.md), [backend guide](docs/BACKEND.md) and [email setup](docs/EMAIL_SETUP.md).

## Run locally

Use Node.js 22 or later.

```sh
git clone https://github.com/cloudywalnut/APFood.git
cd APFood
npm ci
cp .env.example .env.local
# Add the server credentials shared privately by the project owner.
npm run dev
```

In Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Open http://localhost:3000; public browsing is available at `/app`, with sign-in at `/auth/login`. Accounts automatically open their student, vendor or admin workspace.

The tracked `.env` contains **public development defaults only**: the shared Supabase project URL, browser publishable key, project ref and local app origin. Your ignored `.env.local` overrides these values. Add `SUPABASE_SECRET_KEY` there for sign-in and protected server features, and `GEMINI_API_KEY` for Gemini-backed FIF. Obtain these privately from the project owner; they are not in GitHub. Do not add private keys or database passwords to the tracked `.env`.

For the existing shared project, the database, sample accounts and photos are already provisioned. **Do not run migration or seed commands just to start the app.** Ask the project owner for current sample logins. The sections below are for maintainers setting up a separate Supabase project; reseeding can reset shared catalogue data and fixture passwords.

Both `main` and `Keyaan` contain the shared implementation. See [the handoff](docs/HANDOFF.md), [menu photo setup](docs/MENU_IMAGES.md) and [order fulfilment checks](docs/ORDER_FULFILMENT_CHECK.md) for recent features and verification.

## Set up a Supabase project

See the [backend guide](docs/BACKEND.md) for the full steps. In short:

1. Put the project URL, publishable key, secret key, `DATABASE_URL` and project ref in `.env.local`.
2. Apply the schema and catalogue: `npx supabase@3 db push --remote="$DATABASE_URL" --include-seed`.
3. Create the demo accounts and order history: `npm run seed:demo-users`.

Demo data lives in [supabase/fixtures/](supabase/fixtures/): `demo-accounts.json` (accounts and shared password) and `demo-catalogue.json` (stalls and menu). `supabase/seed.sql` holds the same catalogue for fresh projects.

## Checks

| Command | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |
| `npm test` | Unit tests for order tracking, report export, login routing, preferences and traffic load |
| `npm run test:backend` | Runs the real SQL migrations in in-memory Postgres and tests policies, checkout, pickup, accounts and FIF |
| `npm run format` / `npm run format:check` | Format the code with Prettier, or check formatting |
| `npm run test:hosted` | Smoke test against the configured Supabase project (needs `AP_FOOD_HOSTED_SMOKE=1`) |

## Code map

| Area | Location |
| --- | --- |
| Routes | `app/[[...segments]]/page.tsx`, `app/api/[[...resource]]/route.ts`, `app/auth/callback/route.ts`, `proxy.ts` |
| Student, vendor and admin screens | `components/workspace/` |
| Storefront, map and shared UI | `components/storefront/`, `components/cafeteria/`, `components/ui/`, `components/shared.tsx` |
| API handlers and Supabase access | `lib/backend/` |
| Order, money and date helpers | `lib/orders.ts` |
| Database schema and seed | `supabase/migrations/`, `supabase/seed.sql`, `supabase/fixtures/` |
| Setup scripts | `scripts/seed-demo-users.mjs`, `scripts/bootstrap-admin.mjs`, `scripts/check-hosted.mjs` |

## Fonts

Roboto is served locally from `public/fonts/` with its licence file.
