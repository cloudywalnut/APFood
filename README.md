# AP Food + FIF

A frontend-only campus pickup demo. All stalls, orders, traffic scenarios, and payments are fictional.

Start with the [current MVP](docs/MVP.md) and [engineering and AI handoff](docs/HANDOFF.md). The [original technical MVP specification](AP_Food_FIF_Agent_Ready_MVP_Spec.md) is also included.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 and choose Student, Vendor, or Admin. Run `npm run typecheck` and `npm run build` to verify the source and production bundle.

For Supabase setup, endpoint contracts, and database tests, see the [backend guide](docs/BACKEND.md).

## Implementation phases

| Phase | Modules | What it covers |
| --- | --- | --- |
| 1. Shells and fixtures | `app/`, `components/shared.tsx`, `components/public-page.tsx`, `lib/demo.ts` | App routes, shared UI, fictional stalls and orders, policy pages |
| 2. Ordering and kitchen | `components/student.tsx`, `components/vendor.tsx`, `lib/demo-store.ts` | Menu, cart, scheduled pickup, status changes, QR and manual collection |
| 3. Analytics and simulation | `components/admin.tsx`, `components/traffic.tsx`, `components/cashflow-chart.tsx`, `lib/analytics.ts` | Scenario filters, products, vendor controls, expense posting and reversal, audit |
| 4. Prototype handoff | `docs/UI_IMAGE_PROMPT_KIT.md` | Screen inventory and image-generation prompts |

## Demo walkthrough

1. Open Student, choose Campus Noodle Bar, add a bowl, and place a demo order.
2. Open Vendor in another tab using the same origin. In Kitchen, accept the order, start preparing, and mark it ready.
3. Show the pickup code in the student tab, then paste it into Verify pickup on the vendor order. Counter orders also require payment confirmation.
4. Open Admin and change the data source to Heavy. The first Campus Noodle Bar pickup window fills in the sample data and the student recommendation shifts to another stall.
5. Record a demo expense in Cashflow and reverse it. Both entries remain visible and net flow returns to its previous amount.
6. Use Cookies → Clear demo data to reset this browser.

The demo state lives in local storage and syncs across tabs on the same origin. It is a prototype, so shared browser state has no account isolation or database transaction guarantees. Replace the demo data layer with authenticated Supabase and Gemini integrations in the backend phase.

## Artwork

The built-in image generator produced the photo sheet used for `public/food/noodles.webp`, `public/food/coffee.webp`, `public/food/bowl.webp`, and `public/food/lunch.webp`. Fraunces and Inter are served locally with their font licenses in `public/fonts/`.

> Photorealistic editorial food photography contact sheet for a fictional Malaysian campus food ordering app. A precisely equal 2x2 grid, zero margins, zero dividers, each quadrant entirely a different standalone horizontal photo. Top-left: Malaysian soy glazed chicken noodles, scallions, soft egg, warm cream table, overhead angled. Top-right: iced coffee in a clear glass with a small toast sandwich on pale olive linen. Bottom-left: bright rice grain bowl with green vegetables, roasted tofu, carrot and sesame on pale mint/cream. Bottom-right: campus Malaysian food photography wide editorial scene with a bowl of chilli chicken rice and noodles on warm light beige, subtle natural shadows. Each photo has the food centered with margins for crop, daylight, appetizing honest cafeteria portions, magazine quality. No people, no lettering, no logos, no collage overlays. 1536x1024 landscape.
