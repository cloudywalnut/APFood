# Vendor UI review · 12 November 2026

Focused review of the authenticated local vendor dashboard and kitchen, using fresh in-app browser screenshots. No order, stock, price or payment data was changed. One Generate insights request was made. Root-level sales-overview work is subsequent to this review and needs its own visual check.

## Steps and findings

1. **Dashboard before changes — usable, presentation issues.** The desktop layout was intact. The 390px layout contained its wide product table correctly; there was no horizontal document overflow. Helper text and evidence used very small, pale grey type, and the navy-only scenario treatment was disconnected from the storefront palette. Before captures: `vendor-ui-review/01-desktop-before.jpg` and `02-mobile-before.jpg`. The full-page mobile capture includes the fixed navigation in the captured page; use the later normal viewport captures for placement evidence.
2. **Generate insights — passed.** A single click showed the busy state and then Gemini-selected experiments. The recorded RM36.00 / 4 work units baseline became RM37.24 / 3.6 work units for the selected experiment replay. These are scenario estimates. The limited-history warning remained visible. No additional generation request was made.
3. **Desktop result — repaired.** Two recommendation cards now share the available width instead of occupying two thirds of a fixed three-column grid. Muted mustard marks projected bars, active navigation and selected proposals; the Generate button uses dark text on mustard. Original APFoods logo and top navigation remain intact. Helper/evidence text is darker and larger. [Desktop preview](vendor-ui-review/05-desktop-after.jpg), [experiments and assumptions](vendor-ui-review/06-desktop-proposals.jpg).
4. **390px result and assumptions — passed.** Context fields stack, reporting period spans the content width, chart values have a stable numeric column, and the calculation summary wraps without clipping. Both assumption sliders were visible. Keyboard-changing demand response from 100% to 75% updated scenario revenue from RM37.24 to RM37.43; it was restored to 100%. [Mobile dashboard](vendor-ui-review/03-mobile-after.jpg), [mobile assumptions](vendor-ui-review/04-mobile-assumptions.jpg).
5. **Kitchen — passed overflow containment.** At 390px, the lane grid was 1042px wide inside a 345px scrolling container. Document and body scroll widths were 375px, within the 390px viewport. At 1440px, document width was 1425px and lane width 1316px within a 1320px container. Horizontal scrolling belongs to the lanes/status tabs, not the document. [Mobile kitchen](vendor-ui-review/07-mobile-kitchen.jpg).

## Exact changes

- `app/vendor-scenarios.css`: responsive auto-fit proposal cards; mustard projected bars, accessible dark-text CTA and keyboard focus ring; clearer helper/evidence text; selected-card treatment; tighter mobile spacing, stable chart values and wrapped assumption controls.
- `app/vendor-operations.css`: mustard navigation/status accents and FIF border; clearer secondary text; min-width containment in KPI cards, panels and kitchen controls; full-width mobile reporting filter and dashboard links.

## Evidence limits

The review checked desktop (1440×900) and mobile (390×844), one generation and a keyboard slider interaction. It did not perform an exhaustive screen sweep, screen-reader audit, automated contrast certification or kitchen state mutation. No full accessibility compliance claim is made. Typecheck/build are coordinated by the parent task after all concurrent changes. Temporary viewport overrides were reset and the browser returned to the dashboard.
