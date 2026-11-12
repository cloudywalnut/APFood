# AP Food + FIF

A campus food pickup app for students, stall vendors and cafeteria administrators, backed by Supabase. Stalls, orders and payments in the demo project are fictional.

Docs: [product scope](docs/MVP.md), [engineering overview](docs/HANDOFF.md), [backend guide](docs/BACKEND.md) and [email setup](docs/EMAIL_SETUP.md).

## Run locally

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

Open http://localhost:3000. `/` is the sign-in page and `/welcome` is the public landing page. In development, the sign-in page lists the seeded demo accounts; click one to fill in its email and password. The list is not included in production builds.

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
