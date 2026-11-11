# AP Food backend · Initial implementation

The Supabase migrations and HTTP API cover seeded roles, catalogue, checkout, vendor fulfilment, pickup, audit, the demo ledger, and aggregate pickup activity. The default frontend mode uses browser fixtures. Set `AP_FOOD_DATA_MODE=supabase` for the hosted student, vendor, and admin screens. Both modes use the same public routes and visual shells.

## Connect the hosted demo

1. Use a dedicated Supabase project for fictional data. Copy `.env.example` to `.env.local` if needed. In the dashboard, open **Connect** and choose **Session pooler** for an IPv4 connection. Store its PostgreSQL URL as `DATABASE_URL` in `.env.local`. URL-encode reserved characters in the password and use `sslmode=require`. In PowerShell, load the value with `$env:DATABASE_URL = node --env-file=.env.local -p "process.env.DATABASE_URL"`. Preview the pending migrations with `npx supabase@3 db push --remote="$env:DATABASE_URL" --dry-run`. Review the target and migration list, then apply with `npx supabase@3 db push --remote="$env:DATABASE_URL" --include-seed`.
2. In `.env.local`, configure the project URL, publishable key, and server-only `SUPABASE_SECRET_KEY`. Run `npm run seed:demo-users` in the dedicated demo project. Generated sample passwords are saved in ignored `.env.demo-users.json`; repeat runs preserve existing passwords. The runtime uses the server secret for restricted Auth administration and rate limiting; it must never be exposed to browser code. Set `AP_FOOD_APP_ORIGIN` to the exact origin used by the browser.
3. Enable private-only Realtime channels in the demo project. Set `AP_FOOD_DATA_MODE=supabase` and start Next.js with `npm run dev`. Enable `AP_FOOD_HOSTED_SMOKE=1` only on a disposable demo project, then run `npm run test:hosted`. The script places and collects fictional orders and fails if unused test orders cannot be cancelled.
4. Open three separate browser profiles or contexts and sign in as the seeded student, vendor, and admin. Place a counter order, move it to ready in the kitchen, then collect it with the student's code and check the admin cashflow ledger. Separate profiles keep the three Supabase cookie sessions independent.

## API contract

Browser requests use a Supabase session cookie. Use the app origin for cookie-authenticated mutations. Hosted workspace requests include `X-AP-Food-User` so the API can reject stale requests after an account switch. The hosted smoke script uses verified Supabase bearer tokens. Responses use JSON and private data is served with `Cache-Control: no-store`. Errors return `{ error: { code, message, requestId } }`.

| Endpoint | Input or scope |
| --- | --- |
| `POST /api/fif/recommendations` | `{ role, vendorId?, zoneId? }`; authenticated, active verified membership required. Vendor requests require an assigned stall. Returns server-owned evidence, action link, and `rules` or `gemini` source. |
| `POST /api/auth/session` | `{ email, password }` returns the user ID and database memberships. GET reads the session and DELETE signs out. |
| `GET /api/vendors`, `GET /api/vendors/:id/menu`, `GET /api/zones` | Published demo catalogue. Menu records include regular price, discount, stock, and work units. |
| `POST /api/checkout/quote` | `{ vendorId, items: [{ itemId, quantity, extra }] }` returns `quoteId`, `expiresAt`, `slots`, priced lines, and `totalSen`. Slots use ISO timestamps. |
| `POST /api/orders` | `{ quoteId, pickupAt, payment, idempotencyKey }`, with payment `demo` or `counter`. Reuse the same key and payload on network retries. Use a new quote and key for changed selections. |
| `GET /api/orders`, `GET /api/orders/:id`, `GET /api/vendor/orders?vendorId=…` | Scoped student history, order detail, and kitchen board. |
| `POST /api/orders/:id/cancel`, `POST /api/vendor/orders/:id/transition` | Cancellation or forward-only stage change. Staff provide a reason when rejecting or cancelling. |
| `POST /api/orders/:id/pickup-token`, `POST /api/vendor/orders/:id/collect` | Owner issues a five-minute code. Staff submit `{ code, counterConfirmed }`. Keep the raw code in the student view’s memory. |
| `GET /api/vendor/stalls`, `GET /api/vendor/menu-items?vendorId=…`, `POST /api/vendor/menu-items`, `PATCH /api/vendor/capacity/:id` | Assigned stall management. Send the previously read stock as `expectedStock` when saving an existing item. |
| `PATCH /api/admin/vendors/:id`, `GET /api/admin/audit` | Admin stall management and audit trail. |
| `GET /api/admin/report?days=7&zoneId=…&vendorId=…` | Admin finance, ledger, products, and vendor aggregates. Supported periods are 1, 7, and 14 days. |
| `POST /api/admin/expenses`, `POST /api/admin/expenses/:id/reverse` | Record a paid demo expense with an idempotency key, or reverse it once with a reason. |
| `GET /api/traffic/zones` | Per-stall pickup buckets, committed work units, and capacity. The response identifies its source as app pickup activity. |

For a new server-backed order, represent the pickup window with its actual timestamp. Retain the browser cart while refreshing expired quotes, and use the backend price snapshot for the order summary. In the current SQL, cancelling after preparation keeps consumed stock and booked capacity. Pre-prep cancellation releases both. The receipt is recognised at collection and uses the original order total.

## Verification and next integration

`npm run test:backend` runs the actual SQL migrations in embedded Postgres with minimal Supabase Auth and Realtime schema stand-ins. It checks role policies, stock and capacity conflicts, exact retries, promo pricing, pickup replay and the ledger. `npm run test:hosted` adds concurrent HTTP checkout and redemption against the configured project. Verify real browser sessions and WebSocket subscriptions on the hosted preview. Open order views also refresh periodically to recover from missed broadcasts.

Signed-in carts persist in Supabase with owner isolation and revision checks. Guest carts use local storage; an existing account cart requires an explicit import choice. Cart saves emit a local-storage invalidation marker to refresh other tabs; focus and visibility changes also refetch. Only the exact pending checkout attempt stays in per-account session storage. After a lost response, retry that saved request in the same tab. Pickup codes stay in view memory. See [EMAIL_SETUP.md](EMAIL_SETUP.md) for SMTP and Auth template activation, [verification results](VERIFICATION.md) for checked flows, and the [backend delivery plan](BACKEND_PLAN.md) for remaining delivery gates.

## Rehearse traffic locally

Run `npm run simulate:traffic -- light`, `npm run simulate:traffic -- medium`, or `npm run simulate:traffic -- heavy`. Each command creates a fresh in-memory database from the checked-in migrations and fictional seed. The report shows the pickup bucket before collection, requests accepted or declined, reroutes, the next quoted pickup, and the simulated receipt posted through vendor fulfilment.

Heavy submits 12 prequoted requests to a five-unit window, reroutes three of the seven conflicts, and places one comparison order at Brew & Bites. The embedded database processes requests in sequence. Use the hosted HTTP smoke test for concurrent checkout. Local results are emitted to the terminal and discarded with the database at exit.

For the UI walkthrough, start the mock app on loopback with the local lab enabled.

```powershell
$env:AP_FOOD_LOCAL_TRAFFIC_LAB = '1'
npm run dev -- --hostname 127.0.0.1
```

Open **Admin → Traffic → Traffic Lab** and run a scenario. Lab results stay in the panel and are separate from the browser scenario that the three demo portals share. The lab endpoint is available only in opted-in local development.
