# Dalia UI and hosted backend integration

Integrated `origin/Dalia` at `416fcbc` into `Keyaan` on 11 November 2026. The source Dalia branch is preserved. The merge retains both the browser preview and authenticated Supabase mode; the preview gate never substitutes for hosted authorization.

## Feature coverage

| Dalia UI capability | Integrated behavior |
| --- | --- |
| Roboto, warm shell, desktop/mobile navigation, modal sheets, help, illustrations, storefront photography | Shared by both modes. Real account, Users and Payment settings destinations remain reachable through More. |
| Login presentation and role artwork | Hosted email/password login uses Dalia's layout with the existing signup, verification, recovery and invitation flows. Workspace selectors affect presentation; database memberships determine access. Staff access uses invitations and trusted role assignment. |
| Cafeteria map and area selection | Dalia's SVG geometry and photographs, with live published stalls and live menu search. Ten map counters now have seeded hosted menus. Existing business settings and stock are not overwritten. |
| Menu and item links | Live prices, discounts, stock, quantity and sides. Deep item links open the correct meal editor. Added feedback uses Dalia's five-second dismissible toast. |
| Multi-stall basket | Guest storage and owner-scoped persistent carts retain meals from multiple stalls. Existing single-stall carts remain compatible. |
| Shared pickup checkout | Quotes every stall, intersects actual timestamps, shows stall-specific payment methods, and commits the entire basket atomically through `checkout_basket`. One order per stall retains its own kitchen, payment, pickup code, and receipt. |
| Order tracking | Dalia-style timeline uses actual status and recorded timestamps. QR confirmation, cancellation, refunds, pickup expiry and vendor collection remain connected to the backend. |
| Admin visual insights | Live order-stage distribution and stall comparisons, with active/all controls and correct `vendorId` drilldown links. Finance charts and ledger still use the authoritative report. |
| Reports | PDF/CSV exports from live student orders, assigned vendor orders/stock/cashflow, and admin orders/stock/cashflow. Server RLS restricts vendor ledger visibility to assigned stalls. |
| More, Updates, Settings | Hosted role navigation, account links, live order/audit updates, density, update opt-out, timezone preference, and replayable introduction. Preferences remain browser-local. |
| Search and filters | Live dish/stall search, vendor menu search, admin product search/sorting/low-stock filter, ledger type filter, and audit actor/text filters. Global module search routes hosted meal queries to live discovery. |
| Backend features absent from Dalia's preview | Supabase Auth, memberships, suspension, invitations, account management, persistent carts, retry recovery, vendor QR settings, payment claims, refunds, authoritative finance, FIF server recommendations, traffic simulator and audit remain available. |

The public root uses the new login presentation. `/welcome` preserves the public landing page. Policy pages retain their hosted storage and payment explanations.

## Checkout invariants

`POST /api/checkout/basket` receives the per-stall quotes and idempotency keys, a basket key, and the saved cart revision. The database locks the cart and stalls in stable order, verifies that the quotes cover the complete cart, and calls the existing order-placement functions inside one transaction. Failure rolls back every allocation. Success records the result and clears exactly that cart revision. Repeating the same payload recovers the same orders, including after newer cart edits. Changing a recorded payload is rejected. The original single-order endpoints and order URLs remain compatible.

QR orders continue to show “I've paid” and immediately record Paid when the customer confirms. Each stall has its own QR and reference. A stall without a QR uses counter payment. A multi-stall checkout opens order history so each payment and pickup can be handled separately.

## Verification

- 42 inherited frontend checks pass.
- Six backend tests pass, including new cross-stall rollback, replay, owner isolation, mismatched vendor rejection, and newer-cart preservation cases.
- Typecheck and production build pass.
- Hosted browser walkthrough passes merchant upload, single-stall QR checkout through the new basket endpoint, payment claim/replay, vendor preparation, pickup, receipt, suspension and cart restoration.
- Hosted two-stall walkthrough passes basket retention, shared quote, two order IDs, exact retry, and purchased-cart clearing. Test orders are cancelled afterward.
- Student CSV contains the actual newly created order ID.
- Vendor cashflow export uses its own posted ledger. Another stall's report and admin order reporting return 403. The hosted CLI security advisor reports no warning/error findings.
- Map, extra screens and merged admin dashboard pass document-overflow checks at 390, 768 and 1440 pixels.

Hosted setup uses `20261111140408_dalia_basket_integration.sql`, `20261111141841_vendor_report_access.sql`, and the expanded idempotent `supabase/seed.sql`. These have been applied to the dedicated project. Confirm catalogue row counts after seeding; the current CLI's seed-hash update alone did not populate the new rows, so the seed was explicitly executed and verified.

## Remaining wider milestones

The previous external gates still apply: full Auth email delivery/template walkthrough, live Gemini verification after a key is supplied, and hosted traffic-run persistence. These are not replaced by browser fixtures. New stall staff can be assigned through Admin → Users; the original three staff fixture credentials remain unchanged. The preview's independent vendor-registration flow is retained only in mock mode; hosted staff cannot grant themselves trusted roles.
