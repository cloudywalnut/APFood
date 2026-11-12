# Vendor dashboard review - 13 November 2026

Reviewed the running vendor workspace against the student storefront's cream, espresso and mustard theme. Existing screenshots, assets and code were the design target; no replacement app or backend was introduced. Newer chart-scale and copilot updates present in the working tree were preserved.

## Screens reviewed

1. **Original overview** (`functional-audit/vendor-before-simplification.png`). Duplicate headings, placeholder campus pills and product cards competed with the operational overview. The cool canvas and small labels felt separate from student ordering. Navigation and recorded chart data already worked.
2. **Updated desktop overview** (`functional-audit/vendor-after-desktop.png`). Four linked summary cards lead into the sales chart and FIF shift priority. Recorded data, readable axes, collections/revenue selection, expanded analytics, menu highlights and recent orders remain accessible. AI evidence and what-if projections expand when relevant rather than occupying the empty baseline screen.
3. **Updated mobile overview** (`functional-audit/vendor-after-mobile.png`). Summary cards use two columns, toolbar controls fit the screen and detailed panels stack. The floating recommendation banner previously covered content; the recommendation shortcut now lives inside the context panel. Location, audience and other input details remain in the evidence disclosure.

## Implementation

- Warm canvas, espresso typography, mustard actions, consistent borders and restrained status colours.
- Clear cashflow, collection, kitchen and stock figures with loading placeholders. A single-stall account no longer receives a redundant stall selector; multiple assignments retain selection.
- A chart-first overview with the existing FIF operational action beside it. Product highlights move below the charts.
- One prominent Generate insights action; pending selected-period data disables generation. Failures appear near the action with retry, even when projections are collapsed.
- Existing scenario selection, projections, assumptions, benchmark, evidence, exact chart values, kitchen/menu/report links and vendor copilot remain available.
- Reduced-motion styling and visible focus outlines remain. The recommendation shortcut respects the system reduced-motion preference.

## Observed checks

- Today displayed zero receipts/collections for the new day rather than invented activity; the seven-day filter restored its recorded totals.
- Revenue/collections switching changed chart labels and values.
- A live Gemini insights run produced five recommendations, evidence and projected chart overlays. The projection remained labelled as an estimate.
- The inline recommendation shortcut opened the projections disclosure; Enter on its summary closed it.
- At 390px and 768px, document width stayed inside the viewport. The main screenshot was verified at 1440px. Temporary viewport overrides were reset.
- Typecheck, 55 unit/API tests, 25 backend tests and the production build passed on the current tree. The initial build attempt hit another running build; the subsequent build completed successfully. Formatting remains blocked by the missing local Prettier executable.

The screenshots establish the reviewed layout, not full accessibility compliance. Exhaustive screen-reader testing, all vendor routes and every operating-system zoom setting were not exercised. No menu, stock, payment or order mutation was performed during this design review. Nothing was committed or pushed.

## Visible insight refresh · 13 November 2026

Generating insights now displays a checking indicator, then a timestamped completion message. A compact comparison near the top shows recorded versus estimated gross revenue, portions sold and preparation work, including absolute and percentage changes. Selecting recommendations recalculates this preview.

Successful runs replay count-up numbers and chart/recommendation highlights, including cached results with unchanged inputs. The recorded KPI values are refreshed from reports and animated without applying forecast increases to cashflow, stock or real orders. The detailed scenario and sales-chart totals also replay. Reduced-motion mode shows final values immediately.

Browser checks exercised a live generation, an identical-input refresh with visibly different intermediate/final frames, recommendation selection, reduced motion and 390/768/1440px layouts without horizontal overflow. Typecheck, build, 58 unit/API tests and 28 backend tests passed. No operational data was changed or pushed.

## Restored layout and AI Insights hint · 13 November 2026

At the user's request, restored the previous vertical scheduled-pickup chart, mustard comparison bars and original insight animations. Removed the wide recommendations dialog and its additional header button.

After a successful generation or refresh, the inline recommendations open and the page scrolls to them, respecting reduced-motion preferences. A small AP-branded **AI Insights** hint appears for nine seconds, with a repeat-scroll action and dismiss control. The persistent inline jump link and recommendations heading also use **AI Insights** with the AP logo. Earlier cart, cancellation, pickup-code and menu-photo changes remain intact. No database changes or push were performed.

## Pickup schedule redesign and duplicate action removal · 13 November 2026

Removed the extra Refresh AI / Run AI Insights button from the inline scenario header. Generate insights / Refresh insights at the top is the single generation control. Updated stale/empty-state guidance to point there; the AP-branded hint and automatic scroll remain unchanged.

The vendor pickup chart now uses a compact horizontal schedule with full two-hour am/pm labels, exact counts, a busiest-window summary and the existing mustard palette. Initially it shows windows with pickups; Show all hours reveals all twelve windows, including zero counts. Both views preserve the same total. The aggregation uses hour keys, handles sparse input and labels noon/midnight correctly. The component is memoized to avoid unrelated animation redraws.

Verified counts and toggles, absence of the duplicate button, preserved top-level generation, and no overflow at 390/768/1440px. Typecheck, build, 60 unit/API tests and 28 backend tests passed. No database writes or push.
