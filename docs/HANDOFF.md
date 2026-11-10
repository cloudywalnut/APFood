# AP Food + FIF · Engineering and AI handoff

AP Food is a campus pickup prototype for students, food-stall staff, and cafeteria administrators. FIF, the Food Intelligence Framework, helps each role choose its next action. Start with the [current MVP contract](MVP.md). The [original technical specification](../AP_Food_FIF_Agent_Ready_MVP_Spec.md) provides the detailed domain design and acceptance cases.

## Start here

1. Install the locked dependencies with `npm ci` and start Next.js with `npm run dev`.
2. Open `http://localhost:3000` and use the Student, Vendor, or Admin demo entrance. Keep the same origin in each tab to share demo state.
3. Run `npm run typecheck` and `npm run build` before handing changes back. The [README walkthrough](../README.md#demo-walkthrough) covers the main browser flow.

## What is working

| Area | Current frontend behavior |
| --- | --- |
| Student | Browse stalls, search meals, configure a cart, schedule pickup, choose a demo payment method, track an order, and show its pickup QR or text code. Campus Deals link to specific items and their discounted prices carry through checkout. |
| Vendor | Change order stages, verify a pickup code, confirm counter payment, edit menu and stock, adjust capacity and prep lead time, and pause intake. Collection creates one receipt in the demo ledger. |
| Admin | Filter the cafeteria dashboard by date and stall, compare products and vendors, manage stall approval and zone assignments, record and reverse demo expenses, and inspect the audit trail. |
| FIF and traffic | Student pickup recommendations, the vendor shift brief, and the admin ops desk use local rules. Standard, Light, Medium, and Heavy fixtures change bucket load and available windows. Traffic measures app pickup activity and identifies physical crowd conditions as unverified. |
| Public | Landing page, demo persona entrances, and draft Privacy, Terms, and Cookies pages. Cookies includes a browser data reset. |

The preview has 25 primary screens. It uses fictional stalls and payments. The demo persona chooser grants access to the local prototype views. The backend milestone owns real identity, authorization, transactions, and deployment configuration.

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

The store uses `localStorage` under `ap-food-demo-v1` and syncs changes across tabs via browser events. Cashflow and orders are scoped to the selected scenario. Inventory uses a shared stall configuration and counts orders against that scenario. Policy copy describes this browser-only behavior. Use integer MYR sen and display operational dates and times in `Asia/Kuala_Lumpur`. Preserve order-line price snapshots when catalogue pricing changes.

## Backend implementation order

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
