# APFoods corporate frontend and cafeteria map

This separate frontend lives outside the original APFood checkout. Run `npm run dev -- --port 3004`; open `/auth/login`, then Student → `/app/map`. Expand **Preview accounts** to fill fictional credentials. All seeded accounts use `APFoods123!`. Vendors also have a browser-local signup form. These are UI preview sessions, not secure authentication. No original repository changes or backend endpoints were made.

## Changed components and data

- `components/cafeteria/map.tsx`: accessible SVG area and stall controls, configurable storefront photo previews, desktop hover/focus, mobile tap then Select stall, zoom and native scrolling.
- `components/cafeteria/page.tsx`: progressive Area → Stall → Item → Customise cascade, loading/error/retry/empty states, pickup summary and existing basket dock.
- `components/apspace/meal-editor.tsx`: shared inline/dialog item customiser, existing discount and side calculations, quantity/stock/capacity checks and cart replacement confirmation. Uses the existing basket adapter.
- `lib/cafeteria/{types,layout,selection}.ts`: stable IDs, geometry separate from catalogue, selection transitions separate from hover and cart, retryable resource loading.
- `services/cafeteria.ts`: typed async mock adapter for layout, areas, stalls, details, menu, availability and pickup recommendations. Replace this adapter for real APIs.
- `lib/demo.ts`, `lib/demo-store.ts`: additional Malaysian cuisine fixtures; saved carts/orders survive catalogue migration; central action notifications.
- `components/apspace/{login,role-hero,toasts}.tsx`, `lib/preview-auth.ts`: APFoods login/signup, matched role illustrations, local sessions and global action feedback. Vendor pages, search, reports and updates use the signed-in stall. URL stall selectors no longer choose a different vendor.
- Route, student entry points, headers, role dashboards, theme styles and user-facing branding/copy updated. Existing menus, deals, cart, checkout, scheduling, order tracking, QR, kitchen workflow, stock, capacity, finance, audit, reporting and settings remain.

## Assumptions and integration work

The floor plan is explicitly illustrative: North Court, Central Court, Noodle Lane, Drinks Corner and Dessert Bar are configurable fictional areas. No real cafeteria survey/mockup was present in the supplied attachments. Cuisine labels are temporary stall names. One generated physical storefront photograph is intentionally shared as placeholder imagery across stalls; replace each location's `photo` and `photoAlt` with its own verified image. Menu images remain sample food imagery. Kitchen load is sample app activity, not a physical crowd measurement.

Backend developers must supply verified geometry and photo URLs, authenticated identity and vendor memberships, stock/availability reads, authoritative quotations/discounts, atomic single-stall checkout and pickup allocations, payment handling and scoped order updates. Client session checks and salted local signup password hashes are solely preview behaviour: browser storage and client guards do not enforce production authorization.

## Validation

`npm test`: 19 automated checks covering hover/selection isolation, descendant reset, stable IDs, menu filtering, empty areas, prices/extras/quantity through the real cart, cross-stall confirmation rules, closed stalls, stock, unavailable slots, basket persistence, failure/retry, configurable geometry and preview accounts/signup hashing.

`npm run typecheck` and `npm run build` pass. Browser checks cover keyboard focus and Enter selection; correct item details; changing quantity/side; adding a RM17.00 meal to the original cart; cancelling replacement with basket preserved; sold-out/closed/empty states; mobile tap preview then explicit Select stall; one mobile bottom navigation and no horizontal page overflow at 390px; persistence across a fresh page/tab; and the existing checkout accepting the RM23.50 cart, followed by vendor acceptance. Vendor URL changes and foreign order URLs stay within the signed-in stall view. CRUD and basket toasts were observed.

Browser rendering is reviewed at desktop/tablet/mobile widths. Native hover state and request failures are additionally covered at the controller/service boundary; automated tests do not claim a hardware touch-device or physical crowd test.

## Generated assets

Built-in image generation produced `public/cafeteria/sample-storefront.webp` and `public/illustrations/{student,vendor,admin}.webp`. The final prompt set and mode are recorded in `docs/GENERATED_ASSETS.json`. Illustrations retain transparency; storefront and role files are locally hosted and require no third-party image URL.
