# Admin command centre

Implemented against hosted Supabase project `vymnnyyuiujmxxycqiod`. The admin area supervises combined vendor performance; its cashflow is not the cafeteria operator's accounting profit.

## Interface and modules

The existing top navigation now opens a mustard/espresso overview, financials, products, vendor oversight, traffic and pickups, users, and a paginated audit trail. FIF is now the first dashboard section after filters, with AI-written assessments of vendor expansion, menu breadth and vendor performance. Its selected plan drives a shared FIF Optimized preview across KPI cards, financial trends, vendor comparisons, fulfilment, the cashflow outlook and the oversight table. Recorded baselines remain visible; live queue and stock facts are never replaced by an estimate. The overview includes six KPIs, operational exceptions, daily finance trends, sortable vendor comparison, pickup demand heatmap, fulfilment outcomes, expanded FIF insights, a cashflow outlook and a searchable vendor table. Filters cover Today, 7, 14, 30 and 90 days, food court and stall. Links retain scope.

Vendor review is a URL-addressable drawer at `/admin/vendors?vendorId=<id>&days=7`. It shows staff assignments, historical performance, current kitchen counts, stock and recent stall-targeted management events. Existing approval/food-court controls and reason requirements are reused. The schema has approved and suspended states; no fictitious pending-approval workflow was introduced. Staff assignments link to the existing user-management safeguards.

Financials retain counter/DuitNow/demo channel totals, unpaid counter visibility, shared overhead, expense posting and reversal. The ledger is server-paginated in 50-row pages; reversal availability is checked independently of page boundaries. Daily CSV/PDF exports include all aggregate days in scope. The vendor oversight CSV/PDF exports include every locally filtered vendor, not just the current table page. Existing full report tools remain available.

## Data and security

- `GET /api/admin/overview` returns bounded database aggregates, rather than raw order histories. Current kitchen counts include older active orders.
- `GET /api/admin/vendors/:id/overview` adds assigned staff and the latest 20 stall-targeted management events.
- `GET /api/admin/ledger` returns 50 ledger rows plus reversal state, bounded to the overview's reporting timestamps.
- `GET /api/admin/audit-page` supports pagination, actor, target, search and time filters.
- Vendor filtering on `GET /api/admin/users` uses an admin-only staff-assignment query.
- New database functions follow the existing admin-restricted `security definer` pattern, with empty search paths, qualified objects, `private.require_role('admin')`, revoked public/anonymous execution, and no changes to existing RLS policies or business records.

Migrations `20261113000300`–`20261113000600` are applied. They add aggregate reporting, explicit historical zone consistency, payment breakdowns and supporting indexes. Vendor/student endpoints and the legacy report contract remain compatible.

Receipts follow ledger timestamps. Net cashflow subtracts expenses/refunds and adds reversals. Shared overhead is never arbitrarily allocated to vendors. Historical order counts follow creation dates, collected item values follow collection dates, and the collection rate uses collected / closed orders. Current live operational snapshots are labelled separately. Previous comparisons use matching elapsed periods; absent baselines are unavailable. Readiness reports require actual readiness timestamps.

## FIF for administrators

`POST /api/fif/admin-insights` uses Gemini to write zero to four evidence-backed recommendations. The server retains authorised targets, checks evidence references and numerical claims, and generates internal review links. Source snapshots are fingerprinted; results cache for five minutes by user, scope and evidence. Rate limit: 12 insight generations per hour. Missing credentials, rate limits or provider/validation failures never produce rule-written replacement advice.

Quantified impact is optional. Gemini can select a disclosed 5–40% recovery assumption against actual recorded unsuccessful-order values; the former fixed 5% assumption has been removed. A campus programme can cover multiple stalls, with each vendor counted once even if individual recommendations overlap. Integer-sen receipts and a bounded recorded net-to-receipts proxy determine projected cashflow; no free revenue is assigned to new vendors or cuisines. The shared preview includes potential collections and collection rate, without inventing additional placed orders or changing live kitchen/stock data. Selecting or removing actions updates all affected views. The outlook offers 30/60/90/180 days, never compounds gains, and includes a separate zero-based incremental-recovery chart so modest changes remain readable without distorting the total-income scale. Changed source evidence withholds stale projections.

`POST /api/fif/admin-chat` uses the shared Gemini tool runtime with read-only aggregate, vendor-detail and local-condition tools. The assistant inherits current scope; explicit all-campus requests can broaden it. Tools provide RM values and formatted MYT dates, omit staff/customer identities and return only validated internal management links. Conversations use per-account browser session storage and clear on sign-out. Rate limit: 60 requests per hour. There is no AI write/execute endpoint.

Background reporting refreshes every minute while visible and on focus, deduplicates in-flight reads and preserves the last successful view on refresh failure. Generation never scrolls automatically; the AP-branded hint has an explicit view button. Number/chart transitions respect reduced motion. Drawers become full-height sheets on phones.

## Verification and limits

Verified locally and against the hosted project:

- Overview, 90-day filters and daily ledger reconciliation; 390/768/1440 layouts without page overflow.
- Vendor detail, staff data and saving the existing approval/food-court assignment with a recorded reason.
- Posting and reversing an RM 1 verification expense; the pair has zero net cashflow effect and remains labelled in the ledger.
- Products, assigned users, audit and traffic at phone width.
- Live Gemini recommendations with at most four results, and a live assistant answer using actual vendor rankings, RM values and the correct MYT snapshot time.
- Unit/database coverage for role isolation, suspended accounts, older active orders, shared overhead, reversals, historical zone changes, stale fingerprints, non-overlapping projections, missing/provider-failed AI, cached evidence and read-only assistant tools.

Sales/payments remain demonstration data. Weather is labelled live only when observed. Customer demographics, timetables, ingredient costs and future weather are not connected. No sample data was regenerated, no deployment was performed and no changes were pushed. Email-auth verification, Vercel staging and Google sign-in are separate follow-up work.
