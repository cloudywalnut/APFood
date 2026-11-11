# APFoods map, tracking and reporting update

This modifies the existing separate corporate frontend at `apspace-version`. The original GitHub checkout and all backend code remain unchanged. A pre-change snapshot is saved beside this project as `apspace-before-tracking-redesign.zip`.

## Current routes and reusable UI

- `/app/vendors`: Stalls opens the illustrated, interactive cafeteria map, not a stall list. Search, cuisine/category, food-court and pickup-availability filters highlight matching physical counters.
- `/app/vendors/area/:areaId`: area drill-down with an animated SVG zoom, stall hover/focus previews and mobile tap → Select stall. There are no cascading stall lists. SVG viewBox, visible controls and business IDs remain configurable and accessible.
- `/app/vendors/:stallId`: responsive menu cards, menu search, deals, storefront details, opening hours, kitchen load and preparation lead time.
- `/app/vendors/:stallId/item/:itemId`: existing meal customiser, pricing, discount/side/quantity rules, stock/capacity guards, single-stall cart replacement and basket access.
- `/app/map` redirects to the Stalls map. Existing stall links, deals, search, cart and checkout still work.
- `/app/orders/:id`: updated status-driven tracking for Placed, Accepted, Preparing, Ready, Collected, Cancelled and Rejected. Tracking, PickupFacts and the embedded existing PickupCode component reuse the current store and services. The order breakdown and actual activity are working accordions. Only recorded timestamps are displayed. The ready state alone exposes QR/text/copy/expiry/regenerate; cancellation remains limited to Placed/Accepted for students.
- Activity now provides selectable pickup windows, clear available/full/closed states and per-stall booked-capacity meters. Exact pickup capacity is revalidated in the existing checkout.
- More shows modules outside primary navigation and header shortcuts. Admin retains Traffic & capacity, Audit trail and Reports. Student and vendor retain Reports, with workspace/policy access. Settings, updates and basket remain directly accessible. The redundant secondary operations module bar was removed.
- Admin overview adds interactive order-status distribution and metric-switchable stall comparison. Select a status to refine the comparison, choose a stall to open its filtered products, or select a cashflow day to read exact figures. Existing metrics, tables, filters and finance operations remain.
- Reports provide controls plus document/CSV preview. Scope, period, summary and narrative are calculated once in `buildReport`, then shared by the UI and downloads. PDF includes cover metadata, contents, findings, data notes and paginated styled tables with repeat headers. CSV is a consistent rectangular table including metadata, quotes and formula-safe text. The browser download uses an attached anchor and keeps the Blob available long enough for WebKit downloads.

Main implementation: `components/cafeteria/{map,journey}.tsx`, `components/apspace/{illustration,meal-visual,order-tracking,pickup-code,admin-insights,report-builder}.tsx`, `components/{student,traffic,admin,vendor,shared}.tsx`, `lib/{tracking,report-model,report-export}.ts`, layout fixtures, service contracts/mocks, route dispatch and `app/refinement.css`. Previous all-in-one components remain as unused historical source; current routes use the components listed here.

## Reference provenance

The map illustration follows the supplied Campus Noodle Bar Preview concept: bounded floor plan, named zones, striped counters, seating, planting, selected-area emphasis and storefront preview. The geometry is still an illustrative sample, not a verified campus survey.

APSpace screenshots in `design-references/APFood_Tracking_Redesign_Codex/references` supply native card, accordion, structured-details and dialog patterns. Personal information in reference screenshots is not copied into the public application.

AIDA was inspected read-only at `/Users/dalia/Documents/Responsibilities/CTI - work stuff/mvp/dashboard`. Topic Explorer drill-down/breadcrumbs, chart exploration and the report builder/document structure inform the design. AIDA is not described as a native APSpace component. No AIDA data, credentials or backend implementation was copied.

## Supplied artwork placement

All 12 assets from `APFood_illustrations_warm.zip` are served locally under `public/illustrations/warm`. Their original labelled-card pixels are preserved. CSS displays just the illustration area; app headings and status text are HTML.

| Asset | Use |
|---|---|
| explore_cafeteria | Home map invitation and map guidance |
| order_placed | Placed tracking hero |
| order_received | Accepted tracking hero |
| preparing_order | Preparing tracking hero; explicit meal-photo placeholder |
| ready_for_pickup | Ready tracking hero and checkout guidance on item pages |
| order_completed | Collected tracking hero |
| empty_cart | Empty basket |
| no_orders | Empty student order lists and vendor shift/kitchen states |
| stall_closed | Closed stall, closed activity card and empty/coming-soon map area |
| item_unavailable | Sold-out meal, empty menu search and empty product search |
| session_pending | Workspace, map, order and report loading |
| invalid_session | Missing order, retryable loading errors, and temporary terminal-status artwork |

Additional useful artwork not supplied: dedicated Cancelled and Rejected illustrations (currently using the document/error artwork), and an empty-report/no-results illustration. Separate verified storefront photos and individual meal photos would improve the catalogue. The application deliberately uses a chef illustration labelled “Menu photo coming soon” when no appropriate food image exists; it does not present coffee as a rice dish. Optional `Item.image`/`imageAlt` fields are ready for backend-provided media.

## Integration assumptions

`orders.read` is a frontend async read boundary; the existing browser subscription remains the source of status updates. Offline/error/retry and missing-order handling are intentional UI states. Real session expiry, server synchronization and stale-update/version handling require backend identity and order APIs. The preview's random pickup token and expiry still come through the existing mock action; they are not a production token implementation.

Backend agreement is still required for authenticated student/vendor memberships, verified floor geometry, menu imagery, authoritative stock/prices/discount snapshots, atomic pickup allocation, event IDs and timestamps, cancellation/rejection reasons, payment/receipt states, secure one-time pickup-code issuance and redemption, and report access/aggregates. Original order-line prices are retained; historical discount breakdowns cannot be reconstructed when the order model has not stored them. No timestamp, refund, payment confirmation or physical crowd measurement is fabricated. The current PDF fixture exporter uses Helvetica for Latin text; production support for non-Latin stall names requires an embedded Unicode font. CSV retains Unicode text.

## Validation

`npm test`: 37 automated checks. Coverage includes the prior cascade/cart/stock/capacity cases, every positive and terminal tracking status, absent/invalid timestamps, cancellation eligibility and guards, real expiry, regenerated/invalid codes, counter-payment confirmation, one receipt, report filters/stock/ledger, CSV escaping/formula protection, PDF structure/pagination, and async read failure/retry.

Browser walkthrough: map → area → stall → menu → customisation → RM17 basket → checkout → placed order → vendor accepts/prepares/marks ready → student QR/manual/copy/regenerate → vendor verifies code/payment → collected. Cross-tab changes and terminal cancellation were verified. More was checked across roles; activity time selection updates kitchen capacity. Actual filtered PDF and CSV downloads were opened/read and matched the selected stall/date; CSV had consistent 12-column rows. PDF pages were rendered with Poppler and inspected. Responsive checks cover phone, tablet and desktop widths with one student bottom navigation and no horizontal document overflow.

Sample exports are under `output/pdf/apfoods-order-report.pdf` and `output/csv/apfoods-order-report.csv`. These are fictional fixture examples, not a claim about campus finances. Browser screenshots are under `screenshots/refinement`.
