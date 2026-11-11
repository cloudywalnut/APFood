> Current UI: see [UI_PRESENTATION_CLEANUP.md](UI_PRESENTATION_CLEANUP.md) and [LATEST_UI_UPDATE.md](LATEST_UI_UPDATE.md). The basket supports multiple stalls, browsing starts on the map, and the UI uses the cream/gold/espresso theme. Backend development remains on Keyaan.

# AP Food + FIF · Engineering and AI handoff

AP Food is a campus pickup prototype for students, food-stall staff, and cafeteria administrators. FIF, the Food Intelligence Framework, helps each role choose its next action. Start with the [current MVP contract](MVP.md). The [original technical specification](../AP_Food_FIF_Agent_Ready_MVP_Spec.md) provides the detailed domain design and acceptance cases.

## Start here

The Dalia UI at `416fcbc` is now merged with the hosted implementation. Read [the integration feature map](DALIA_INTEGRATION.md) for the combined navigation, live map, multi-stall checkout, reports and verification. Both original feature sets remain in the repository.

1. Install the locked dependencies with `npm ci` and start Next.js with `npm run dev`.
2. Open `http://localhost:3000` and use the Student, Vendor, or Admin demo entrance. Keep the same origin in each tab to share demo state.
3. Run `npm run typecheck` and `npm run build` before handing changes back. The [README walkthrough](../README.md#demo-walkthrough) covers the main browser flow.

## What is working

### Account and checkout milestone

Hosted mode now includes signup, sign-in, email confirmation/resend, recovery, invitation acceptance, and account settings. Student signup creates an active profile and student membership; ordering requires a verified email. Admin Users supports search, pagination, role/status filters, invitations, stall assignments, suspension, and an audit history. Database transactions protect the final active administrator.

Signed-in carts are stored in Supabase with owner isolation and revision checks. Guest carts remain in browser storage, with an explicit conflict choice when a saved account cart exists. Checkout keeps an idempotent pending attempt until the order is confirmed and clears only the purchased cart revision.

Vendor Payment settings accepts merchant-provided QR images. QR checkout reserves inventory and pickup capacity, allows five minutes for payment, and keeps payment status separate from preparation. The designated demonstration project enables owner-authorized “I've paid” confirmation, recorded internally as `customer_claimed_demo`. Unpaid expiry, cancellation, refund tasks, and collection receipts are transactional. This remains a demonstration payment mechanism, not bank verification.

The migrations and six sample accounts are installed in project `vymnnyyuiujmxxycqiod`. Generated sample credentials are in ignored `.env.demo-users.json`; never commit or copy them into documentation. Email setup and the current domain are documented in [EMAIL_SETUP.md](EMAIL_SETUP.md). Domain verification and an earlier confirmation delivery succeeded; recovery, invitation, email-change delivery, and template activation still need a complete email walkthrough.

On 11 November, the hosted browser walkthrough passed guest import, QR upload, customer payment confirmation, vendor preparation, pickup, one receipt, suspension, cart restoration, and responsive checks. A guest-import race and signed-in cart cross-tab invalidation are fixed. See [verification results](VERIFICATION.md) for exact coverage and remaining gates.

All three signed-in FIF panels now use `POST /api/fif/recommendations`. Candidates, facts, and links are built server-side within the caller's role and stall scope. Rules are currently active. Optional Gemini ranking selects only eligible action/evidence IDs, with a five-second timeout, bounded 30-second scoped cache, and a database-backed limit of 12 provider attempts per user per hour. `GEMINI_API_KEY` and `GEMINI_MODEL` are server-only settings. No chat model is called implicitly. Provider response handling is tested with controlled fixtures; a real Gemini call remains pending the key.

| Area | Current frontend behavior |
| --- | --- |
| Student | Browse stalls, search meals, configure a cart, schedule pickup, choose a demo payment method, track an order, and show its pickup QR or text code. Campus Deals link to specific items and their discounted prices carry through checkout. |
| Vendor | Change order stages, verify a pickup code, confirm counter payment, edit menu and stock, adjust capacity and prep lead time, and pause intake. Collection creates one receipt in the demo ledger. |
| Admin | Filter the cafeteria dashboard by date and stall, compare products and vendors, manage stall approval and zone assignments, record and reverse demo expenses, and inspect the audit trail. |
| FIF and traffic | Student pickup recommendations, the vendor shift brief, and the admin ops desk use local rules. Standard, Light, Medium, and Heavy fixtures change bucket load and available windows. Traffic measures app pickup activity and identifies physical crowd conditions as unverified. |
| Public | Landing page, demo persona entrances, and draft Privacy, Terms, and Cookies pages. Cookies includes a browser data reset. |

The mock preview has 25 primary screens and uses fictional stalls and payments. In local development, Admin → Traffic can run the embedded database simulator through Traffic Lab. Its results are separate from the browser scenario shared by the three portals. Hosted mode adds real demo sign-in and API-backed checkout, fulfilment, traffic, and admin operations, with rule-based FIF recommendations on each home screen. See the [backend guide](BACKEND.md) for both walkthroughs.

## Code map and data flow

| Path | Responsibility |
| --- | --- |
| `app/[[...segments]]/page.tsx` | Dispatches public, student, vendor, and admin routes. |
| `app/globals.css`, `app/storefront.css`, `components/shared.tsx` | Shared UI, portal shells, typography, and storefront styling. |
| `components/student.tsx`, `components/vendor.tsx`, `components/admin.tsx` | Role screens and user actions. |
| `lib/demo.ts`, `lib/demo-store.ts` | Domain types, fixtures, availability, cart, order transitions, QR validation, receipts, expenses, and cross-tab subscription. |
| `lib/analytics.ts`, `components/traffic.tsx`, `components/cashflow-chart.tsx` | Scoped totals, pickup buckets, and charts. |
| `lib/promotions.ts`, `components/promotions.tsx` | Demo promotion rules and cards. The same unit-price function is used by the menu and cart calculations. |
| `docs/UI_IMAGE_PROMPT_KIT.md` | Prototype screen inventory, visual direction, and image prompts. |

The preview store uses `localStorage` under `ap-food-apspace-demo-v1`, with a read fallback for the earlier `ap-food-demo-v1` key and syncs changes across tabs via browser events. Cashflow and orders are scoped to the selected scenario. Inventory uses a shared stall configuration and counts orders against that scenario. Policy copy describes this browser-only behavior. Use integer MYR sen and display operational dates and times in `Asia/Kuala_Lumpur`. Preserve order-line price snapshots when catalogue pricing changes.

## Backend implementation order

See the [backend guide](BACKEND.md) for the current Supabase migrations, API contracts, and hosted verification steps. The [backend delivery plan](BACKEND_PLAN.md) covers simulation, InsightAI, and the follow-on FIF features.

1. Create `supabase/migrations/`. Add identity, role memberships, stall/menu fixtures, and RLS. Keep fake accounts and seeded business data separate from real environments.
2. Move checkout and capacity enforcement to one database transaction. Validate the quoted price, stock, and pickup window, then write the order and its allocation together. Enforce idempotency. Move cancellation, fulfilment, pickup-token redemption, and receipt posting to scoped transactions.
3. Connect the existing screens to authenticated read and write contracts, private Realtime updates, and server-calculated finance and traffic aggregates. Verify isolation across students and stalls.
4. Build the scenario CLI against the same checkout and fulfilment paths. Isolate simulation runs and carry provenance into admin views and FIF evidence.
5. Add server-side Gemini ranking to the three FIF panels. Compute candidate actions and evidence in the application. Validate returned action IDs and evidence references, keep the deterministic fallback, and store provider keys in server-only environment configuration.

## Acceptance checks to preserve

- Student checkout → vendor ready → student QR → vendor collection → one receipt.
- Heavy traffic fills the featured stall’s first bucket and changes the student recommendation.
- Expense posting reduces net flow and a linked reversal restores it while keeping both entries.
- Promotions agree in the storefront, cart, order snapshot, and receipt.
- The three portals remain usable at 390, 768, and 1440 px.
- Before relying on backend behavior, add tests for simultaneous checkout, repeat requests and pickup redemption, role isolation, scenario separation, and keyless Gemini fallback.
