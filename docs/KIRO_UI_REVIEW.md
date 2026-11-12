# APFoods UI review, 2026-11-11

Reviewer: Kiro (Claude Opus 5.5). Scope: every screenshot listed in `manifest.json`, plus `cart-mobile.png` and `student-signed-in-390.png`. Source reading was limited to `components/**` and `app/**` (no `.env*`, no credentials, no session data, no backend). No commands, git, browser or network were used.

## 1. What was inspected

All 92 PNG files in this directory loaded successfully and were viewed:

| Area | Files (390 = mobile, 1440 = desktop) |
|---|---|
| Student storefront | `student-home-390/1440`, `student-signed-in-390`, `stall-list-390/1440`, `campus-map-390/1440`, `menu-390/1440`, `cart-390/1440`, `cart-mobile`, `checkout-390/1440`, `current-traffic-390/1440`, `orders-390/1440`, `tracking-390/1440` |
| Student tools | `student-tools-390/1440`, `student-reports-390/1440`, `student-notifications-390/1440`, `student-settings-390/1440`, `account-390/1440` |
| Auth (no token, fallback states) | `sign-in`, `sign-up`, `verify-email`, `forgot-password`, `reset-password`, `accept-invite` (each 390/1440) |
| Public / legal | `welcome`, `privacy`, `terms`, `cookies` (each 390/1440) |
| Vendor | `vendor-shift`, `kitchen`, `vendor-order`, `vendor-menu`, `vendor-capacity`, `vendor-payments`, `vendor-tools`, `vendor-reports`, `vendor-settings`, `vendor-notifications` (each 390/1440) |
| Admin | `admin-overview`, `cashflow`, `products`, `vendors`, `admin-traffic`, `audit`, `users`, `admin-tools`, `admin-reports`, `admin-settings`, `admin-notifications` (each 390/1440) |

Source files read for context: `components/storefront/{cart,traffic-map,header,marketplace,menu}.tsx`, `components/cafeteria/map.tsx`, `components/hosted/{traffic,student,basket-checkout,tracking,extras,common,auth}.tsx`, `components/cashflow-chart.tsx`, `components/shared.tsx`, `components/apspace/{shell,back-navigation}.tsx`, `components/legal/footer.tsx`, `app/layout.tsx`, `app/[[...segments]]/page.tsx`, `app/{globals,apspace,refinement,marketplace,cart,traffic}.css`. `docs/HANDOFF.md` and `docs/MVP.md` were not needed and not read.

### Limits of this review (read before acting)

- **Fixed bottom nav in full-page captures.** Playwright full-page screenshots paint the fixed mobile nav at its first-viewport position, so it appears mid-page in `cart-390`, `current-traffic-390`, `orders-390`, `menu-390`, `student-tools-390` and others. I treat those mid-page overlaps as capture artefacts, not bugs. Only end-of-page clearance is assessed (finding M9).
- **Downscaled long pages.** `audit-1440/390`, `admin-notifications-390`, `admin-overview-390`, `student-home-390`, `stall-list-390` were downscaled by the image viewer. Row text and chart axis labels there are not legible to me; findings on those pages cover layout only.
- **Truncated capture.** `account-1440.png` stops at 1016 px, mid-way through the "Email and password" form. The submit button and footer are not visible, so I cannot review them.
- **Lazy images.** In `student-home-390` and `student-signed-in-390`, stall photos below the fold are blank beige boxes. `stall-list-390` shows the same cards with photos, so this is lazy loading at capture time, not a defect.
- **Traffic states.** Every stall in both traffic captures is "Low load / 0% peak capacity". The amber, red and grey map states were **not** visible in any screenshot. I could check how they are wired in code, but not how they look.
- **Right-edge asymmetry.** Several 390 captures that are 375 px wide (scrollbar present) show ~15 px left margin and ~2–4 px right margin. Examples: `cart-390` summary card, `welcome-390` hero, `terms-390` card, `vendor-shift-390` recommendation card, `vendor-reports-390` Refresh button. Auth pages captured at 390 px (no scrollbar) are symmetric. I could not find the cause in the CSS I read, so finding M10 asks for a measurement rather than a fix.

## 2. Most important findings

1. **Cart prices don't agree with each other (High).** The only line reads "RM 9.00 each", the summary says "Subtotal RM 11.00", and the menu basket for the same cart says "Subtotal RM 9.00". The cart's subtotal is the pre-discount price, while the basket's subtotal is the post-discount price. (`cart-1440`, `cart-390`, `menu-1440`; `cart.tsx` `money(total + savings)`.)
2. **The student order list and order page show internal stall IDs (High).** They read "brew-and-bites", "campus-noodle-bar" and "green-bowl-kitchen" instead of the real stall names (Malay, Chinese, Japan & Korea). (`orders-390/1440`, `tracking-390/1440`; `hosted/student.tsx` renders `order.vendor_id`.)
3. **The checkout order summary is empty (High).** "Order summary" is a heading with nothing under it until the student presses "Find pickup times". (`checkout-390/1440`; `basket-checkout.tsx` renders lines only from `quotes`.)
4. **The Current Traffic map is unreadable on mobile (High).** The 900-unit SVG shrinks to about 300 px, so stall labels end up around 4–5 px tall. (`current-traffic-390`, `admin-traffic-390`.) A code issue on the same map: in traffic mode the first tap on a phone does nothing visible (M2).
5. **Key actions on mobile tables are off-screen with no hint (High).** Examples: vendor menu "Edit" (`vendor-menu-390`, only Item and Regular price are visible), admin "Manage" (`vendors-390`), "Manage access" (`users-390`) and cashflow ledger Amount/Type (`cashflow-390`). The tables do scroll sideways, but nothing on screen says so.
6. **The mobile cashflow chart hides the only data (High).** The 7-day chart scrolls horizontally and starts at 5 Nov. The single non-zero day (11 Nov) is off-screen to the right. (`cashflow-390`, `admin-overview-390`.)
7. **"Sign out" sits above the page title (Medium).** It is a bordered button directly above the H1 on every hosted More, Settings, Reports and Updates page, for all three roles. (`student-settings-1440`, `vendor-tools-1440`, `admin-reports-1440`, etc.; `hosted/extras.tsx` renders `<SignOut />` first.)
8. **The order timeline shows collected orders as still in progress (Medium).** "Collected" gets the clock icon. (`tracking-390/1440`; `tracking.tsx` treats the last stage as `current`.)
9. **Much informational text is 7–10 px.** Examples: mobile hero eyebrow 7 px, hero offer 8 px, both mobile navs 9 px, stall-card pickup time 9 px, traffic "Low load" badge 10 px, cart storage note 11 px.

The unified logo looks right: one image, no adjacent text, the same proportions on every header (storefront, ops, auth, legal, welcome). See L1 for a small note on the footer.

## 3. Priority areas

### 3.1 Unified APFoods logo

Files: every header in all 92 images. Source: `APSpaceBrand` in `components/apspace/shell.tsx` renders one `<img src="/brand/apfoods-wordmark-v1.png" alt="">` inside a link with `aria-label="APFoods home"`.

- **Pass.** There is one asset with no adjacent text. It renders at a consistent height (~33 px desktop, ~28 px mobile) on storefront (`cart-1440`), ops (`vendor-shift-1440`, `admin-overview-1440`), auth (`sign-in-1440`), legal (`privacy-1440`) and welcome (`welcome-1440`) pages. On mobile it fits beside three header icons without crowding (`cart-390`, `kitchen-390`).
- **Accessibility pass.** The link has an accessible name and the image is decorative (`alt=""`), so it is not announced twice.
- **Note (L1).** Site and auth footers show a bold text "APFoods" next to "Campus food, on your time." (`cart-1440`, `sign-in-390`). This is a text signature, not the logo. It is acceptable, but if the brief means "logo asset everywhere", the footer is the only exception.
- **Note.** At small sizes the mustard detail between the "A" and "P" reads as a speck (visible in `sign-in-390`, `kitchen-390`). I cannot judge the asset at full resolution. No change proposed.

### 3.2 Cart

Files: `cart-1440`, `cart-390`, `cart-mobile`, `menu-1440`, `menu-390`, `checkout-1440/390`. Source: `components/storefront/cart.tsx`, `app/cart.css`, `components/storefront/menu.tsx`, `components/hosted/basket-checkout.tsx`.

What works: a clear two-column layout on desktop, a single column on mobile, items grouped by stall with a "View menu" link, 42 px quantity steppers, a 44 px Remove button, the sign-in CTA kept in the summary, and an honest note that prices and availability are confirmed at checkout.

| ID | Sev | Evidence | Problem | Repair |
|---|---|---|---|---|
| C1 | High | `cart-1440`: line "RM 9.00 each", line total RM 9.00, "Subtotal RM 11.00", "Meal savings −RM 2.00", "Total RM 9.00". `menu-1440` basket: "Subtotal RM 9.00". | Unit prices are shown after the discount, but the summary "Subtotal" is the pre-discount sum (`money(total + savings)`). The menu basket uses "Subtotal" for the post-discount figure. Students see three numbers that don't reconcile. | Show the regular price struck through on discounted lines. Rename the cart's first row "Regular price". Label the menu basket figure "Total" to match. Data stays the same. |
| C2 | Med | Header "Basket", page "Your cart", menu panel "Your basket" with "Review your basket (1)", mobile bar "View basket", More tools tile "Your cart". | Two names for one thing. | Use "Cart" everywhere (the route is `/app/cart` and the page title is "Your cart"). |
| C3 | Med | `cart-390`: header cart icon and account icon. CSS: `.market-cart-link` 36×38 px at ≤700 px. | The cart entry point on mobile is under the 44 px target. | Make it 44×44 on mobile. The header has room: 140 px logo + 3×44 px + gaps < 343 px. |
| C4 | Low | `cart-390`: "Keep exploring" link 11 px with no min-height; "View menu" 12 px. | Small text and small targets. | 12–13 px, 44 px min-height. |
| C5 | Low | `cart-1440`: "Your cart is saved in this browser…" is 11 px, centred under the CTA. | Hard to read. | 12 px. |
| C6 | Low | Header `aria-label={"Cart, " + cartCount + " items"}` | Reads "Cart, 1 items". | Pluralise. |
| C7 | High | `checkout-1440/390`: the "Order summary" card is empty. | The student can't see what they're scheduling until they request quotes. | Show a cart-based placeholder (count and stall count) plus "Find pickup times to confirm prices and your total." No invented prices. |
| C8 | Low | `checkout-1440`: "Back to cart" has no arrow and differs from the `.page-back-arrow` style used elsewhere. The hint "Stalls without a merchant QR…" runs straight into the "Pickup window" heading. | Inconsistent return link and cramped grouping. | Use the shared back-arrow style and add spacing before the second H2. |

The mid-page bottom-nav overlap in `cart-390` is a capture artefact. `cart-mobile.png`, a viewport capture, shows the nav at the bottom.

### 3.3 Current Traffic (load-coloured cafeteria map)

Files: `current-traffic-1440/390`, `admin-traffic-1440/390`. Source: `components/hosted/traffic.tsx`, `components/storefront/traffic-map.tsx`, `components/cafeteria/map.tsx`, `app/traffic.css`.

Requirement check:

| Requirement | Status | Evidence |
|---|---|---|
| Next 30 minutes | Pass | Eyebrow "APP PICKUP LOAD · NEXT 30 MINUTES"; subtitle "App pickup load over the next 30 minutes · Physical queues are not measured". |
| Red ≥80%, amber ≥50%, green lower | Pass in legend and code | Legend "Low · below 50% / Moderate · 50–79% / Busy · 80%+". `map.tsx` tints counters `{low:#bed6a6, moderate:#edc362, busy:#df8c82}`. Only the green state appears in the screenshots. |
| Unknown grey | Partial | Legend "No capacity data" grey. The map only tints when a load object exists (`tint=load?…:undefined`). A counter with no load entry renders transparent, not grey (M3). |
| No invented queues or claims | Pass | The copy says booked capacity, not measured queues. "How is traffic estimated?" explains the method. Demo/simulated data is disclosed. |

| ID | Sev | Evidence | Problem | Repair |
|---|---|---|---|---|
| T1 | High | `current-traffic-390`, `admin-traffic-390`: the map is ~210 px wide in the image (~300 px real); counter labels are illegible. | `.reference-map .reference-floorplan{min-width:0;width:100%}` shrinks the 900-unit viewBox, so 13-unit labels render at ~4.5 px. Counters become ~25 px tap targets. | At ≤600 px, give the traffic map a 640 px minimum width inside a horizontally scrollable stage (scoped to `.current-traffic-map`). Labels then render at ~9 px. Keep the stall list below as the accessible text equivalent. |
| T2 | Med (code) | `map.tsx` `onClick`: on `(hover:none), (max-width:760px)` the first tap calls `preview()` only. In traffic mode `location` is forced to `undefined`, so no preview shows. | On a phone the first tap on a counter does nothing visible and the second tap selects it. | Skip the preview branch when `traffic` is set. |
| T3 | Med (code) | `map.tsx` `tint = load ? … : undefined` | A stall with no load entry renders transparent instead of the grey "No capacity data" colour. | When `traffic` is provided but no load exists, use `#d0cbc2`. |
| T4 | Med | `current-traffic-1440`: counters are coloured only by a pale tint; labels show only the stall name. | Load is shown by colour alone (WCAG 1.4.1). The pale green, amber and pink tints will be hard to tell apart for colour-vision-deficient users. The stall cards below do have text ("Low load"). | Add a small text chip on each counter (e.g. "0%", "52%", "—") in traffic mode. Re-check the tint contrast once busy/moderate data exists. |
| T5 | Med | `current-traffic-1440`: "Back to dashboard" above the H1. | Students have no dashboard; the link goes to Discover (`back-navigation.tsx` labels every portal "dashboard"). The same text appears on student Orders, More, Settings, Reports and Updates. | For `/app` routes, label it "Back to Discover". |
| T6 | Low | "Low load" badge 10 px; "0 booked pickups · 0% peak capacity" 11 px; legend 12 px on desktop, 10 px at ≤520 px. | Tiny status text. | Badge 11 px, detail 12 px, legend ≥12 px. |
| T7 | Low | `current-traffic-1440`: map label "Shawarma" vs card "Arab Shawarma". | Label differs from the stall name. The layout label is fixed in `sampleLayout`. | Optional: use the vendor name in traffic mode. Not required. |
| T8 | Low | `admin-traffic-1440`: "Standard demo · Fictional transactions" sits above the "Pickup traffic" H1. | Reversed hierarchy. | Move the demo line under the title (admin wrapper, `components/hosted/admin.tsx`; verify). |
| T9 | Low | The "How is traffic estimated?" disclosure has a border; "Scheduled pickup windows (70)" is a borderless shadow panel with a different marker size. | Two adjacent disclosures with different styles. | Give both the same `.traffic-method` style. |

## 4. All findings by severity

High:

| ID | Screens | Problem | Repair (detail in FIXES.md) |
|---|---|---|---|
| C1 | cart, menu | Subtotal semantics differ (see 3.2) | F3 |
| C7 | checkout | Empty order summary | F5 |
| T1 | traffic (both) | Map illegible on mobile | F6, CSS §2 |
| H1 | `orders-390/1440`, `tracking-390/1440` | Stall slug (`campus-noodle-bar`) instead of name. Reports and Updates already map names correctly (`extras.tsx` builds `names`). | F1 |
| H2 | `vendor-menu-390`, `vendors-390`, `users-390`, `products-390`, `cashflow-390`, `audit-390`, `student-reports-390`, `vendor-reports-390`, `admin-reports-390`, `admin-overview-390` (Stall performance) | Tables are wider than the screen (`.ops-theme table{min-width:650px}`). Columns are cut off with no visible scroll cue, and primary actions (Edit, Manage, Manage access) sit in the hidden right-most column. | CSS §5 scroll cue for all `.table-wrap`; opt-in stacked layout `.table-stack` for the three action tables (F13). |
| H3 | `cashflow-390`, `admin-overview-390` | Chart scroll starts at the left (5 Nov). The only data (11 Nov, RM 53 receipts) is off-screen. | F12 scroll to latest on mount. |
| H4 | `student-reports-390` | The student report table squeezes five columns into 340 px. Full UUIDs wrap over 5 lines, pickup times over 6 lines, and the Value column is cut off. | F9 short order ID (first 8 chars, matching "Order a4968ade" and ledger "Pickup a4968ade"), nowrap pickup. CSV/PDF keep full IDs. |

Medium:

| ID | Screens | Problem | Repair |
|---|---|---|---|
| C2, C3, T2, T3, T4, T5 | see 3.2/3.3 | | F4, CSS §3, F6, F7 |
| M1 | all hosted More/Settings/Reports/Updates for student, vendor and admin (e.g. `student-settings-1440`, `vendor-tools-390`, `admin-notifications-1440`) | "Sign out" button sits directly above the H1 with no gap, so it reads as the page's primary element. | F8 move it to the end of the content. The feature is kept. |
| M4 | `tracking-390/1440` | The final "Collected" step shows the in-progress clock. The status appears three times (H1 "Order collected", badge, "Collected" in the timeline header). | F2 mark collected as done. |
| M5 | `student-notifications-390`, `vendor-notifications-390` | Each row is `strong` + `span` in a flex row. On mobile the span wraps under itself with a hanging indent that varies by stall-name width ("Japan & Korea" row). Status is raw lowercase ("cancelled"). | CSS §6 stack on mobile; F10 use `statusNames`. |
| M6 | `admin-notifications-1440/390` | Raw event names, full UUIDs, slug targets and US-style dates "11/11/2026, 10:16:18 pm". Every other screen uses "11 Nov 2026, 10:11 pm". There are 80+ undifferentiated lines with no links. | F10 shared date format and short IDs. Optional: cap at 50 with "Show more". |
| M7 | `account-390` | Captured in the loading state: "Loading your account…" with a primary "Sign in" button. `AccountScreen` renders Sign in whenever `session` is undefined, including while loading. | F11 show Sign in only on error. |
| M8 | `vendor-order-1440/390` | The vendor view says "Follow the order status for your pickup" (student copy), and the total row is labelled "DuitNow QR" instead of "Total". | F14 (`components/hosted/payments.tsx` / `vendor.tsx`; not read, verify). |
| M9 | code | Mobile nav clearance ignores the iOS safe area. `.storefront-theme{padding-bottom:70px}` vs a nav of `min-height:66px` plus `max(8px, env(safe-area-inset-bottom))`. `.ap-role-shell{padding-bottom:68px}` vs ops nav 64 px plus `max(7px, safe-area)`. On a device with a 34 px inset the last ~15–20 px of the footer (legal links) sits under the nav. The screenshots cannot show this. | CSS §1. |
| M10 | 375-px captures listed in §1 | Right margin ~2–4 px vs left ~15 px. Cause unconfirmed. | Measure `document.documentElement.scrollWidth` vs `clientWidth` at 375/390 on `/welcome`, `/terms`, `/app/cart`, `/vendor`. If scrollWidth > clientWidth, find the element (likely a `100vw` or fixed min-width). Do not "fix" with `overflow-x:hidden` on body. |
| M11 | `stall-list-1440` vs `student-home-1440` | `/app/vendors` ("Campus stalls" tab) renders the same hero, sign-in card, cravings and deals as Discover (manifest headings are identical). The tab gives no stall-focused view. | F16 optional: hide hero and offers on `/app/vendors`. |
| M12 | `student-home-1440`, `stall-list-390` | Every stall card shows "From 12:00 am". At 11:42 pm with 24-hour stalls (`00:00–24:00`), this is tomorrow's first slot, but it reads as midnight tonight or an error. | F15 prefix "Tomorrow" when the slot isn't today (MYT). Also show "Open 24 hours" for `00:00–24:00` on the menu page. |
| M13 | storefront/ops, mobile | Text below 11 px: hero eyebrow 7 px, hero offer chip 8 px, both bottom navs 9 px, stall-card time/location 9 px (desktop), offer "Save" chip 9 px, basket line small 9 px, restaurant meta 9 px, kitchen lane count 9 px, traffic badge 10 px. The menu page also hides "10 min preparation" on mobile (`.market-restaurant-meta span:first-child{display:none}`), which is useful information. | CSS §4 scoped floors. |

Low:

| ID | Screens | Problem | Repair |
|---|---|---|---|
| L1 | footers | Text "APFoods" signature, not the logo asset | Leave, or swap to asset (optional). |
| L2 | `privacy/terms/cookies-1440` | Side-nav links to sibling policy pages carry ↗ "external" arrows. Each card has its own footer ("APFoods campus prototype · Back to campus food ↗") directly above the site footer, so the page shows two footers. "Clear policies. A better campus experience." is filler. | Use → or no icon for internal links; drop the in-card footer or the tagline (`components/legal/policy-page.tsx`; verify). |
| L3 | `sign-up-1440` | "Terms" and "Privacy Policy" are links (`auth.tsx`) but look the same as body text. | Underline them. |
| L4 | `student-settings-1440` | Three colour swatches look like selectable options but are decorative. | Add a caption ("Theme colours") or `aria-hidden` + smaller size. |
| L5 | `vendor-settings`, `admin-settings` | "Replay introduction · Find meals, schedule a pickup and collect with a code" is student copy shown to staff. | Role-specific copy or hide for vendor/admin. |
| L6 | `vendor-capacity-1440` | Full-width (1270 px) inputs for "5" and "10". | Optional max-width 360 px on these fields. |
| L7 | `admin-overview-1440` | Manifest heading text "What's happening in the kitchens?i": the info-tip button's "i" is part of the H2 accessible name. | Move the tip out of the `<h2>` or give its glyph `aria-hidden` (`components/apspace/info-tip.tsx`; verify). |
| L8 | `admin-reports-1440` | Admin stall filter says "All assigned stalls". | "All stalls" for admin. |
| L9 | reports (all roles) | "Supabase · Standard demo · Fictional transactions" exposes the backend name to end users. | "Standard demo · Fictional transactions". |
| L10 | `orders-1440` | List order isn't chronological (9:30 pm row after 9:15 pm rows). Likely sorted by created time. | Optional: sort by pickup time or label "Most recent first". |
| L11 | `vendors-1440`, `users-1440`, reports | Raw lowercase enums ("approved", "active", "cancelled"). | Capitalise via existing `statusNames` or a label map. |
| L12 | storefront header | The four-square "tools" icon has only an aria-label ("Search workspace tools"). Sighted users can't tell what it does. | Tooltip/`title`, or a visible "Tools" label at ≥1150 px. |
| L13 | `campus-map-390` | The hint "Hover to meet a stall" appears on touch devices. | "Tap a counter to see the menu" under `(hover:none)`. |
| L14 | `admin-overview-1440` | "What's happening in the kitchens?" donut panel is mostly empty space when there are 0 active orders. | Optional compact empty state. |

Reset-password and accept-invite without a token show the password form (`reset-password-*`, `accept-invite-*`). Per the brief these are intentional safe fallback states, so they are not filed as defects.

## 5. Per-screen notes

- **Discover / signed-in** (`student-home-*`, `student-signed-in-390`). Good hierarchy and warm brand. The FIF recommendation card works. Issues: M12, M13. Its meta line "Demo recommendation · Rules fallback · App activity" is 9 px.
- **Campus stalls / Map** (`stall-list-*`, `campus-map-*`). M11, L13. The map legend's mustard and outline squares don't explain the counters well. The desktop map is clear.
- **Menu** (`menu-*`). Good: offer banner, strike-through prices, 36/44 px add buttons. Issues: C1, C2, M12 hours, prep time hidden on mobile.
- **Cart, checkout, traffic.** See §3.
- **Orders / tracking.** H1, M4. Back links "Order history" have no arrow (C8 pattern).
- **More / Settings / Reports / Updates (student).** M1, H4, M5, T5.
- **Account.** M7. Desktop is OK as far as captured; the eye toggle sits outside the input, unlike the auth pages (cosmetic).
- **Auth.** Clean and consistent; no issues beyond L3.
- **Welcome.** Clear. "Powered by FIF" is fine. M10 margin.
- **Legal.** L2; mobile tabs work.
- **Vendor shift / kitchen / capacity / payments.** Empty states are clear ("No new orders."). Kitchen count badges are 9 px on mobile. The native file input is unstyled (acceptable).
- **Vendor menu.** H2: the Edit action is unreachable without an unhinted sideways scroll.
- **Vendor order.** M8.
- **Admin overview / cashflow.** H3, H2 (Stall performance, ledger). Desktop charts and metrics read well.
- **Products / vendors / users / audit.** H2. The audit page has no pagination (100+ rows).
- **Admin notifications.** M6.
