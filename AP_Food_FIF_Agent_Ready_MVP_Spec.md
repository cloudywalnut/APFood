# AP Food — Powered by FIF (Food Intelligence Framework)
## Agent-Ready Technical MVP Specification

**Specification ID:** APF-FIF-SPEC-1.0  
**Status:** Implementation baseline (hackathon prototype)  
**Date:** 2026-11-02  
**Target:** 14 calendar days, small team with AI coding assistance  
**Stack decision:** Next.js + TypeScript on Vercel; Supabase PostgreSQL, Auth, Realtime and Storage; optional Gemini invoked securely server-side  
**Audience:** Coding agents, engineers, designers, QA testers, evaluators  
**Product identity:** **AP Food** is the application; **FIF** is the Food Intelligence Framework, its deterministic intelligence/analytics layer.

> **Read this first:** This is an unofficial APU-oriented hackathon concept, not an authorised APspace/APCard integration. Use synthetic vendors and synthetic student records unless permission is obtained. Do not deploy lookalike APKey login screens or ask for real university credentials. Do not claim simulated traffic is live physical crowd sensing. All production-like endpoints must have real authentication, authorisation and validation.

---

## 0. Contract for AI implementation agents

### 0.1 Mandatory instructions
1. Implement the system in the **stated priority order**: P0 = indispensable demo; P1 = strong enhancement after P0 passes; P2 = explicitly optional. Do not build P2 at the expense of a broken P0 checkout.
2. The application must have **three role-based portals** (student, vendor, admin) in **one Next.js repository**. Only allowed role transitions are configured by a privileged admin workflow or seeded data; never by user self-selection.
3. **PostgreSQL is the source of truth.** Prices, inventory, pickup capacity and order state must be verified and modified in server-side transactions. UI calculations are advisory only.
4. **FIF must work without an LLM.** Use typed deterministic algorithms for order capacity, feasibility, scheduling, and transparent traffic estimation. Gemini is optional for natural-language summaries, not for business-critical state transitions.
5. Implement all required RLS policies and test them against cross-user and cross-vendor access. Never expose Supabase service-role/secret credentials to browsers.
6. Use real UI navigation and state transitions. No nonfunctional buttons, meaningless charts, unbacked counters or fake live status in the core demonstration.
7. Where representative data is synthetic, clearly label the dataset **Demo data** and distinguish it from real app-generated events.
8. All timestamps stored as UTC `timestamptz`; display in `Asia/Kuala_Lumpur`. Money stored as integer **MYR sen**. Do not use floats for monetary arithmetic.
9. Generate SQL migrations, seed scripts, minimal docs, tests, and repeatable local/deployment steps. Do not depend on hidden dashboard-only configuration.
10. Before modifying scope, update the feature ID and change log. The human-readable WhatsApp scope and this agent spec must remain consistent.

### 0.2 Scope assumptions and explicit exclusions
- One campus, multiple campus food courts/zones, multiple independent vendors.
- One **vendor per order**. A student may order from multiple vendors separately. Cross-vendor payments, unified cart splitting and delivery are excluded from P0.
- **Pickup only**. No delivery dispatch, rider tracking or external courier integrations.
- **Payment in demo:** either simulated success or pay-at-counter. No actual money movement, APCard balance read/write, payment gateway, reconciliation or refunds. UI must call simulated payments “Demo payment.”
- Student timetable is opt-in: manual input and/or local `.ics` import. No APspace account scraping or unauthorised timetable API.
- No microphones, cameras, Wi-Fi tracking, BLE beacons, GPS-based tracking, or passive people tracking required for traffic intelligence.
- “Crowd level” must be a transparently labelled **estimate/proxy**, not a claim of observed actual people count. If no independent observation exists, show order-driven *demand/load* instead of asserting physical occupancy.
- Student self-registration is permitted with dummy/personal email; vendor and administrator privileges granted only by privileged staff or seed tooling.
- Accessibility includes keyboard operation, semantic labels, visible focus, reduced motion and non-colour-only status cues.
- Frontend is mobile-first for students; tablet/desktop-first for vendor; desktop-first with responsive fallback for admin.

### 0.3 Release gates
- **P0 ship criteria:** student sign-in; vendor discovery; menu; single-vendor cart; real stock/capacity-checked checkout; scheduled pickup; live vendor kitchen status; QR handoff; vendor menu/stock; admin vendor oversight; FIF SmartQueue; student traffic intelligence screen with honest provenance; role isolation; Vercel deployment; complete demonstration flow.
- **P1:** timetable-assisted pickup; forecast with calibrated confidence; student ratings; vendor dashboards; operational observation inputs; admin analytics and vendor management; notification centre; AI explanatory summaries.
- **P2:** rewards, multilingual natural-language assistant, bundle recommendations, multi-campus expansion, actual payment integration, advanced multi-station scheduling, external campus APIs.
- Feature statuses defined as `planned | in_progress | implemented | tested | deferred` and recorded in `docs/FEATURE_STATUS.md`.

---

## 1. Product objectives, definitions and success criteria

### 1.1 Problem
APU students face fragmented food discovery, uncertain lines, limited break time and no unified preordering across independent vendors. Vendors face unpredictable rushes, manual order intake and unreliable pickup promises. APU lacks a consolidated view of opt-in app-based food demand.

### 1.2 Solution
**AP Food** provides vendor discovery, customised pickup orders, status tracking and QR collection. **FIF** provides capacity-aware pickup promises (SmartQueue), demand forecasting (DemandSense), timetable fit (ScheduleSync), and food-court traffic intelligence (FlowSense). The product has student, vendor and admin workspaces built on shared data.

### 1.3 Primary measurable outcomes
- Students can complete an order from vendor selection through checkout in under 90 seconds in a scripted usability test (goal, not guaranteed).
- Every committed pickup time is capacity-verified transactionally.
- No negative stock or double-spent vendor capacity under 20+ simultaneous checkout attempts in automated concurrency tests.
- Vendors can update an order in two interactions or fewer from the kitchen board.
- Real order state changes appear on connected clients within a test target of 3 seconds p95 under demo load (measure, don't imply SLA).
- Traffic estimates always expose status, basis, freshness and confidence; no false claims of measured physical occupancy.
- End-to-end student→vendor→pickup→admin demo completes with no manual database intervention.

### 1.4 Terminology
- **Zone:** Food-court area such as `Main Campus Food Court`, containing multiple vendors.
- **Vendor:** Independent participating food stall.
- **Kitchen load:** Preparation commitments versus available prep capacity; is **not** an occupancy headcount.
- **Traffic signal:** A zone-level advisory indicator based on order-related load, voluntary observations or manual observations, with provenance.
- **Pickup window:** 15-minute interval for ready/collection promise.
- **Quote:** Temporary, non-guaranteed availability result generated before authoritative checkout.
- **Reservation:** Atomic inventory and preparation-capacity allocation created by successful checkout.
- **FIF confidence:** Heuristic confidence/coverage score, not statistical probability unless empirically calibrated.

---

## 2. Actors, access control and permissions

| Actor | Own/accessible records | Allowed operations | Explicitly forbidden |
|---|---|---|---|
| Guest | Public published vendor/menu/zone summaries | Browse, sign in | Order, access personal records |
| Student | Own profile, cart, timetable, orders, reviews, aggregate traffic data | Place/cancel eligible own orders, view status, redeem own QR | Change item price/stock, vendor status, other students' data |
| Vendor staff | Assigned vendor's orders, items, stock, operating settings, analytics | Accept/prep/ready/collect orders, configure menu and capacity | Read another vendor's orders, grant admin role, alter price snapshots in existing orders |
| Vendor manager | Vendor staff actions plus their own vendor team permissions (P1) | Assign vendor staff within delegated policy | Assign global admin, modify another vendor |
| Campus admin | Approved platform-wide operational records | Approve/suspend vendors, handle reports, configure zones, audit activity | Impersonate students or bypass payment controls silently |
| Background worker | Narrow authorised maintenance scopes | Refresh forecasts, expire temporary objects, aggregate metrics | Run as user-visible superuser or send raw private data to AI |

**Identity model:** `auth.users` is authentication authority. `profiles.id` references `auth.users.id`; every active authenticated account has student access by default. `vendor_memberships` controls per-vendor staff/manager privileges; `admin_memberships` is the **only** global-admin authority. Accounts can hold multiple memberships and select the appropriate portal; there is no mutable `profiles.role` field. Global admin assignment must require a privileged server-side process; never trust client-editable profile fields or stale UI role claims. All mutations recheck permissions server-side. Vendor visibility should be determined via membership and status; do not rely on a client-supplied vendor ID as an authorisation fact.

---

## 3. Information architecture and screen inventory

Use Next.js App Router route groups for layout only (route groups do not change URL). The indicated URLs are canonical and must route to working content.

### 3.1 Shared/public/auth
| Route | Page | Priority | Notes |
|---|---|---|---|
| `/` | Landing / choose student or vendor | P0 | Clearly unofficial demo, navigation into app |
| `/auth/login` | Sign in | P0 | Supabase Auth email/password or email OTP |
| `/auth/register` | Student sign up | P0 | Never let a new account choose vendor/admin |
| `/auth/reset-password` | Account recovery | P1 | Secure supported Supabase flow |
| `/unauthorized` | Forbidden state | P0 | No leaked resource info |
| `/settings/profile` | Account, preferences, privacy | P1 | Own profile only |

### 3.2 Student routes
| Route | Page | Priority | Detailed contents |
|---|---|---|---|
| `/app` | Student home | P0 | Search, featured vendors, active orders, brief traffic status, primary CTA |
| `/app/vendors` | Vendor catalogue | P0 | Search, filters, zone, hours, availability, ETA |
| `/app/vendors/[slug]` | Vendor details/menu | P0 | Vendor description, menu, variants, allergy/diet labels, hours |
| `/app/cart` | Single-vendor cart | P0 | Quantity, choices, price, edit/remove, cost breakdown |
| `/app/checkout` | Pickup and demo payment | P0 | Time-window quotes, pay-at-counter/demo, confirm |
| `/app/orders` | Order list | P0 | Status, vendor, totals, repeat navigation |
| `/app/orders/[id]` | Live tracking and pickup QR | P0 | Timeline, exact current state, collection code, cancellation rules |
| `/app/traffic` | **Food Court Traffic Intelligence** | P0 | Zone comparisons, estimated load, basis, freshness, best collection periods |
| `/app/timetable` | Student classes and breaks | P1 | Manual or ICS import, timezone, timetable fit |
| `/app/favorites` | Saved vendors/dishes | P1 | Reorder shortcuts |
| `/app/reviews` | Reviews and support | P1 | Review eligible completed orders only |
| `/app/notifications` | Alerts | P1 | Ready/changes/cancellation alerts |

### 3.3 Vendor routes
| Route | Page | Priority | Detailed contents |
|---|---|---|---|
| `/vendor` | Vendor overview | P0 | Open status, current backlog, next pickups, quick actions |
| `/vendor/orders` | Kitchen board | P0 | New / accepted / preparing / ready tabs, scheduled times |
| `/vendor/orders/[id]` | Order detail | P0 | Items and modifiers, transitions, collection validation |
| `/vendor/menu` | Menu management | P0 | Create/edit/publish/hide items, stock, images, modifiers |
| `/vendor/capacity` | Prep configuration | P0 | Slot capacity, prep estimates, opening/closed periods, pause |
| `/vendor/analytics` | Sales and prep performance | P1 | Orders, on-time rate, demand shape |
| `/vendor/traffic` | Zone observation | P1 | Submit optional queue-band observation with expiry |
| `/vendor/settings` | Store details and staff | P1 | Address, hours, members with appropriate permission |

### 3.4 Administrator routes
| Route | Page | Priority | Detailed contents |
|---|---|---|---|
| `/admin` | Overview | P0 | Live system health, active vendors, operational issues |
| `/admin/vendors` | Vendor control | P0 | Approve, suspend, configure zone, view staff |
| `/admin/orders` | Order oversight | P1 | Read-only filtering, documented override with reason |
| `/admin/traffic` | Traffic intelligence | P0 | Zone demand/proxy, observations, data freshness, scenario switch |
| `/admin/analytics` | FIF analytics | P1 | Forecast, throughput, availability and confidence |
| `/admin/reviews` | Feedback moderation | P1 | Flags, response records |
| `/admin/settings` | Zone/venue configuration | P1 | Business hours, config and demo-mode banner |
| `/admin/audit` | Audit trail | P0 | Staff/admin actions, scope and timestamps |

### 3.5 UI system
- Create a single visual system: minimal APspace-inspired blue/white palette, not a pixel-for-pixel clone; one high-value primary focus per screen, restrained card count, generous whitespace.
- Mobile student shell: bottom navigation `Home / Explore / Orders / Traffic / Account`; floating cart affordance on menu pages.
- Vendor desktop/tablet: sidebar `Dashboard / Orders / Menu / Capacity / Analytics` with large touch targets.
- Admin: compact sidebar `Overview / Vendors / Traffic / Orders / Analytics / Audit`.
- All screens need skeleton, empty, error, offline/retry and success states. Show explicit estimated versus verified labels for FIF-derived numbers.

---

## 4. P0 student feature specifications

### STU-01 — Student registration, sign-in and preferences [P0]
**Entry:** Public landing or session expiry. **Inputs:** email, password/OTP, display name, optional dietary preferences. **Flow:** sign up → verify identity through configured Supabase Auth flow → create ordinary profile (student access is the default; privileged roles come only from membership tables) → route `/app` → preferences optionally saved. **Validations:** rate-limit auth at provider/platform, no client-selected privileges, strong password policy for password auth, normalised name length. **Outputs:** authenticated session, ordinary profile with student access. **Errors:** invalid credentials, expired OTP, disabled account, network failure. **Acceptance:** unregistered user cannot see protected screens; vendor routes redirect to `/unauthorized`; a new user cannot create vendor/admin memberships.

### STU-02 — Vendor discovery and smart search [P0]
**Entry:** `/app/vendors`. **Inputs:** search query, zone, open status, price range, dietary tags, available-pickup preference. **Flow:** search published vendor catalogue and item names using Postgres full-text or trigram indexes; show vendor name, zone, opening status, available categories, starting price, and *indicative* current prep load (not a guaranteed ETA). **Outputs:** paginated responsive cards; links to vendor pages. **States:** open, closed, paused, sold-out selection. **Errors:** no matches, service unavailable. **Acceptance:** only approved/published vendors appear; filter composition works; untrusted HTML never rendered from descriptions; filters remain URL-shareable.

### STU-03 — Menu, variants, cart [P0]
**Entry:** `/app/vendors/[slug]`. **Flow:** list available categories/items; expand product, choose required size/add-ons and quantity, see price breakdown; add to cart. **Rules:** one-vendor cart; adding from another vendor prompts clear-cart confirmation; required options enforced server-side; maximum quantity enforced; current visible stock is advisory until checkout. **Data:** item ID, variant IDs, modifier option IDs, quantity, request notes (max 300 chars). **Price:** server recalculates from current published item/option prices; client totals are previews. **Allergy:** tags are vendor-provided and must not imply guaranteed allergen safety. **Acceptance:** tampering with hidden unit price or option ID cannot affect server charge; changing vendor never silently discards cart; unavailable items cannot be checked out.

### STU-04 — Pickup quote and checkout [P0]
**Entry:** `/app/checkout` with valid cart. **Flow:** load 3–8 candidate pickup windows over next 1–2 hours; optionally show class-break fit; student chooses one; user selects `demo_payment` or `pay_at_counter`; checkout sends idempotency key and cart; authoritative transaction validates vendor availability, item/options, price, stock and pickup capacity; allocates reservations; creates order with immutable item snapshots; returns order ID, authoritative cost and pickup time. **Rules:** one vendor per order; same idempotency key yields same order/result; quotes expire after 120 seconds; old quoted slot might fail at commit and must return `409 SLOT_UNAVAILABLE` with fresh suggestions. **Payment:** simulated checkout clearly shows no real money was charged; pay-at-counter records only *payment intent* until vendor logs receipt. **Acceptance:** concurrent orders cannot oversell; retry on slow response doesn't duplicate an order; checkout fails explicitly if store closes or selection sells out; price mismatch triggers review rather than hidden extra charge.

### STU-05 — Order history and live tracking [P0]
**Entry:** `/app/orders`, `/app/orders/[id]`. **Display:** vendor name, items, ordered time, pickup window, status stepper, action prompts, pickup code (only if eligible), last update timestamp. **Sync:** private authorised Realtime channel scoped to own order; initial HTTP fetch, event invalidates/reloads authoritative order; reconnect and manual retry supported. **Status model:** `placed → accepted → preparing → ready → collected` plus terminal `rejected`, `cancelled`, `expired`, `no_show` under permitted rules. **Student cancel:** permitted only before `preparing`, with configured cancellation cutoff and transactional inventory/capacity treatment. **Acceptance:** other students cannot read order details or subscribe to its private events; order page survives refresh/reconnect; status cannot move backwards.

### STU-06 — QR pickup [P0]
**Flow:** once order is `ready`, render a short-lived, one-time collection credential as QR plus readable fallback code. Vendor validates it using an authenticated staff endpoint. Use a cryptographically random token (minimum 128 bits entropy) stored only as hash, tied to order, vendor, expiry, and one-time redemption. The raw token is returned only to its order owner at issuance, not persisted; when the page refreshes, issue a new token and invalidate the previous unredeemed token. Token expires on successful use and can be regenerated securely if needed. **Acceptance:** wrong vendor, wrong status, expired token, reused token and cross-order token all reject; vendor scan atomically marks order collected; redeemed token cannot be replayed. QR content must not contain student email or raw profile data.

### STU-07 — Food Court Traffic Intelligence [P0; HIGH DIFFERENTIATION]
**Route:** `/app/traffic`. **Goal:** help a student choose *when and where to collect or buy food* with minimal congestion and queuing uncertainty. **Minimum UI:** zone list/cards (e.g., Main Food Court, Annex Cafeteria, Library Café — all synthetic in demo), current `Low / Moderate / High / Unknown` **estimated demand/load**, next 60-minute 15-minute forecast graph, `best time to go` recommendation, indicator source and last update, participating vendors and average **order preparation** delay (clearly not physical walking queue unless observed). **Interaction:** compare zones, pick date/time, choose vendor and link to appropriate pickup slot. **Privacy:** no individual location tracking. **Critical truthfulness:** order volume alone cannot yield actual physical footfall. For zones with no independent crowd observation, display `Estimated pickup activity` / `Order demand` and `Physical crowd level: Not verified`. Only use `Estimated crowd/queue conditions` when a vendor/admin voluntarily submits an observation; mark observation basis, recency and confidence. **Fallback:** insufficient data → `Unknown—limited data` and deterministic next available pickup recommendation. **Acceptance:** stale observations expire and label degrades to unknown; simulated observations have a conspicuous `SIMULATED` badge; published zone summary excludes student identities and individual order IDs; load updates after placed/cancelled orders.

---

## 5. P1/P2 student feature specifications

### STU-08 — Optional timetable-aware pickup [P1]
Student manually creates weekly class blocks or imports local ICS. Parser reads DTSTART, DTEND, RRULE where supported, preserves local timezone, warns on unsupported recurrences; stores only chosen fields. From free intervals, subtract configurable buffer (default 10 minutes before the next class) and estimated walk time (demo fixed per zone). FIF ScheduleSync ranks only vendor slots that fit the interval. Students can override suggestions; impossible timing is warned and not labelled feasible. No campus API or student information scrape. Test overlapping classes, midnight boundaries, daylight offsets in imported ICS and daylight-independent Malaysia display.

### STU-09 — History, favourites and reorder [P1]
History is append-only from committed orders. Reorder reconstructs a fresh cart subject to current menu, variants, price and stock; never blindly replay snapshot prices. User can favourite vendors/items. Pagination and empty states required.

### STU-10 — Reviews and feedback [P1]
One review per collected order, with rating 1–5, optional limited text, vendor and item association. Review must be from order owner; no review for cancelled orders; moderation/admin hide reason audit. Show ratings only when sample size credible (otherwise `New—few reviews`). No use of student name publicly without explicit choice.

### STU-11 — Notification centre [P1]
Durable in-app notifications for order accepted, rejected, preparing, ready, pickup overdue, cancelled or exception. Only own notifications; unread and read. Optional browser push/email are P2. Ensure notifications cannot be spoofed by clients.

### STU-12 — Recommendations / dietary search [P1]
Deterministic filters for price, preferences, item availability, distance proxy and expected pickup time. Explain recommendation factors. Do not assert medical/nutritional compliance based solely on vendor tags. Gemini natural language recommendations are optional P2.

---

## 6. Vendor feature specifications

### VEN-01 — Onboarding, business profile, hours [P0]
Admin provisions/approves vendor and staff membership. Vendor sets public name, description, designated food-court zone, contact method, weekly open/close hours and exception closures. All timings use Malaysia-local business clock with UTC storage. Open status derives from hours AND admin approval AND `accepting_orders` toggle. Vendor can pause new orders without hiding existing active orders. No automatic vendor self-approval.

### VEN-02 — Menu, variants, add-ons, stock [P0]
Create categories and items with image, active flag, base price in sen, vendor estimate of prep minutes, **prep work units**, dietary labels, max per order, portion stock (or unlimited flag). Items can have named variant groups (e.g., size: single choice) and modifier groups (e.g., add egg: optional). Changing prices never retroactively changes existing order snapshots. Image uploads use allowed MIME types, signed URLs/controlled public assets, size limit (e.g., 3 MB), metadata cleaning and safe naming. Disable/delete items with historical orders by archiving; keep referential integrity. Stock decrements at successful checkout only.

### VEN-03 — Kitchen board and state machine [P0]
Default view groups `New`, `Accepted`, `Preparing`, `Ready`, sorted by promised time then creation time. Each card shows order number, items/modifiers, pickup window, elapsed time, notable allergies as *unverified vendor-provided tags*, and action CTA. Order transitions occur through authenticated server action/RPC and create audit events. Vendor staff cannot mark order as paid by calling arbitrary client update. Rejecting/cancelling before prep follows restock/capacity rules; after prep requires a reason and does not automatically restock consumed ingredients. Vendor may not edit immutable price snapshot.

### VEN-04 — Capacity and availability settings [P0]
Vendor configures preparation capacity as integer work units per 15-minute interval, minimum lead time, fixed pickup buffer, max outstanding orders, opening hours and exception closures. Admin-safe bounds: e.g., capacity 1–300 work units, lead time 5–120 minutes. FIF must quote windows only if capacity and minimum lead-time constraints pass. Vendor can temporarily pause new orders; previous reservations remain visible/valid unless explicitly cancelled with notification.

### VEN-05 — Pickup verification [P0]
Vendor's camera scanner (where permission available) or manual code input calls backend endpoint with token. Backend checks vendor membership, token hash, expiry, order status and payment-mode rules, then transitions to collected in one transaction. `pay_at_counter` UI requires staff confirmation that payment occurred outside the app (demo only, no reconciliation proof); generate audit record. Unknown / used / expired code yields unambiguous error.

### VEN-06 — Sales and prep analytics [P1]
Charts: orders by hour, items sold, gross simulated order value (NOT confirmed revenue), prep duration distribution from state event timestamps, readiness timeliness, cancellations and no-shows. Vendor sees only its own data. Time ranges and denominators must be explicit. Zero data uses no-data state, not fabricated percentages.

### VEN-07 — Manual queue and foot-traffic observations [P1]
Vendor can submit an optional observation for their area: `quiet / normal / busy / very_busy`, observation time, optional approximate wait-time band and note; expires after 20 minutes unless refreshed. Limit observations per vendor/zone, prevent repeated spamming, retain provenance. Vendor observation is a **human report**, not an IoT measurement. Multiple fresh observations may be aggregated with source count and age; do not disclose personal identifiers to students. Admin can invalidate reports.

### VEN-08 — Performance tuning and insights [P1]
Show historical prep estimate versus observed durations, proportion ready by promised window, top capacity bottlenecks, possible menu stock-outs. Offer suggestions as non-binding advisory actions. An LLM is optional; numbers always computed in code/SQL. Do not silently change vendor capacity or opening hours.

---

## 7. Admin feature specifications

### ADM-01 — Admin onboarding and vendor approvals [P0]
Seed trusted admin using secured migration/script or manual secure provisioning; no public admin registration. Admin approves/suspends vendors, assigns zone, enables vendor membership and may disable a compromised vendor. Every privileged change creates `audit_events` with actor, action, target and reason. Suspended vendors cannot accept new orders; their active orders remain accessible for authorised resolution.

### ADM-02 — Operational overview [P0]
KPI cards from actual database events: active vendors, active orders, due pickups, unresolved incidents; aggregated totals. UI shows timestamp and `Demo data` when seeded synthetic records contribute. New business data must not show under a `live` label until generated by application events.

### ADM-03 — Campus traffic management [P0]
Configure zone names/capacity reference, observe per-zone demand proxy, adjust simulated campus scenario (demo environment only), review manual reports and their expiry, display data-source coverage. Production cannot be switched to fabricated `live` status. Public traffic cards link to provenance explanation and are automatically invalidated when no recent signals remain.

### ADM-04 — Order oversight and exceptions [P1]
Search order IDs, filter by vendor/status/time, inspect event history. Admin override requires privileged action, specific reason and explicit UI confirmation. On override, use same transactional mutation path as normal workflow to avoid orphaned reservations and notifications. No direct arbitrary order field editing.

### ADM-05 — Aggregated FIF and vendor analytics [P1]
Charts by zone/vendor/time: order arrivals, capacity reserved, actual prep times, demand-forecast error (when enough historical observations), manual observation coverage, no-shows. Show synthetic versus live-generated data proportions and sample sizes. No student-level surveillance analytics.

### ADM-06 — Feedback and incident management [P1]
Moderate reviews, investigate vendor lateness, record incidents. Allowed statuses `open / in_review / resolved`; audit all decisions. P0 can be a simplified view of cancelled/rejected orders with incident reason.

### ADM-07 — System settings and audit [P0/P1]
P0: audit event viewer and zone management seeded. P1: configurable default slot duration, observation TTL, notices, maintenance banner and platform settings; changes versioned. Never allow arbitrary SQL or unrestricted AI-generated commands in admin UI.

---
## 8. FIF intelligence subsystems: authoritative design

The intelligence engine is a set of separately testable services/functions. It must not bypass permissions, be silently overridden by an AI model, or promise unavailable capacity.

### FIF-01 — SmartQueue: capacity-aware pickup scheduling [P0]
**Inputs:** vendor ID, order item/variant selection, work-unit requirements, minimum prep time, pickup interval, current orders/allocations, scheduled open periods, pause status, remaining inventory, safety buffer.  
**Outputs:** feasible pickup windows with reason codes; upon checkout, immutable chosen window and reserved work-unit allocations.

**Operational model (14-day feasible):**
1. Divide business hours into **15-minute pickup/preparation buckets**. Vendor declares `work_units_per_bucket` and item declares `prep_work_units`; work units are a configurable operational abstraction, not equivalent to real minutes across all cooking stations.
2. Item quantity multiplies work units. Order work requirement is the sum (with optional explicit batch adjustment only if tested). `min_lead_minutes = max(vendor_min_lead, max(item.prep_minutes)) + pickup_buffer`.
3. Quote candidate pickup buckets no earlier than `now + min_lead_minutes`, entirely within operating hours, with sufficient free capacity in the relevant allocation window. **P0 simplified guarantee:** reserve total required work units **against the selected pickup bucket**. This is conservative and deterministic but is not a minute-by-minute kitchen scheduler; state this limitation accurately.
4. For each bucket: `available_units = configured_capacity - allocated_units`; feasible if `available_units >= required_units`, stock adequate and order limit not exceeded. Return earliest three to eight feasible windows. Protect unavailable or closed intervals.
5. Checkout transaction obtains a **per-vendor transaction-scoped advisory lock** (or locks the relevant `capacity_slots` rows consistently), revalidates menu and stock, creates missing bucket under unique constraint, locks `capacity_slots` row, then increases `reserved_units`, decrements inventory, snapshots line-item prices and creates order; commit atomically. Lock order must be deterministic; deadlock retries bounded.
6. A quote is merely information; do not reserve capacity until a successful order commit. An earlier quote can expire/become invalid.
7. If the selected slot is gone, return `409 SLOT_UNAVAILABLE` plus refreshed choices. If inventory is gone, return `409 OUT_OF_STOCK` with the latest availability. Never partially create an order.
8. A **pre-preparation cancellation** returns stock and bucket capacity once, in the same transaction, marked via `reservation_released_at` to make idempotent. After preparation begins, cancel according to vendor policy but **do not restock consumables**. Finished/collected/no-show orders keep historical capacity usage for analytics; bucket accounting is historical, not literal occupancy.
9. Count outstanding active orders per vendor; enforce limit when configured. An admin/vendor force-closing operation cannot silently erase existing reservations.

**Later (P2) enhancement:** multi-station, weighted work allocation over multiple adjacent buckets, critical-path prep durations and batch cooking; only introduce after test fixtures show correctness.

**Non-functional guarantees:** repeated checkout idempotent; state transition logged; vendor capacity cannot be negative or exceeded; returned scheduled time timezone correct. **Test model:** 20 concurrent purchasers requesting a bucket with five units free → at most five one-unit commitments; all others get conflicts, not oversold reservations.

### FIF-02 — DemandSense: demand forecasting [P1]
**Forecast target:** predicted **AP Food order arrivals**, by vendor/zone and 15-minute interval; never claim to forecast all food-court visitors from application orders.  
**Data:** historical `orders.created_at`, order statuses, vendor operating hours, zone, weekday, local meal-time period, optionally academic-calendar event flags in synthetic seed. **Minimum demonstration:** 14–30 days clearly labelled generated historical activity, plus actual current application events.  
**Method:** baseline seasonal profile: exponentially weighted mean per (vendor, weekday, 15-minute bucket) with fallback to meal-period or zone average if sample sizes small. Include simple trend/holiday adjustments only when justified. Optional gradient boosting/regression on more complete data is P2. Use **holdout validation** when enough history exists, with MAE / WAPE and naive baseline comparison.  
**Outputs:** predicted order counts, confidence/coverage level, training window, `generated_at`, data source (`synthetic | live | mixed`) and method/version. Never show “94% accurate” without measured evaluation.
**Execution:** scheduled SQL/Edge Function through Supabase Cron or targeted server job; persist `forecast_snapshots` (do not rerun on each page render). Cache and show stale status when job is delayed.
**Acceptance:** changing historical demand in fixtures changes forecast in expected direction; no history returns `Insufficient data` or baseline labelled as assumed; tests prove no leakage of future orders into past backtests.

### FIF-03 — ScheduleSync: timetable-aware suggestions [P1]
**Inputs:** student-supplied class blocks, vendor zone, configurable walking time estimate, candidate pickup windows, student preferred meal time. **Algorithm:** for each free interval, verify arrival before window end and departure with sufficient buffer ahead of next class; score by total detour and preference, then rank feasible vendor pickup windows. **Privacy:** opt-in; timetable only visible to its owner and necessary server scheduling logic. **Acceptance:** a class conflict is never ranked as feasible; user can browse and order without entering a timetable.

### FIF-04 — FlowSense: student Food Court Traffic Intelligence [P0]
**Mission:** surface a *useful, honest, frequently updated* view of when campus food zones are likely to be busy, without mandatory IoT or location tracking.

#### 8.4.1 Distinct concepts that MUST NOT be conflated
1. **Kitchen utilisation:** `reserved prep work units / configured capacity` per pickup bucket (directly calculable within AP Food).
2. **AP Food pickup activity:** count of upcoming pickup orders and expected pickup arrival windows (observable within AP Food; excludes walk-ins).
3. **Observed physical queue/crowd:** manually submitted, time-limited observations by authorised vendor/admin or optional aggregated student observations (P2). Can be approximate, not a guaranteed actual headcount.
4. **Predicted demand:** future expected AP Food order count from DemandSense (model output, not live physical crowd measurement).

#### 8.4.2 Data sources and trust levels
| Signal | Availability | Truthful label | How used |
|---|---|---|---|
| Committed orders per 15m zone | P0 live app data | `AP Food pickup activity` | High/medium/low activity projection |
| Vendor bucket capacity utilisation | P0 live app data | `Kitchen load` | Delay/availability recommendations |
| Historical order demand | P1 live/synthetic | `Predicted AP Food demand` | Next-hour advisory trends |
| Vendor/admin observation, expires in 20m | P1 | `Reported queue/crowd conditions` | Physical crowd indicator with age + source |
| Vendor estimate of walk-in wait | P1 | `Vendor-reported queue wait` | Indicative on-site wait, separate from prep ETA |
| Synthetic event scenarios | Demo only | `Simulated demand scenario` | Judges can vary traffic and see re-routing/recommendations |

#### 8.4.3 Calculation (transparent heuristic, P0)
For every zone and 15-minute bucket:
- `pickup_count` = number of valid, not-cancelled orders promising pickup in the bucket (only owned app orders, aggregate).
- `zone_capacity_units` = sum of configured capacities of currently approved/open participating vendors in zone; `reserved_units` = aggregate committed units.
- `utilisation = reserved_units / max(zone_capacity_units,1)` (clamp for chart, retain raw ratio for warnings).
- `activity_index` = weighted combination of **normalised** pickup_count versus demonstrated historical/preset baseline and utilisation; calibrate weights in configuration, default 0.5 each. If baseline unavailable, show utilisation and raw counts only—do **not** invent a meaningful numerical crowd index.
- `load_band`: Low <0.40; Moderate 0.40–0.74; High >=0.75 (thresholds configurable). Display as **estimated order activity / kitchen load** unless independent crowd observations exist.
- For `physical_crowd_status`: if >=1 fresh authorised observation, show `Reported quiet/moderate/busy` with source count, last report and `reported—not measured`; if observations disagree, mark `Mixed reports` with low confidence; if none, `Unknown—no recent observations`.
- `confidence_label` = `High/Medium/Low/Insufficient` from signal coverage, sample count, staleness and agreement; **not** a statistical probability. Example: fresh multiple agreeing reports = medium/high coverage; only app orders = high confidence in *app demand*, **no confidence in physical crowd**.
- `best_visit_window`: select next 4–8 available buckets, rank by estimated order activity, viable selected vendor preparation slot, declared opening hours and optional timetable. Include caveat that walking-in queue can differ.

**Student presentation example (allowed):** “Main Food Court — High AP Food pickup activity. Physical crowd: not verified. Updated 2 min ago. Quieter pickup periods estimated after 2:15 PM.”  
**Student presentation example (forbidden):** “Main Food Court is 83% full LIVE” based only on the orders database.

#### 8.4.4 Traffic UI and actions
- Default `/app/traffic` header: **Food Court Activity**, contextual help explaining what is estimated.
- Zone comparison cards: name, `Order activity` band, `Reported crowd` band or `Unknown`, recommended visit/pickup time, open vendor count, `Updated X min ago`.
- Details: 15-minute activity history + predicted next hour (visually distinguish historical / predicted), preparation-time status for participating vendors, any manually reported walk-in queue, `Why this estimate?` expandable panel, confidence/source legend.
- Action: `Browse quieter vendors` and `Schedule pickup` (links to relevant existing features; no phantom reservation).
- Filters: `Now | Next 30m | Next 60m`, food court, vegetarian/halal tags if vendor-provided, relative busyness.
- Graceful degradation: if no orders/observations, show `Limited data` and participating vendors, not a green “Empty” signal.
- No user-level map trails, exact device coordinates, CCTV or individual movement profiles. Admin sees aggregate only.

#### 8.4.5 Architecture and performance
Use `zone_activity_snapshots` with 15-minute buckets and server-computed aggregates rather than broadcast every raw order to every student. Generate on relevant order events plus scheduled refresh (e.g. every 60–120 seconds) and publish one public, aggregate-safe event. Backfill historical buckets by jobs. Source freshness threshold: show stale after 5 minutes, unavailable/unknown after 15 minutes for live activity; observation TTL separate (20 minutes). Avoid expensive unrestricted realtime subscriptions for thousands of students. Realtime payload cannot include student/order identifiers.

#### 8.4.6 Tests
- Adding an active pickup order increases bucket pickup count and associated utilisation; cancelling before prep reduces the active count.
- Other zones remain unaffected; zone vendor suspension affects availability, not historical event integrity.
- An expired manual observation is ignored.
- Disagreeing observations lower confidence.
- A zero-activity zone without reliable coverage does NOT display as `uncrowded`.
- Synthetic scenario mode never silently replaces production live stats.
- Multi-user subscriptions expose only aggregate zone payloads.

### FIF-05 — InsightAI: optional Gemini advisory [P1 or P2]
**Use cases:** convert aggregate vendor analytics into short recommendations (“Demand around 12:30 appears higher than your usual Tuesday”), explain why a slot was recommended, help vendor interpret charts. **Architecture:** server-side provider abstraction; input is minimum necessary, aggregated and de-identified; allow-listed tools for reading data only; output strictly validated to `{title, explanation, evidence_refs, suggested_action}`. No direct AI writes to pricing, capacity, stock, order status or student records. Cap tokens, requests/user and timeout; use deterministic template fallback when disabled. Log token spend, errors and provenance. Never send student names, addresses, contact information or notes to provider by default. **Acceptance:** all core features work with Gemini key unset; invalid model JSON falls back safely; analysis never reports numerical figures not in the supplied evidence.

---

## 9. Lifecycle / transactional invariants

### 9.1 Order state transition table
| From | To | Actor | Guard |
|---|---|---|---|
| none | `placed` | student checkout | cart valid, capacity + stock allocated atomically |
| `placed` | `accepted` | assigned vendor | not suspended for operational handling, within permitted window |
| `placed` | `rejected` | assigned vendor | reason required, reservation release pre-prep |
| `accepted` | `preparing` | assigned vendor | order not cancelled/expired |
| `preparing` | `ready` | assigned vendor | preparation complete |
| `ready` | `collected` | assigned vendor via QR | valid one-time token; optional external-payment confirmation |
| `placed` or `accepted` | `cancelled` | order owner/vendor/admin | cutoff and reason; release only if not started |
| `placed` | `expired` | background worker | vendor never responded beyond configured expiry; release reservation |
| `ready` | `no_show` | vendor/admin/worker | collection grace elapsed, reason logged |

No status rollback. Administrative exceptions are compensating operations with audit, not arbitrary state rewrites. `paid_at_counter` is an operational assertion of external payment, not a processor-confirmed charge.

### 9.2 Stock invariants
- For finite-stock items: `stock_remaining >= 0` always; `checkout` decrements exactly once per successful order; safe pre-prep cancellation increments once; post-prep cancellations do not automatically restore physical inventory.
- Ingredient-level stock is P2; P0 stock is menu-item portions. If variant-specific stock matters, model separate stock keys; don't pretend one parent stock counter covers individually scarce variants.
- Historical order item price/label snapshots never change if the menu item changes.

### 9.3 Pickup capacity invariants
- `0 <= reserved_units <= total_units` for every vendor/bucket.
- Slot reservations are allocated in a transaction with the order and items.
- Retry does not allocate twice.
- A vendor changing capacity below already committed reserved units is rejected or scheduled for future empty buckets, never silently overbooks existing promises.
- Terminal states retain event history; releases marked with one-time timestamp and linked adjustments.

### 9.4 Visibility/authorisation invariants
- Students: only their own order/profile/timetable and public aggregate snapshots.
- Vendor staff: only vendor-scoped orders/menus and vendor aggregate analytics.
- Admin: platform scopes explicitly authenticated, actions audited.
- Service credentials used only in a trusted server runtime and never passed to client components.

---

## 10. Relational database design (PostgreSQL)

Use UUID primary keys, `created_at`/`updated_at` timestamps, explicit foreign keys, check constraints and indexes. Implement via migrations under `supabase/migrations/`. Below is the logical contract; implement additional columns only with documented purpose.

### 10.1 Identity and campus structure

| Table | Essential fields / constraints | Key indexes and notes |
|---|---|---|
| `profiles` | `id uuid PK FK auth.users`, `display_name`, `status enum(active,disabled)`, `created_at` | No editable role column; every authenticated active user may use student pages; admin access derives solely from `admin_memberships`, vendor access solely from `vendor_memberships` |
| `admin_memberships` | `user_id PK`, `granted_by`, `granted_at`, `revoked_at` | Trusted admin provisioning only |
| `zones` | `id`, `slug UNIQUE`, `name`, `description`, `is_enabled`, `display_order`, `simulated_capacity_hint nullable` | Public campus zone; hint is not real headcount |
| `vendors` | `id`, `zone_id FK`, `slug UNIQUE`, `display_name`, `status(pending,approved,suspended)`, `accepting_orders`, `min_lead_minutes`, `pickup_buffer_minutes`, `max_outstanding_orders`, `prep_capacity_units_per_15m`, `image_path`, timestamps | Index `(zone_id,status)`; data ownership via memberships |
| `vendor_memberships` | `vendor_id FK`, `user_id FK`, `role(staff,manager)`, `active`, composite UNIQUE | Index `user_id`; membership authorization |
| `vendor_hours` | `vendor_id`, `weekday(0-6)`, `opens_local`, `closes_local`, optional overnight handling | Multiple periods/day possible; define weekday convention Monday=0 |
| `vendor_closures` | `vendor_id`, `start_at`, `end_at`, `reason`, `created_by` | Use UTC actual timestamp ranges; disallow overlapping contradictory rules |

### 10.2 Menu and cart

| Table | Essential fields / constraints | Key indexes and notes |
|---|---|---|
| `menu_categories` | `id`, `vendor_id`, `name`, `sort_order`, `active` | Index `(vendor_id,sort_order)` |
| `menu_items` | `id`, `vendor_id`, `category_id`, `name`, `description`, `base_price_sen >=0`, `prep_minutes >=1`, `prep_work_units >=1`, `stock_remaining >=0 nullable`, `track_stock`, `max_qty_per_order`, `active`, `image_path`, dietary labels, timestamps | Index `(vendor_id,active)`; `null` stock only when `track_stock=false` |
| `item_option_groups` | `id`, `item_id`, `name`, `required`, `selection_min`, `selection_max`, `sort_order` | E.g. size (exactly 1), toppings (0–3) |
| `item_options` | `id`, `group_id`, `label`, `price_delta_sen` (nonnegative for P0), `active`, `sort_order` | Variant/modifier selection verified on server |
| `favourites` | `user_id`, `vendor_id nullable`, `item_id nullable`, CHECK exactly one target, UNIQUE per target | P1 |
| `carts` | optional persisted `user_id UNIQUE`, `vendor_id`, `updated_at` | P0 may keep non-sensitive cart in browser; always revalidate checkout |
| `cart_items` | only if persisted: `cart_id`, `item_id`, `quantity`, `selected_option_ids jsonb`, `notes` | Mutable preview only; never source of truth for price |

### 10.3 Orders and capacity

| Table | Essential fields / constraints | Key indexes and notes |
|---|---|---|
| `orders` | `id`, `public_code UNIQUE`, `student_id`, `vendor_id`, `zone_id snapshot`, `status`, `pickup_start_at`, `pickup_end_at`, `subtotal_sen`, `total_sen`, `payment_method`, `payment_status`, `paid_at_counter_reported_at nullable`, `idempotency_key`, `request_hash`, `placed_at`, `accepted_at`, `preparing_at`, `ready_at`, `collected_at`, `cancelled_at`, `cancellation_reason`, timestamps | UNIQUE `(student_id,idempotency_key)`; indexes `(vendor_id,status,pickup_start_at)`, `(student_id,created_at DESC)` |
| `checkout_quotes` | `id`, `student_id`, `vendor_id`, `request_hash`, `priced_cart_snapshot jsonb`, `candidate_slots jsonb`, `expires_at`, `created_at` | Short-lived 120-second *non-reserving* quote; query own only; server creates; commit confirms matching hash, quote age and selected candidate then revalidates full state. Periodically purge expired rows. |
| `order_items` | `id`, `order_id`, `menu_item_id nullable FK`, `name_snapshot`, `unit_base_price_sen`, `options_snapshot jsonb`, `unit_total_sen`, `quantity`, `line_total_sen`, `prep_work_units_snapshot` | Snapshots preserve historical pricing; validated totals |
| `order_events` | `id`, `order_id`, `actor_user_id nullable`, `event_type`, `from_status`, `to_status`, `metadata jsonb`, `created_at` | Append-only; indexes `(order_id,created_at)` |
| `capacity_slots` | `id`, `vendor_id`, `slot_start_at`, `slot_end_at`, `total_units >=0`, `reserved_units >=0`, `version`, UNIQUE(vendor_id,slot_start_at), CHECK reserved<=total | Locked transactionally; index vendor/time |
| `capacity_reservations` | `id`, `order_id UNIQUE`, `capacity_slot_id`, `units`, `released_at nullable` | P0 one pickup bucket/order; FK and release guard |
| `stock_movements` | `id`, `menu_item_id`, `order_id nullable`, `delta`, `reason`, `actor_id`, `created_at` | Append-only stock audit; prevent double release with uniqueness/logic |
| `pickup_tokens` | `order_id`, `token_hash`, `expires_at`, `redeemed_at`, `attempt_count`, `created_at` | Protect from client direct reads; hash never exposed |

### 10.4 FIF and operational data

| Table | Essential fields / constraints | Key indexes and notes |
|---|---|---|
| `student_class_blocks` | `id`, `student_id`, `title`, `start_at`, `end_at`, `recurrence_json nullable`, `source(manual,ics)` | RLS student only; P1 |
| `zone_observations` | `id`, `zone_id`, `vendor_id nullable`, `reporter_id`, `source(vendor,admin,student_opt_in,synthetic)`, `crowd_band`, `walkin_wait_min/max nullable`, `observed_at`, `expires_at`, `deleted_at`, `is_simulated` | P1; no public raw reporter metadata |
| `zone_activity_snapshots` | `id`, `zone_id`, `bucket_start_at`, `pickup_count`, `reserved_units`, `capacity_units`, `activity_band`, `observed_crowd_band nullable`, `confidence_label`, `source_summary jsonb`, `is_simulated`, `generated_at`, `expires_at`, UNIQUE(zone_id,bucket_start_at,is_simulated)` | Public-safe aggregate view, no personal data |
| `forecast_snapshots` | `id`, `scope_type(vendor,zone)`, `scope_id`, `bucket_start_at`, `predicted_orders`, `method_version`, `coverage_label`, `training_window`, `source_type`, `generated_at` | P1; forecast future only; synthetic tag |
| `reviews` | `id`, `order_id UNIQUE`, `student_id`, `vendor_id`, `rating(1-5)`, `comment`, `is_hidden`, timestamps | P1; check collected order in mutation |
| `notifications` | `id`, `recipient_id`, `type`, `title`, `body`, `target_path`, `read_at`, `created_at` | P1; access own only |
| `incidents` | `id`, `vendor_id nullable`, `order_id nullable`, `status`, `reason`, `resolution`, `created_by`, timestamps | P1 |
| `audit_events` | `id`, `actor_id nullable`, `actor_kind`, `action`, `target_type`, `target_id`, `reason`, `metadata jsonb`, `created_at` | Append-only, privileged select; never store secrets/token raw values |
| `system_settings` | `key UNIQUE`, `value jsonb`, `updated_by`, `updated_at` | Validated whitelist; P1 |

### 10.5 Data quality / schema requirements
- Monetary totals calculated in DB/backend integer arithmetic; ensure `line_total_sen = quantity * unit_total_sen` before persistence; never trust client total.
- All relationship foreign keys and integrity constraints implemented; vendor-specific child item matches parent vendor.
- Add `updated_at` triggers where needed; no user-facing editable timestamp.
- Avoid N+1 menu queries with joined queries / batched requests.
- Use check constraints to disallow negative stock/capacity and invalid dates; static enums can be PostgreSQL enums or `text CHECK`, but be consistent.
- `order_events`, `audit_events`, and `stock_movements` are append-only from authorised functions, not directly writable by browsers.
- Use least-privilege grants and per-table RLS. Put sensitive transaction functions in a `private` schema where possible and expose a narrowly scoped public RPC entry point; set `search_path` explicitly in `SECURITY DEFINER` functions.
- Seed 3 zones, 5–7 fictional vendors, 35–50 menu items, 2 vendor demo accounts, 1 admin account, 3 student accounts, 30 days synthetic historical demand/observations. All personally identifying seed values must be fictional.

---

## 11. Authorisation, RLS and server trust boundaries

### 11.1 Rules
- **Default-deny** RLS on every exposed user or business table; write explicit select/insert/update/delete policies by authenticated/anon roles.
- Public approved vendor details/menu/zone summaries may be read by anonymous clients, but vendor private metrics/order details cannot.
- Student `orders` SELECT policy requires `student_id = auth.uid()`; student direct INSERT/UPDATE/DELETE on orders must be denied and replaced by validated checkout/cancel RPCs.
- Vendor order SELECT requires active membership for `orders.vendor_id`. Updates happen only through transition RPCs and are revalidated under the authenticated actor.
- `profiles`: user can read/update safe profile fields on own row; role/admin membership is not client writable.
- `menu_items`: public approved items readable; write operations permitted only to assigned vendor staff/manager through validated server action, not direct arbitrary updates if they affect stock/price/stock history. Vendor may not touch competitor rows.
- `student_class_blocks`, `notifications`, `reviews` (pre-public moderation): only owner or explicitly permitted admin.
- `pickup_tokens`, `stock_movements`, `audit_events`: never expose token hashes or mutable private audit state to browser role.
- Aggregate traffic view `public_zone_activity` must select only nonidentifying fields; use materialized/server-computed summaries.
- Realtime private topic policies bind subscriber to exact student ID/order ID or vendor membership; do not broadcast raw entire order rows on public channels.
- All actor IDs determined from authenticated session (`auth.uid()`), never accepted from request payload as proof of identity.

### 11.2 Trust boundaries
1. Client components only hold Supabase publishable key and public non-secret config.
2. Next.js Route Handlers/Server Actions parse input with Zod, authenticate session via server auth helper, check role/scope and invoke DB RPC.
3. Sensitive checkout and order transition logic executes in a Postgres function within a single transaction to guarantee consistency across separate tables. A serverless JavaScript function cannot assume multiple independent Supabase REST writes are atomic.
4. Secret service keys and Gemini keys stay server-only (Vercel env); use least privilege; do not dump request headers or tokens into logs.
5. Storage upload policies constrain path to owning vendor and apply file-size/MIME restrictions.
6. Prevent CSRF and session misuse per official Next.js/Supabase auth guidance; never cache user-specific responses publicly.
7. Rate-limit login, quotes, checkout, reviews, QR attempts, observation submissions and Gemini endpoints. Apply IP and account limits while preserving accessibility.
8. Test RLS with pgTAP or scripted integration tests using different signed-in personas; do not assume passing client-side guards proves authorisation.

---

## 12. API contract (Next.js Route Handlers)

Routes use JSON except upload. Input validated with Zod and caller identity derived from session. Use stable error schema:

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "That pickup time is no longer available.",
    "requestId": "req_example"
  }
}
```

| Method | Endpoint | Role | Purpose | Priority |
|---|---|---|---|---|
| `GET` | `/api/vendors` | public | Filter/paginate published vendors | P0 |
| `GET` | `/api/vendors/:id/menu` | public | Vendor/menu/options/availability | P0 |
| `GET` | `/api/zones` | public | Enabled food-court zones | P0 |
| `POST` | `/api/checkout/quote` | student | Candidate pickup windows and authoritative cost preview | P0 |
| `POST` | `/api/orders` | student | Commit order through DB transaction | P0 |
| `GET` | `/api/orders` | student | Own paginated orders | P0 |
| `GET` | `/api/orders/:id` | owner/vendor/admin | Scoped order details | P0 |
| `POST` | `/api/orders/:id/cancel` | student/vendor/admin | Allowed cancellation | P0 |
| `POST` | `/api/vendor/orders/:id/transition` | vendor | Accepted/preparing/ready/reject transitions | P0 |
| `POST` | `/api/vendor/orders/:id/collect` | vendor | Atomic QR verification and handoff | P0 |
| `POST` | `/api/vendor/menu-items` | vendor | Create item, validate options | P0 |
| `PATCH` | `/api/vendor/menu-items/:id` | vendor | Update menu status/details | P0 |
| `PATCH` | `/api/vendor/capacity` | vendor manager | Update safe future configuration | P0 |
| `GET` | `/api/traffic/zones` | public/student | Aggregate traffic overview only | P0 |
| `GET` | `/api/traffic/zones/:id` | public/student | Fresh snapshots + provenance + recommendation | P0 |
| `POST` | `/api/admin/vendors/:id/approve` | admin | Approve vendor | P0 |
| `POST` | `/api/admin/vendors/:id/suspend` | admin | Suspend vendor with reason | P0 |
| `POST` | `/api/vendor/observations` | vendor/admin | Voluntary fresh queue/crowd report | P1 |
| `GET` | `/api/forecasts` | vendor/admin | DemandSense snapshots scoped | P1 |
| `POST` | `/api/timetable/import` | student | Parse/import ICS, explicit consent | P1 |
| `POST` | `/api/reviews` | student | Review collected order | P1 |
| `POST` | `/api/insights/explain` | vendor/admin | Optional Gemini explanation | P1 |

### 12.1 Checkout quote request example
```json
{
  "vendorId": "00000000-0000-0000-0000-000000000101",
  "items": [
    {
      "itemId": "00000000-0000-0000-0000-000000000201",
      "quantity": 2,
      "optionIds": ["00000000-0000-0000-0000-000000000301"],
      "notes": "Less spicy"
    }
  ],
  "preferredStartAt": "2026-11-03T04:30:00.000Z"
}
```

### 12.2 Quote response example
```json
{
  "quoteId": "example-non-authoritative-quote-id",
  "expiresAt": "2026-11-03T04:12:00.000Z",
  "pricing": { "subtotalSen": 2600, "totalSen": 2600, "currency": "MYR" },
  "slots": [
    {
      "startAt": "2026-11-03T04:30:00.000Z",
      "endAt": "2026-11-03T04:45:00.000Z",
      "canFulfil": true,
      "estimated": true,
      "reasonCodes": []
    }
  ]
}
```

### 12.3 Order commit request example
```json
{
  "quoteId": "example-non-authoritative-quote-id",
  "idempotencyKey": "08da6c7f-cc5a-4f75-90f9-060d6ebfcb1a",
  "vendorId": "00000000-0000-0000-0000-000000000101",
  "selectedPickupStartAt": "2026-11-03T04:30:00.000Z",
  "paymentMethod": "pay_at_counter",
  "items": [
    {
      "itemId": "00000000-0000-0000-0000-000000000201",
      "quantity": 2,
      "optionIds": ["00000000-0000-0000-0000-000000000301"]
    }
  ]
}
```

**Commit behaviour:** Ignore any client totals, infer student ID from session; load the server-generated `checkout_quotes` row and verify `student_id`, `vendor_id`, cart fingerprint, selected pickup window and expiry; then revalidate current menu/options, price, stock, capacity and hours. Either commit completely or fail completely. A quote ID is not a reservation. On repeated idempotency key with a **different** request payload, reject with `409 IDEMPOTENCY_KEY_REUSED`. Store canonical request hash in `orders.request_hash`; do not mistake same-key/repriced payload for a valid retry.

### 12.4 Suggested error codes
- `UNAUTHENTICATED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404, also use to avoid cross-tenant existence leaks)
- `VALIDATION_ERROR` (422)
- `OUT_OF_STOCK` / `SLOT_UNAVAILABLE` / `PRICE_CHANGED` / `VENDOR_CLOSED` / `INVALID_ORDER_TRANSITION` / `IDEMPOTENCY_KEY_REUSED` (409)
- `RATE_LIMITED` (429)
- `INTERNAL_ERROR` (500, no secret information)

---

## 13. Realtime, scheduled jobs and notification flows

### 13.1 Realtime requirements
- Prefer **Supabase Realtime Broadcast** with private channels, with a policy that verifies an order owner or vendor membership, for transactional updates. Postgres Changes may be used in the earliest prototype, but not as an unrestricted public order stream.
- Suggested private topics: `student:<uuid>:orders`, `vendor:<uuid>:orders`, `order:<uuid>:status` (validate authorisation server-side). Public traffic topics contain only aggregate `zone_id`, activity band, timestamp and confidence.
- UI must fetch authoritative state on initial load and after reconnect (event triggers invalidation, not the sole data source). Enforce event version ordering to ignore delayed state.
- Avoid one broadcast per keystroke or unchanged row; only publish persisted material events.

### 13.2 Scheduled tasks
| Job | Interval | Logic | Failure mode |
|---|---|---|---|
| `refresh_zone_activity` | every 1–2 min | Recalculate aggregate pickup/load snapshots and observation freshness | Mark stale, retain last verified timestamp |
| `expire_unaccepted_orders` | every 5 min | Expire only orders meeting explicit SLA and issue inventory/capacity release atomically | Retry idempotently |
| `flag_pickup_no_shows` | every 5–15 min | Flag overdue ready pickups; optionally require vendor confirmation | No automatic irreversible penalty |
| `generate_demand_forecasts` | nightly or every few hours | Refresh forecast snapshots from available history | Show previous version as stale; no invented value |
| `cleanup_expired_tokens` | hourly | Invalidate expired pickup tokens; do not delete audit trail | Safe retry |
| `aggregate_analytics` | every 15–60 min or on query | Update vendor dashboard summary materialisations | Dashboard timestamp and stale indicator |

Implement with Supabase Cron (`pg_cron`) and/or cron-triggered Edge Functions as appropriate. Record job last success/failure. Never rely on browser tabs remaining open to run business tasks.

### 13.3 Notification events
When status changes, insert notification for affected student, store event, then broadcast. For ready orders, include a direct link to QR/collection page, but never transmit the QR token itself via public notifications. Deduplicate notifications by event ID.

---

## 14. UX and design implementation details

### 14.1 Layout rules
- Consistent AP Food brand: university-friendly blue, white, slate, restrained teal or warm highlight. No ornamental giant charts, overflowing bento grids or excessive dashboard clutter.
- Student `/app`: the next actionable task (find food, active order) occupies most of the screen; traffic view gets a single small link/card, not six mini analytics panels.
- Student `/app/traffic`: lead with zone recommendation, then small comparison list + one time-series chart. Avoid heatmaps that imply precise geolocation without data.
- Vendor `/vendor/orders`: high-contrast order statuses, large touch controls, sorting by promised time, unambiguous action and escalation.
- Admin `/admin/traffic`: visually separate observed reports, model forecasts, synthetic scenarios, and live AP Food demand via labels/legend and distinct textures, not merely colours.
- Use skeletons, empty states, network retry and optimistic status UX only when conflict-safe. Server confirmation is necessary for irreversible order actions.

### 14.2 Responsive breakpoints and accessibility
- Baseline test at 390x844 mobile, 768x1024 tablet, 1440x900 desktop.
- Contrast at least WCAG AA where applicable. Always include icons/text for statuses; do not depend on red/green discrimination.
- Inputs keyboard navigable; labels and screen-reader descriptions provided; actionable controls at least reasonable touch size.
- Respect `prefers-reduced-motion`; avoid autoplay sound for incoming vendor orders unless explicitly enabled by user gesture.
- Debounce search, provide clear validation messages, and preserve cart on navigation/session refresh where safely possible.

### 14.3 Copy and trust labels
- Use `Estimated ready by …` before vendor confirms, `Scheduled pickup …` for the reserved window, `Ready for pickup` only once vendor has marked ready.
- Always display currency `RM` and taxes/fees accurately; P0 default no platform fee and no invented tax.
- Explicit `Demo payment—no money charged`; **do not show an actual APCard wallet balance.**
- Show `Estimated AP Food activity`, `Vendor-reported queue`, `Physical crowd not verified`, `Simulated scenario` according to source.
- Product may be styled to feel compatible with APspace, but avoid exact official trademark/SSO imitation without rights.

---

## 15. Engineering project layout and conventions

Suggested repository:

```text
ap-food/
├── app/
│   ├── (public)/
│   ├── (auth)/auth/
│   ├── (student)/app/
│   ├── (vendor)/vendor/
│   ├── (admin)/admin/
│   └── api/
├── components/
│   ├── ui/                 # design system
│   ├── student/
│   ├── vendor/
│   ├── admin/
│   └── shared/
├── lib/
│   ├── auth/               # role and session helpers
│   ├── supabase/           # browser/server clients
│   ├── validation/         # Zod schemas
│   ├── domain/             # types, invariants, errors
│   ├── fif/                # deterministic algorithms
│   │   ├── smartqueue.ts
│   │   ├── demandsense.ts
│   │   ├── schedulesync.ts
│   │   ├── flowsense.ts
│   │   └── insight-ai.ts
│   └── telemetry/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   ├── tests/              # RLS / function tests
│   └── functions/          # only scheduled/async tasks as needed
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── load/
├── docs/
│   ├── FEATURE_STATUS.md
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── TEST_PLAN.md
│   ├── DEMO_SCRIPT.md
│   └── DECISIONS.md
├── .env.example
└── README.md
```

**Tools:** Next.js App Router and strict TypeScript, Tailwind CSS, shadcn/ui, React Hook Form + Zod, Supabase JS, TanStack Query where useful for mutations/caching, Vitest unit tests, Playwright E2E and Supabase CLI for migrations and local dev. Prefer one codebase and one SQL schema; no Kubernetes, microservices or unnecessary orchestration. Keep route handlers thin and put shared rules in `lib/domain`/DB functions. Separate pure FIF algorithms from database adapters to make testing deterministic.

### 15.1 Environment variables
```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
GEMINI_API_KEY=
APP_BASE_URL=
APP_TIMEZONE=Asia/Kuala_Lumpur
DEMO_MODE=true
```
Names above follow current Supabase publishable/secret key terminology; adapt SDK helpers to exact current version. `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` are **server-only** and must never have a `NEXT_PUBLIC_` prefix. Production-like demo should have `DEMO_MODE` visibly enabled. Do not commit secrets or print them in CI logs.

### 15.2 Environments / deployment
- Local: Supabase CLI stack and Next.js dev server, migrations from repository, seeded synthetic accounts created via approved auth admin flow.
- Preview: Vercel preview deployment connected to **nonproduction** Supabase project, protected when necessary; prevent exposing seeded demo personal-looking records as real.
- Production demo: Vercel project with HTTPS custom/default URL and separate Supabase project if budgets permit. Configure auth redirect URLs, env vars, database migrations and post-deploy smoke checks.
- Vercel Hobby use must comply with applicable plan terms, particularly if product is commercially deployed. A hackathon deployment is not permission to violate plan restrictions.
- GitHub Actions (or Vercel integration) runs `lint`, `tsc --noEmit`, unit, integration where secrets available, and Playwright smoke suite; migrations are reviewed and applied intentionally.
- Configure Supabase/Vercel usage notifications and provider spend caps where available. Gemini request caps handled in-app.

---
## 16. Acceptance-test matrix (the build is not complete without these)

Automate wherever possible. Use fixed clocks and deterministic seeds for time- and forecast-dependent tests.

| ID | Test scenario | Expected result | Priority |
|---|---|---|---|
| AT-001 | Student creates account then opens `/app` | Student-only app renders; role persists after refresh | P0 |
| AT-002 | New student navigates `/vendor` or `/admin` | Server denies access; no data leakage | P0 |
| AT-003 | Vendor A token reads Vendor B order/menu-private endpoint | Denied even if UUID known | P0 |
| AT-004 | Student A requests Student B's order/QR | 403/404 and no token or metadata exposure | P0 |
| AT-005 | Search by meal name and zone with published/open filters | Correct set, stable pagination | P0 |
| AT-006 | Item with required size omitted | Server validation rejects cart commit | P0 |
| AT-007 | Client changes `totalSen` or unit price field | Ignored/rejected; authoritative server price used | P0 |
| AT-008 | Student adds items from second vendor | Clear-cart consent required | P0 |
| AT-009 | Quote for pickup when vendor closed | No feasible window; clear reason | P0 |
| AT-010 | 20 concurrent one-unit checkouts; 5 units stock and capacity | Exactly <=5 successful orders, no negative stock or over-capacity slots | P0 |
| AT-011 | Retry POST with same idempotency key and exact body | Same order ID and no duplicate allocations | P0 |
| AT-012 | Retry same key with changed body | 409 `IDEMPOTENCY_KEY_REUSED` | P0 |
| AT-013 | Quote becomes stale because another purchase fills slot | Commit 409 `SLOT_UNAVAILABLE`, no partial order | P0 |
| AT-014 | Stock depleted between menu page and checkout | 409 `OUT_OF_STOCK`, checkout recoverable | P0 |
| AT-015 | Student pays via demo mode | Explicitly simulated, no external payment call | P0 |
| AT-016 | Place order -> vendor sees it on kitchen board | Scoped realtime and source-of-truth fetch | P0 |
| AT-017 | Vendor accepts/prepares/readies order | Student sees valid step progression after refresh/reconnect | P0 |
| AT-018 | Invalid state transition `ready→accepted` | Rejected, audit remains consistent | P0 |
| AT-019 | Student cancels before prep | Status cancelled, stock+capacity restored once | P0 |
| AT-020 | Vendor cancels after prep started | No automatic stock restock | P0 |
| AT-021 | Valid QR redeemed by assigned vendor | Collected once; event logged | P0 |
| AT-022 | Reused, expired, other-vendor or wrong-order QR | Denied; status unchanged | P0 |
| AT-023 | Vendor changes menu price post-checkout | Existing order retains snapshot; new quotes reflect current price | P0 |
| AT-024 | Vendor pauses acceptance | New quotes unavailable; existing orders remain visible | P0 |
| AT-025 | Admin suspends vendor | No new orders; existing order resolution remains accessible | P0 |
| AT-026 | Admin approval/override action | Action reason and actor stored in audit | P0 |
| AT-027 | New order placed for zone A | Activity snapshot changes for A only; no exposed student identity | P0 |
| AT-028 | Zone B has no orders and no crowd reports | UI shows limited data / unknown, NOT “empty” | P0 |
| AT-029 | Snapshot older than freshness threshold | Label becomes stale/unknown; timestamp visible | P0 |
| AT-030 | Simulated campus traffic peak activated | UI visibly labels synthetic source; no claim of live sensing | P0 |
| AT-031 | User on 390px mobile width | No horizontal overflow or inaccessible checkout controls | P0 |
| AT-032 | No network during status refresh | Existing state shown with reconnect notice, not false “ready” | P0 |
| AT-033 | Class overlaps pickup window | ScheduleSync rejects from feasible suggestions | P1 |
| AT-034 | Student has no timetable configured | Ordering still fully functional | P1 |
| AT-035 | Vendor manual observation is >20 min old | Does not determine current reported crowd condition | P1 |
| AT-036 | Vendor/admin reports contradict one another | `Mixed reports` / lowered confidence | P1 |
| AT-037 | Historical demand has gaps | Forecast marks low coverage or uses documented fallback | P1 |
| AT-038 | Completed order owner reviews once | Review accepted once; duplicate rejected | P1 |
| AT-039 | Gemini provider absent/error/timeouts | Main app and FIF calculations work with deterministic fallback | P1 |
| AT-040 | Tenant-specific Realtime subscription attempt by unauthorised user | Subscription rejected or yields no events | P0 |
| AT-041 | Worker called twice for same expired order | No double stock/capacity release | P0 |
| AT-042 | Last available item sold via two tabs at once | At most one successful order; correct 409 to other | P0 |

### 16.1 Minimal automated suites
1. **Unit**: pure money calculation, option validation, SmartQueue candidate enumeration, order state reducer, FlowSense bands, stale/unknown logic, time conversion, ScheduleSync intervals.
2. **DB integration**: transaction race conditions, stock movements, quota allocation, idempotency, RLS allow/deny and QR atomic redemption.
3. **E2E Playwright**: at least student checkout, vendor fulfilment, student collection, admin suspension, traffic insights, authentication/unauthorised access, mobile viewport.
4. **Performance**: load generator for 100+ quotes/minute (report actual test results), checkout contention for 20 concurrent clients and mocked realtime reconnect.
5. **Usability**: 3–5 real testers with separate student/vendor tasks, measure success/time/errors; report observations rather than claim statistically representative results.

### 16.2 Release checklist
- [ ] P0 screens exist, route correctly and show real own database values.
- [ ] Domain invariants hold under concurrency tests.
- [ ] All exposed tables have reviewed RLS policies and least-privilege grants.
- [ ] No admin/vendor role escalation through profile or JWT manipulation.
- [ ] Menu totals and payment/demo labels are accurate.
- [ ] Order lifecycle is audited and status change works with broken network/retries.
- [ ] QR tokens are random, short-lived, hashed and one-time.
- [ ] Student traffic module differentiates app demand, physical crowd reports, forecasts and synthetic scenarios.
- [ ] No personally identifying order data sent on public realtime channels or to Gemini.
- [ ] Database seeds and migrations work from clean environment.
- [ ] Vercel deployed preview and demo paths pass smoke tests.
- [ ] Accessibility and responsive checks pass at key viewport sizes.
- [ ] Live demonstration runs with seeded fallback data if campus networks are unavailable.

---

## 17. Two-week execution schedule, dependencies and cuts

Assume one to three developers with AI coding assistance. This is an aggressive but bounded P0. A solo developer should explicitly postpone P1 except one showcase enhancement.

| Day | Delivery | Non-negotiable completion evidence |
|---|---|---|
| 1 | Repo + design tokens + requirements + schema/ERD, Supabase local + Vercel project | App deploys basic page, migrations execute cleanly |
| 2 | Auth, profiles, roles, vendor memberships, RLS baseline, seeded users | Cross-role allow/deny tests pass |
| 3 | Vendor catalogue, menu/variants, image storage, student search | Published vendor/menu public, private edit protected |
| 4 | Student cart + authoritative pricing + checkout quote | Checkout page handles invalid options and price change |
| 5 | Transactional order commit, stock and capacity allocation, idempotency | Concurrent stock/capacity test passes |
| 6 | Vendor kitchen board, transitions, order event log, realtime | End-to-end order placed through ready works |
| 7 | QR redemption + cancellation/expiry + admin vendor controls | Core transaction and state suite passes |
| 8 | FIF SmartQueue refinement, ETA explanations, vendor capacity configuration | Schedule has no overbooking under test |
| 9 | **FIF FlowSense P0**: zone aggregate snapshots, activity indicators, student traffic page | Shows source + freshness, updates with real app order events |
| 10 | Traffic scenario generator, comparison charts, admin traffic controls | Demo simulates peak and recommendations change, clearly labelled |
| 11 | Stabilise P0 and add one P1: manual crowd reports or ScheduleSync | Cross-role happy path stable and tested |
| 12 | Add one P1: demand baseline forecast or vendor analytics; optional Gemini explanation after core is safe | Forecast explicitly qualified; optional AI disabled without regressions |
| 13 | Security/UX hardening, E2E, load, accessibility, backup demo data | Checklist complete, documented known issues |
| 14 | Production demo deploy, rehearsed presentation, screenshots, video backup | Judge demo runs from browser without code changes |

### 17.1 Critical path
**Schema/RLS → catalogue → atomic checkout → kitchen statuses → QR pickup → traffic aggregation → live pitch.** These pieces depend on each other. Do not build an elaborate forecasting model before checkout works.

### 17.2 If behind schedule
Cut in this order: (1) rewards/loyalty (P2); (2) generative AI (P1/P2); (3) user timetable ICS (P1); (4) advanced forecasting (P1); (5) reviews/favourites/notifications (P1); (6) vendor menu complexity (keep one required option group). **Never cut** inventory/capacity transaction correctness, role permissions, end-to-end fulfilment, or honest traffic labels. If traffic aggregation is delayed, ship a transparent read-only view of current pickup activity with limited data labels rather than inventing real-world crowd data.

---

## 18. Demonstration design and evaluation

### 18.1 Required demo personas and synthetic world
- **Student:** “Amina”, with active school schedule and access to AP Food. Fake account only.
- **Vendor A:** “Campus Noodle Bar”, zone Main Food Court, six prep work units per pickup bucket; 4–8 items.
- **Vendor B:** “Brew & Bites”, same zone but different prep capacity and stock.
- **Vendor C:** “Green Bowl Kitchen”, zone Annex Cafeteria.
- **Admin:** “Campus Operations”, can view zone-level demand and approve/suspend vendors.
- **Traffic scenario:** labelled synthetic 12:00–13:00 rush with growing pickup counts and manually generated observational bands; reset action is limited to isolated demo mode.
- Seed other menus and history for realistic browsing and charts; only demonstrator account can mutate live P0 order records during presentation.

### 18.2 Three-minute live demo script
**0:00–0:25 — Student context.** Open mobile student home. Show two available campus food zones, an upcoming class break, and a succinct **Food Court Activity** card distinguishing demand estimate and verified physical-crowd status.

**0:25–0:55 — Intelligent decision.** Open Traffic view. Compare high-demand and lower-demand zones; select a vendor and available pickup slot. Explain that FIF calculates order load and does not claim to count everyone on campus.

**0:55–1:25 — Order.** Select meal and modifiers, review RM price, pick a viable 15-minute collection window, use demo payment, and commit. Show fresh order ID and explicit simulated-payment banner.

**1:25–1:55 — Operations.** Switch vendor browser/tab: kitchen board receives order. Move through accepted → preparing → ready. Student view receives status without refresh.

**1:55–2:20 — Pickup.** Student displays QR; vendor verifies and marks collected. Show invalid replay rejected in a second quick scan.

**2:20–2:50 — FIF intelligence.** Simulate new concurrent orders / lunch rush; original slot fills, later requests see later feasible windows. Traffic view updates order-activity estimate and `best window` recommendation. Show source/last-updated metadata.

**2:50–3:00 — Operations value.** Admin overview shows queue, approved vendors, zone workload, and audit trail. Conclude with measured reliability/performance from test results, not invented customer savings.

### 18.3 Judge-facing claims (safe and specific)
- “Orders, stock and pickup capacity are transactionally validated in Supabase PostgreSQL.”
- “FIF SmartQueue schedules feasible pickup windows without using a generative model.”
- “Food Court Activity estimates app-based demand; manually observed physical queues are labelled separately.”
- “The entire prototype runs on Vercel and Supabase and can operate even without Gemini enabled.”
- “Vendor data and student orders are isolated by role-based authorisation and RLS.”

Do **not** claim a verified reduction in campus queues without before/after measurements, real APspace or APCard integration, sensor-derived occupancy, or millions of students supported absent evidence.

---

## 19. Costs, controls and deployability

### 19.1 Hackathon cost assumptions
The two-week demo may fit within eligible Vercel/Supabase free allowances, but **this is not a guaranteed $0 deployment**. Supabase storage, database/compute, realtime messages, egress, email/OTP, Vercel bandwidth/functions and optional Gemini API use may incur limits/charges depending on plan. Free projects may pause when inactive. Confirm current plan/terms before deployment, especially whether the use qualifies for Vercel Hobby.

### 19.2 Usage controls
- Rate-limit quotes/checkouts and cap requests per account/IP.
- Keep only one active Realtime channel per relevant page and unsubscribe on unmount.
- Aggregate zone signals server-side; don't stream individual order events to all users.
- Schedule forecast jobs instead of generating on every page view.
- Resize/compress images, limit upload size and serve cached menu assets.
- Restrict log payloads and retention; avoid storing QR token, auth token, student note text in audit metadata.
- Gemini optional; per-role request budgets, token ceilings, timeout and fallback.
- Disable demo traffic scenario controls in production-like unlabelled mode; show clear seed/demo banner.

### 19.3 Portability
Use standard SQL migrations, typed domain services and minimal proprietary dependencies. If APU later chooses AWS, the Next.js frontend/domain logic could be moved with effort, and PostgreSQL can be migrated; Supabase Auth, Storage and Realtime require replacement/adapters and are **not automatically portable**. Keep interfaces under `lib/adapters/` if feasible.

---

## 20. Risks and mitigations

| Risk | Likelihood/impact | Mitigation |
|---|---|---|
| Kitchen workload abstraction doesn't match real kitchen preparation | High / medium | Vendor-configurable units; claim *estimated* readiness; calibrate from actual prep times; never claim exact guarantees |
| Physical food-court crowd cannot be directly measured | High / high | Keep separate order activity and observed crowd statuses; observation TTL/provenance; unknown fallback |
| Overselling inventory during simultaneous checkout | Medium / critical | Transaction-scoped locks, atomic decrement, idempotency, constraints and concurrency tests |
| Vendor never processes order | Medium / high | Visible SLA countdown, reject/expire workflow, student notice, no irreversible silent status |
| Student no-shows | Medium / medium | Grace-period status, vendor confirmation, operational analytics; no real financial penalty in demo |
| Vendor doesn't want extra workflow | Medium / high | Two-tap kitchen operations, large buttons, test with vendors if permitted |
| Fake or misleading traffic metrics | Medium / high | Source labels, timestamps, simulated badge, avoid raw percentages of physical occupancy |
| User data leak via RLS/realtime | Medium / critical | Default-deny policy, DB access tests, private channels, safe aggregate views |
| Deadline overrun from too many features | High / high | P0/P1/P2 gates, day-7 core demo, P1 strict cuts |
| Hosting limits/plan eligibility | Medium / medium | Usage monitoring, no heavy polling, confirm account terms, simple deployment fallback |
| Payment or APCard permissions | High / high | No live payments in MVP; explicitly simulated/pay-at-counter only |
| App branding confusion with official university services | Medium / high | Unofficial prototype disclaimer; request approvals before actual APspace branding or SSO integration |

---

## 21. Delivery artifacts and handoff contract

The implementing agent/team must deliver:
1. Fully functioning Git repository with README, setup commands, architecture and route overview.
2. Supabase migrations, RLS/grants, required RPC functions, seeded fictional test data and admin bootstrap instructions.
3. Next.js student/vendor/admin portals with P0 functionality and responsive states.
4. FIF SmartQueue, FlowSense, plus any completed P1 systems as isolated tested modules.
5. Environment variable template with secret-handling instructions; Vercel deploy notes and demo URL maintained by team.
6. Automated tests for pricing, state machine, transactions, RLS, traffic labels and end-to-end fulfillment.
7. A truthful feature-status file listing implemented, tested, deferred and known limitations.
8. Demo script with test personas, replay instructions, and screenshots/video fallback.
9. Recorded actual load-test results and hosting usage, if claiming capacity or cost benchmarks.
10. Privacy, data-provenance and production-integration caveats prominently documented.

**Definition of Done:** A judge on a fresh browser can sign in as a fake student, choose a vendor, place a valid pickup order, observe vendor fulfilment in a separate browser, redeem a one-time QR, see an admin audit record, and inspect Food Court Activity with correct source/freshness indicators. No manual SQL intervention is needed.

---

## 22. Bootstrap prompt to give an AI coding agent

> You are implementing AP Food — Powered by FIF. Read `AP_Food_FIF_Agent_Ready_MVP_Spec.md` completely and treat Sections 0, 9, 11 and 16 as non-negotiable system invariants. Build in the priority order of Section 17. Use Next.js App Router, strict TypeScript, Tailwind/shadcn, Supabase Auth/PostgreSQL/Realtime/Storage, and Vercel deployment. Start with an implementation plan, ERD, migration/RLS plan and feature-status tracker, then build a working P0 vertical slice from student checkout through vendor fulfilment and QR collection. Implement FIF SmartQueue and FlowSense as deterministic, tested modules; be explicit that Food Court Activity measures only app-based demand unless manually observed. No real APU/APCard integration, no real payments, no invented physical occupancy, no exposed service secrets. After each milestone, run tests and update `docs/FEATURE_STATUS.md` with actual evidence. Do not leave clickable but inert UI. When time is limited, apply the documented cuts rather than compromising transactions or access control.

---

## 23. Official technology documentation references

These links are implementation references, not proof of any institutional integration or vendor adoption:
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Realtime database changes (Broadcast recommended for scalability): https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
- Supabase Realtime Broadcast: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase scheduled Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase server-side auth in Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Vercel Next.js deployment: https://vercel.com/docs/frameworks/full-stack/nextjs
- Supabase local development: https://supabase.com/docs/guides/local-development

## 24. Decisions log

| Decision ID | Decision | Rationale |
|---|---|---|
| ADR-001 | Next.js + Supabase + Vercel | Fast implementation and managed PostgreSQL/Auth/Realtime for 14-day hackathon |
| ADR-002 | One vendor per order | Preserves reliable kitchen allocation and avoids multi-merchant settlement |
| ADR-003 | P0 pickup only | No rider/delivery logistics |
| ADR-004 | Demo payment/pay at counter | No authorisation for APCard or real payment infrastructure |
| ADR-005 | FIF deterministic core | Protects correctness, predictability and cost efficiency |
| ADR-006 | FIF FlowSense added to P0 | Direct student value via food-court activity and pickup traffic intelligence |
| ADR-007 | No passive physical tracking | Privacy, feasibility and lack of sensor infrastructure |
| ADR-008 | Traffic estimates must expose provenance | Avoid implying order counts equal actual campus footfall |
| ADR-009 | P0 single-slot capacity abstraction | Feasible in two weeks, transactional and honest about its limits |
| ADR-010 | Real-time aggregate view, not order broadcast to whole campus | Protects privacy and reduces realtime fan-out cost |

**Change policy:** Record new features with IDs, priorities, data/privacy implications, API changes and acceptance tests. Update the WhatsApp brief and this document together.
