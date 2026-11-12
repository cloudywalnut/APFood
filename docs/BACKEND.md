# AP Food backend

Supabase holds all data: accounts, roles, stalls, menus, carts, orders, pickup windows, payments, the ledger and the audit trail. Business rules (checkout, capacity, stock, fulfilment, pickup codes, receipts) run as Postgres functions in `supabase/migrations/`, protected by row-level security. The Next.js API in `app/api/[[...resource]]/route.ts` and `lib/backend/` is the only way the UI reads and writes data.

## Set up a Supabase project

Use a dedicated project for demo data.

1. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` and `AP_FOOD_DEMO_PROJECT_REF`.
2. In the Supabase dashboard, open **Connect → Session pooler** and store the PostgreSQL URL as `DATABASE_URL`. URL-encode reserved characters in the password and add `?sslmode=require`.
3. Apply the schema and catalogue. In PowerShell:
   ```powershell
   $env:DATABASE_URL = node --env-file=.env.local -p "process.env.DATABASE_URL"
   npx supabase@3 db push --remote="$env:DATABASE_URL" --dry-run       # review first
   npx supabase@3 db push --remote="$env:DATABASE_URL" --include-seed
   ```
4. Run `npm run seed:demo-users`. It syncs the catalogue from `supabase/fixtures/demo-catalogue.json`, creates the accounts in `supabase/fixtures/demo-accounts.json` with their shared password, removes fixture accounts that are no longer listed, and loads 14 days of order and ledger history. Re-running re-syncs the catalogue and passwords; history loads only once.
5. In **Realtime → Settings**, allow private channels only. Live order updates use private channels; open order views also poll, so missed broadcasts recover.
6. Set `AP_FOOD_APP_ORIGIN` to the exact browser origin when a hosting proxy changes the request URL.
7. For email (sign-up confirmation, recovery, invitations), follow [EMAIL_SETUP.md](EMAIL_SETUP.md). Seeded accounts are already confirmed, so the app works without it.

`npm run bootstrap:admin` promotes `AP_FOOD_BOOTSTRAP_ADMIN_EMAIL` to administrator. It refuses to run once an admin exists. The seed script already creates an admin, so it is only needed for projects seeded without fixtures.

## Requests and errors

Browser requests authenticate with the Supabase session cookie, which `proxy.ts` refreshes. Cookie-authenticated mutations must come from the app origin. Workspace requests send `X-AP-Food-User` so the API can reject stale requests after an account switch. Scripts may use a Supabase bearer token instead. Private responses use `Cache-Control: no-store`. Errors return `{ error: { code, message, requestId } }`.

Sign-in, sign-up and recovery are rate limited per IP address in the database. This, account administration and checkout recovery use `SUPABASE_SECRET_KEY` on the server.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST/GET/DELETE /api/auth/session` | Sign in with `{ email, password }`, read the session and memberships, or sign out. |
| `POST /api/auth/register`, `/resend`, `/recover`, `/profile` | Sign-up, resend confirmation, password recovery, and profile, email or password changes. |
| `GET /api/zones`, `/api/vendors`, `/api/catalogue`, `/api/deals`, `/api/vendors/:id/menu` | Published stalls, menus, promotions and food courts. |
| `GET /api/traffic/zones` | Pickup windows per stall with booked work units and capacity. Measures app activity, not physical crowds. |
| `GET/PUT /api/cart` | Signed-in cart with revision checks. |
| `POST /api/checkout/quote` | `{ vendorId, items }` returns `quoteId`, priced lines, `totalSen` and feasible pickup `slots`. |
| `POST /api/orders` | `{ quoteId, pickupAt, payment, idempotencyKey }` with payment `demo`, `counter` or `duitnow_qr`. Retry with the same key and payload. |
| `POST /api/checkout/basket` | Places one order per stall from a multi-stall basket in a single transaction. |
| `GET /api/orders`, `/api/orders/:id` | The student's orders and order detail. |
| `POST /api/orders/:id/cancel` | Cancels an owned active order, including preparing/ready. Only unused stock/work is released; paid QR orders become refund pending. |
| `POST /api/orders/:id/pickup-token` | Issues a five-minute, eight-digit pickup code for a ready order. QR and manual collection use the same one-time code. |
| `GET /api/orders/:id/payment`, `POST /api/orders/:id/payment-claim`, `POST /api/orders/:id/refund` | QR payment status, the student's "I've paid" claim, and refund recording. |
| `GET /api/vendors/:id/payment`, `POST /api/vendor/payments/:id` | A stall's merchant QR, and the vendor's QR upload. |
| `GET /api/vendor/stalls`, `/api/vendor/orders`, `/api/vendor/menu-items`, `/api/vendor/report` | The vendor's assigned stalls, kitchen board, menu and report. |
| `POST /api/vendor/orders/:id/transition`, `/collect` | Move an order forward (or reject with a reason), and collect it with `{ code, counterConfirmed }`. |
| `POST /api/vendor/menu-items`, `PATCH /api/vendor/capacity/:id` | Save a menu item (send the stock you read as `expectedStock`) and update capacity, lead time, hours or pause. |
| `GET /api/admin/report`, `/api/admin/orders`, `/api/admin/audit` | Finance, products, vendors, orders and the audit trail. Periods are 1, 7 or 14 days. |
| `PATCH /api/admin/vendors/:id` | Approve or suspend a stall and assign its food court. |
| `POST /api/admin/expenses`, `/api/admin/expenses/:id/reverse` | Record an expense, or reverse it once with a reason. |
| `GET /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/invite` | Search users, change status and roles, and invite staff. |
| `POST /api/fif/recommendations` | `{ role, vendorId?, zoneId? }` returns one recommended action for the caller's scope. |

## Behaviour notes

- Capacity is counted in work units per 15-minute pickup window. Each stall sets its capacity; each menu item has a work-unit cost.
- Cancelling before preparation releases stock and capacity. After preparation both stay consumed.
- A receipt is recorded once, at collection, for the original order total.
- QR checkout reserves stock and capacity and allows five minutes for payment. The "I've paid" claim is a demonstration mechanism, not bank verification. A scheduled job (`pg_cron`, every minute) expires unpaid QR orders.
- Guest carts live in browser storage. On sign-in they move to the account cart, or the student chooses which to keep when both exist. The pending checkout attempt is kept in session storage so a lost response can be retried safely.
- FIF builds candidate actions from live data on the server. Rules choose by default. With `GEMINI_API_KEY` set, Gemini breaks ties between equally ranked actions (five-second timeout, 30-second cache, 12 calls per user per hour) and may only pick from the server's candidates.
- Student FIF AI chat (`POST /api/fif/student/chat`, students only) uses `lib/backend/fif-chat-runtime.ts` to select providers and `lib/backend/fif-agent.ts` for tool calling. `FIF_CHAT_PROVIDER=gemini` or `openai` uses only that provider; `auto` (default) tries configured Gemini then configured OpenAI on failure. `GEMINI_MODEL` and `OPENAI_MODEL` are server-only configuration; the OpenAI default is `gpt-6-luna`. A configured invalid key cannot suppress a working provider in auto mode. Explicit modes never contact the other provider.
- The model only calls the read-only student tools in `lib/backend/student-fif-chat.ts` (orders, order details, menu search, stalls, pickup availability, cart). Tools use the student's own Supabase session, so row-level security still applies. Common questions use those same tools directly; completed tool data can also supply a grounded answer after model failure (`student-fif-answers.ts`). Limits: up to four model turns per provider plus one bounded initial Gemini 502/503 retry, four tool executions per turn, 20 seconds across lookup/provider attempts, at most 18 seconds per Gemini request or 10 seconds per OpenAI request, the last 5 exchanges of history and 100 questions per student per hour. The client waits at most 25 seconds. Every model tool call receives a matching result even when it exceeds the execution limit. Outages give a useful greeting or navigation fallback without inventing private data. Logs contain provider names and safe status/error codes, not keys, questions or tool results.

## Tests

- `npm run test:backend` runs the migrations and seed in in-memory Postgres (PGlite) with stand-ins for Supabase Auth and Realtime. It covers role policies, stock and capacity conflicts, retries, promotion pricing, pickup replay, the ledger, accounts, baskets and FIF ranking.
- `npm run test:hosted` runs concurrent checkout and pickup against the configured project. Set `AP_FOOD_HOSTED_SMOKE=1` only on a disposable demo project; it places and cancels fictional orders.
