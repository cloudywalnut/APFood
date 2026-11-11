# AP Food · APSpace frontend plan

Prepared before application implementation, 11 November 2026. This is a separate local frontend version, based on the original AP Food code. The original repository and backend remain unchanged.

## Reference provenance

Primary: 38 validated native screenshots under `01_apspace_actual` in the supplied ZIP. `02_adjacent_reference_only/01_aida...` and `41_fyp...` are adjacent inspiration only, never evidence of native APSpace components. The separately attached composite is an AP Food concept, secondary to native screenshots. The file `01_apspace_actual/19_student-login.png` is visually an AIDA analytics dashboard despite its filename and folder; it is excluded from native evidence. There are therefore 38 accepted native images and three adjacent/non-native images. Personal names, identifiers, balances, photos and other account data in screenshots must not enter application fixtures or public assets. Reference files remain outside the application public directory.

## Reusable UI and native evidence

| Component | Native reference | Application use |
|---|---|---|
| Desktop icon bar, search, active underline | 03, 09 | Common role shell, global module search |
| Mobile bottom navigation, first-use tour | 02 | Up to five primary destinations, More, optional skippable tour |
| Module cards and grouped More links | 03, 09, 37 | Role entrances and complete feature navigation |
| White rounded panels, rows, separators, chevrons | 05, 06, 12, 13, 14 | Stalls, meals, orders, ledger, notifications |
| Underlined tabs and expandable sections | 04, 14, 20, 23, 31 | Menu/deals/info, orders, QR/manual, order summaries |
| Expandable filters and dropdowns | 05, 11, 26, 28, 32 | Search, court, availability, period, scenario, products |
| Modal sheet with close control and structured form | 07, 08, 16, 21, 34 | Item extras, replacement, rejection, cancellation, expenses |
| Radio and checkbox groups | 17, 28, 36 | Payment, preferences, visibility and confirmations |
| Time grids, booking summary | 24, 25, 27, 29, 34 | Today-only feasible 15-minute pickup windows |
| QR/manual tabs, code emphasis and expiry | 20 | Actual five-minute pickup token, not screenshot's three-digit OTP |
| Summary cards, simple charts, detail tables | 05, 22, 33 | Existing admin operational/financial metrics |
| Report-filter modal | 30 | Client PDF/CSV report export from demo data |
| Error/success feedback | 35; shared success pattern confirmed in brief | Clear validation, confirmations and success feedback |
| Preferences groups | 36 | Display density, timezone display and tutorial preferences |
| About, policies and demo entry | 18, 39, 40 | Demo-only role selection, help and policies; no fake SSO |

## Complete feature-to-page map

| Role/page | Existing features preserved | Main components |
|---|---|---|
| Public `/` | Landing, three persona entrances, deals, policy/storage links | ModuleHero, RoleTile, DealCard, Footer |
| `/auth/login`, `/auth/register` | Fictional demo entrances and student registration entrance | DemoPersonaPanel |
| Student `/app` | Featured feasible pickup, Soonest/Lower load, kitchen load, active order shortcut, deals, campus stalls | RecommendationCard, SegmentedControl, ActiveOrder, StallRow |
| `/app/vendors` | Search by stall/dish/category, food court, pickup availability; category chips are a view extension | SearchField, FilterPanel, Chips, StallList |
| `/app/vendors/:id` | Stall description, court/hours, menu, discounted/base prices, sold out/paused states, item extras/quantity, cart link | StallHeader, LoadMeter, TabBar, MealRow, MealEditor, BasketDock |
| Item dialog | Side price, quantity/stock validation, cross-stall replacement confirmation, errors and confirmation | ModalSheet, CheckboxField, QuantityInput, Feedback |
| `/app/cart` | One-stall basket, quantities, delete, unit prices, subtotal, return to menu | CartList, QuantityStepper, SummaryCard |
| `/app/checkout` | Feasible 15-minute windows, earliest recommendation, full slots disabled, demo/pay-at-counter, authoritative demo total, placement errors | CheckoutSteps, SlotGrid, PaymentChoices, ReviewSummary |
| `/app/orders` | Active and historical orders, status, stall, pickup and total | UnderlinedTabs, OrderRows |
| `/app/orders/:id` | Full stage timeline, date/court/payment/items/total, placed/accepted cancellation, status sync | OrderTimeline (custom), DetailTable, Accordions, CancelDialog |
| Pickup code dialog | Scannable QR, actual text token, five-minute expiry, copy, regenerate, QR fallback | PickupCodePanel, QR/Manual tabs |
| `/app/traffic` | Courts, accepting stalls, work-unit capacity, scheduled pickups per window, load classification, next slot, source disclosure | CourtCard, BucketChart, AvailabilitySummary |
| Vendor `/vendor` | Stall selector, FIF shift brief, active/ready/low-stock metrics, upcoming pickups | PageHeader, RecommendationCard, MetricCard, PickupList |
| `/vendor/orders` | New/Accepted/Preparing/Ready, counts, sorted pickups, stage actions | KitchenBoard (custom), TicketCard |
| `/vendor/orders/:id` | Lines/extras/payment/total, accept/prepare/ready, reject/cancel with reason, token verification, counter payment confirmation, collection and updates | OrderDetail, ReasonDialog, VerifyPickupDialog, UpdateRows |
| `/vendor/menu` | Item search, add/edit name/description/price/stock/work units, publish/hide, stock/status | FilterPanel, DataTable, ItemForm |
| `/vendor/capacity` | Hours text, capacity/15 minutes, preparation lead, commitments constraint, pause/resume, first-window utilisation | SettingsGroups, NumberField, IntakeToggle, LoadMeter |
| Admin `/admin` | FIF Ops Desk, net flow/due pickups/active/low-stock cards, cashflow chart/data, stall comparison, late pickups/capacity/net flow | MetricGrid, RecommendationCard, ChartPanel, DataTable |
| `/admin/cashflow` | Period/court/stall/scenario filters; receipts/expenses/reversals/net; demo/counter/pending/ordered value/overhead; ledger type filters; expense recording/categories/allocation/note; reasoned reversal with original retained | FilterPanel, MetricGrid, FinanceBreakdown, LedgerRows, ExpenseDialog |
| `/admin/products` | Scoped product search, units/value/stock sorting, low-stock filter, stock/publication status | FilterPanel, DataTable |
| `/admin/vendors` | Court/approval/intake/active orders, approve/suspend/reassign with reason | VendorRows, GovernanceForm |
| `/admin/traffic` | Court/stall/scenario filters, Standard/Light/Medium/Heavy, dataset/collected/cancelled/active counts, bucket load, next feasible slot, unverified physical crowds | ScenarioSelect, SummaryCards, CourtCard |
| `/admin/audit` | Actor filter, text search, timestamp MYT, action, target, detail | AuditRows, FilterPanel |
| All role More pages | Explicit access to every role feature; role switching, reports, preferences and help | ModuleGrid, GroupedLinks |
| Added reports | Filtered orders/finance/stock snapshot; client PDF/CSV download, clear demo source | ReportDialog, TypedReport, export adapter |
| Added preferences | Consistent AP Food palette; compact/comfortable list density, Malaysia/local time display preference, replay tutorial | RadioGroup, Switch, grouped cards |
| Shared policies/storage | Privacy, terms, browser-only disclosure and reset; cross-tab sync; empty, loading, unavailable and validation states | PolicyPanel, ConfirmDialog, Feedback |

## Components not native to APSpace

Cart/meal extras, price promotions, capacity-aware checkout, order timeline, kitchen Kanban, food load indicators, FIF action/evidence cards, vendor governance and finance reversal are AP Food-specific. Compose these from native spacing/cards/status/forms/tabs. Do not label a Kanban or AIDA-style KPI strip a native APSpace component. APCard transaction rows are not links to an invented native transaction-detail page. The existing AP Food order detail is explicitly an AP Food page.

## Frontend architecture

- `app/`: routing, metadata and one global theme entry.
- `components/apspace/`: shared Shell, RoleNavigation, ModuleSearch, TabBar, FilterPanel, SectionCard, ListRow, StepIndicator, Feedback, Tutorial, report/settings views.
- `components/student.tsx`, `vendor.tsx`, `admin.tsx`: role workflows preserved from the original, composed with the shared primitives.
- `lib/demo.ts`: current typed Vendor, Item, CartLine, Order, Entry, Audit and DemoState; integer MYR sen, Malaysia operational dates, snapshotted order prices.
- `services/contracts.ts`: asynchronous Catalogue, Checkout, Fulfilment, Finance, Reports and Preferences contracts, typed inputs/results/errors. No credentials or server calls.
- `services/mock.ts`: browser adapter over the existing local store; new UI commands use this adapter. Existing compatibility exports remain during incremental migration. Cache updates and cross-tab subscriptions remain in the existing store.
- `services/index.ts`: a single exported mock implementation; a future authenticated HTTP adapter can implement the same interfaces. Network transport, auth/RLS and transactions are not implemented here.
- `lib/report-export.ts`: client-only PDF/CSV encoding from a typed report snapshot, no external upload.
- `app/apspace.css`: named cream/espresso/mustard tokens, shared sans typography, focus/error/success states, 390/768/1440 layouts. Operational controls remain readable, no decorative creative styles.

## Future API seams and assumptions

1. Identity: APSpace SSO, role memberships, stall assignment, logout/session expiry and permission contracts are not supplied. Use fictional role entrances, no real credentials or copied personal data.
2. Catalogue: existing fictional stalls/photos/prices remain. Categories are frontend fixture metadata until the catalogue provides category/allergen fields; do not invent allergies, dietary certification or reviews.
3. Scheduling: demo supports today's six Malaysia-time slots; hours text does not enforce a live opening calendar. Future service must return dated server-authoritative availability, lead times and capacity allocation.
4. Checkout: one stall per cart; stock, capacity, price snapshots and transition validations remain. Future backend owns atomicity, idempotency and concurrent requests.
5. Payments: simulated payment and manual demo counter confirmation only; no card/bank/APCard integration.
6. Pickup: current actual token length, five-minute validity and one-time collection retained. Do not reduce to the pictured three-digit attendance code. Camera scanning is not supplied; vendor accepts manual code.
7. FIF: local rules and evidence, not live Gemini. Traffic is app pickup activity, not measured physical crowding. Scenarios are fixtures, not a backend load generator.
8. Reports: local filtered snapshot and PDF/CSV export; no server-signed report, scheduled export or production ledger guarantees.
9. Preferences: browser-local UI settings. No notification permission, real push/email, or campus-wide settings changes; operational timestamps remain Malaysia time even if audit display is toggled.
10. Responsive/accessibility: desktop icon nav and up to five mobile tabs with More. Searchable navigation reaches all secondary features. Keyboard focus, dialog focus/cancel, labelled controls and reduced motion are required.
11. Questions left for backend milestone: endpoint schemas, error codes, auth provider, stall/day catalogue, payment gateway, event subscriptions, transaction guarantees, report access, scanner hardware and deployment host.

## Verification gates

Typecheck and production build. Visual checks at 390/768/1440. Browse/search/filter -> meal extras -> replace-cart handling -> cart -> pickup/payment/review -> order creation -> vendor ready -> student token -> collection -> one receipt. Heavy scenario affects availability/recommendation. Expense + linked reversal restores net flow. PDF/CSV export produces real local files. All original routes remain reachable, original repository remains clean.

## Interactive cafeteria map implementation plan · 11 November

Reuse the student shell, menu items, price/discount helpers, stock rules, basket service, cart replacement confirmation, modal, and pickup calculations. Add an SVG map, area/stall selectors, storefront preview, selection progress and an embedded meal customiser. `/app/map` links from Stalls and the student module list. Geometry and photo references live in typed layout fixtures; business records remain in the existing catalogue. Async map services provide layout, areas, stalls, menu, availability and recommendations through an injectable read adapter. Selection state is separate from hover and basket state. Area/stall changes reset incompatible descendants only. Sample areas are configurable and do not represent verified university coordinates. Photo assets depict fictional storefronts. No backend, authentication, payment or physical crowd measurement is added. Existing prices and single-stall cart rules remain authoritative within this browser prototype; backend quotations must replace them for production. Validate pure selection/loading contracts, full browser ordering cascade, keyboard, mobile and existing cart persistence.
