# AP Food backend · Initial implementation

The Supabase migrations and HTTP API cover seeded roles, catalogue, checkout, vendor fulfilment, pickup, audit, the demo ledger, and aggregate pickup activity. The existing screens currently use the browser demo. `lib/backend/client.ts` provides the typed client for the frontend integration, and `lib/backend/realtime.ts` provides private order invalidations with a scoped refetch fallback.

## Connect the hosted demo

1. Create a dedicated Supabase project for fictional data. In a terminal with project access, run `npx supabase login`, then `npx supabase link --project-ref <demo-project-ref>`. Preview the pending migration list with `npx supabase db push --dry-run`, then apply it with `npx supabase db push --include-seed`.
2. Copy `.env.example` to `.env.local`. Configure the project URL and publishable key. Set the bootstrap values for this project and run `npm run seed:demo-users` once. The script prints the fixture emails and roles. Keep the secret key and fixture password in local bootstrap configuration. Only the project URL, publishable key, and optional browser origin are used by the application runtime.
3. Enable private-only Realtime channels in the demo project. Start Next.js with `npm run dev`. Enable `AP_FOOD_HOSTED_SMOKE=1` only on a disposable demo project, then run `npm run test:hosted`. The script places and collects fictional orders and attempts to cancel unused test orders.

## API contract

Browser requests use a Supabase session cookie. Use the app origin for cookie-authenticated mutations. The hosted smoke script uses verified Supabase bearer tokens. Responses use JSON and private data is served with `Cache-Control: no-store`. Errors return `{ error: { code, message, requestId } }`.

| Endpoint | Input or scope |
| --- | --- |
| `POST /api/auth/session` | `{ email, password }` returns the user ID and database memberships. GET reads the session and DELETE signs out. |
| `GET /api/vendors`, `GET /api/vendors/:id/menu`, `GET /api/zones` | Published demo catalogue. Menu records include regular price, discount, stock, and work units. |
| `POST /api/checkout/quote` | `{ vendorId, items: [{ itemId, quantity, extra }] }` returns `quoteId`, `expiresAt`, `slots`, priced lines, and `totalSen`. Slots use ISO timestamps. |
| `POST /api/orders` | `{ quoteId, pickupAt, payment, idempotencyKey }`, with payment `demo` or `counter`. Reuse the same key and payload on network retries. Use a new quote and key for changed selections. |
| `GET /api/orders`, `GET /api/orders/:id`, `GET /api/vendor/orders?vendorId=…` | Scoped student history, order detail, and kitchen board. |
| `POST /api/orders/:id/cancel`, `POST /api/vendor/orders/:id/transition` | Cancellation or forward-only stage change. Staff provide a reason when rejecting or cancelling. |
| `POST /api/orders/:id/pickup-token`, `POST /api/vendor/orders/:id/collect` | Owner issues a five-minute code. Staff submit `{ code, counterConfirmed }`. Keep the raw code in the student view’s memory. |
| `GET /api/vendor/menu-items?vendorId=…`, `POST /api/vendor/menu-items`, `PATCH /api/vendor/capacity/:id` | Assigned stall management. Send the previously read stock as `expectedStock` when saving an existing item. |
| `PATCH /api/admin/vendors/:id`, `GET /api/admin/audit` | Admin stall management and audit trail. |
| `GET /api/admin/report?days=7&zoneId=…&vendorId=…` | Admin finance, ledger, products, and vendor aggregates. Supported periods are 1, 7, and 14 days. |
| `POST /api/admin/expenses`, `POST /api/admin/expenses/:id/reverse` | Record a paid demo expense with an idempotency key, or reverse it once with a reason. |
| `GET /api/traffic/zones` | Per-stall pickup buckets, committed work units, and capacity. The response identifies its source as app pickup activity. |

For a new server-backed order, represent the pickup window with its actual timestamp. Retain the browser cart while refreshing expired quotes, and use the backend price snapshot for the order summary. In the current SQL, cancelling after preparation keeps consumed stock and booked capacity. Pre-prep cancellation releases both. The receipt is recognised at collection and uses the original order total.

## Verification and next integration

`npm run test:backend` runs the actual SQL migrations in embedded Postgres with minimal Supabase Auth and Realtime schema stand-ins. It checks role policies, stock and capacity conflicts, exact retries, promo pricing, pickup replay and the ledger. `npm run test:hosted` adds concurrent HTTP checkout and redemption against the linked environment. Verify real browser sessions and WebSocket subscriptions on the hosted preview.

After connecting the hosted project, wire the student checkout and tracking plus the vendor kitchen to the typed client first. Then connect admin reads and writes, implement isolated Light/Medium/Heavy runs, and add the Gemini ranker. The [current MVP](MVP.md) defines those later gates.
