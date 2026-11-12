# FIF implementation status · 12 November 2026

FIF is operational decision support, rather than a chatbot. Its current intelligence is mainly deterministic: it turns real application signals into eligible actions and evidence. Gemini is configured server-side using gemini-3.1-flash-lite. A live structured ranking call succeeded on 12 November 2026 in approximately 2.3 seconds. It selects eligible operational recommendations and grounded business experiments. The dashboard replays recorded sales under explicit scenario assumptions; this is not a calibrated demand forecast or autonomous cafeteria management.

## Working now

- Pickup feasibility and transactional allocation use live stock, preparation lead times and booked kitchen work.
- Current Traffic estimates near-term pickup load from recorded allocations. It is not a physical queue measurement.
- Student recommendations identify feasible pickup options. Vendor recommendations prioritise upcoming/overdue pickups and stock shortages. Admin recommendations flag operational concerns.
- Recommendations and links are generated in the caller's server-enforced role/stall scope. Optional model output can only select known action/evidence IDs.
- Rules fallback, provider timeout, rate limiting and short scoped cache exist. Controlled provider fixtures are tested; the live ranker is verified, while the complete hosted recommendation-to-action walkthrough remains outstanding.
- Vendor Dashboard and AI Insights now surface the FIF recommendation prominently, alongside live stock attention, upcoming pickups, recorded receipts and collected-product performance. The UI distinguishes current measurements from predictions.
- The vendor Capacity screen has been removed from navigation and redirects to AI Insights. Internal stock and throughput allocation still protect checkout and inform traffic estimates.

## Business scenario dashboard

The main vendor dashboard now includes Generate insights, vendor-supplied weather/audience context, published campus-menu price comparisons, Gemini-selected price/menu/preparation experiments, and interactive recorded-versus-scenario revenue and preparation-effort bars. Proposals can be toggled and the demand/efficiency assumptions adjusted. Overlapping effects are capped and the calculation is disclosed. Generated results are tied to a sales snapshot and warn when inputs change. No price is automatically applied.

The endpoint requires an active verified vendor assigned to the requested stall. Data is read server-side in the caller's scope. Candidate identifiers are validated, model text cannot alter prices or projection formulas, generation has a timeout and rules fallback, repeat analyses are cached, and provider attempts are rate-limited. Scenario data shared with Gemini is described in the Privacy draft.

The dashboard also shows payment-channel receipt bars, collection counts, daily order trend, fulfilment mix, best sellers, scheduled pickup-time distribution and recent orders. Money and order counts use separate units. All traffic/cashflow remains demonstration data.

Demo scripts and commands are documented in [DEMO_AUTOMATION.md](DEMO_AUTOMATION.md).

## Next implementation phases

| Priority | Deliverable | Required inputs and completion criteria |
| --- | --- | --- |
| 1 | Grounded shift brief | The key and basic ranking are configured. Generate a short structured brief from authorised aggregate facts, retaining evidence IDs and deterministic fallback. Test one real provider request and failure behaviour. |
| 2 | Demand forecast for 15/30/60 minutes | Record enough timestamped order history, compare a simple baseline against actual outcomes, and show forecast horizon and uncertainty. Use cold-start messaging when history is insufficient. |
| 3 | Stock run-out and replenishment suggestions | Combine sales velocity with remaining stock and trading hours. Show assumptions and estimated portions needed; let staff approve changes. Current low-stock alerts are thresholds, not run-out predictions. |
| 4 | Waste prevention | Add preparation/batch and discard records before claiming waste reduction. Ingredient-level recommendations additionally need recipes and ingredient inventory. Measure avoided waste against a baseline. |
| 5 | Student personalisation | Collect explicit budget/dietary preferences and maintain trustworthy menu tags. Timetable-aware suggestions require an actual schedule integration and permission; no timetable is currently available. |
| 6 | Feedback and evaluation | Store recommendation impressions, actions and outcomes. Track pickup lateness, stockouts, forecast error and waste. Compare FIF suggestions with the baseline rather than claiming improvements from a single demo. |

The next demo should prove one complete chain: changing orders or stock changes a grounded recommendation, staff act on it, and the operational outcome is visible. A polished chat interface alone does not satisfy this goal.

## Session and access update

The app retains its existing Supabase cookies. A persistent layout provider now reuses confirmed session metadata while navigating and refreshes it in the background. No credentials or tokens were added to localStorage. APIs still verify current permissions on each protected operation.

Accounts with vendor membership cannot enter the student workspace or perform student-only ordering API actions, including accounts that retain an older student membership. Assigned-stall vendor access and explicit administrator permissions remain enforced. Signing in and out immediately updates the shared UI session.

Verification for this pass is intentionally focused: typecheck, production build, the existing role-routing regression cases, and one short vendor browser walkthrough. No push is authorised.

## Sample data and verification outcome

The guarded hosted run `demo-dashboard-20261112-sample` added ten labelled menu specials and 48 completed orders with exactly-once simulated prepaid receipts. New sample gross sales total RM373.50 across the noodles (RM232.00) and drinks/snacks (RM141.50) stalls. Original records, intake settings and merchant configuration were preserved. These are fictional transactions, not real bank payments.

Focused checks passed for projection arithmetic/overlap caps, zero-history behaviour, rejected client-supplied forecast fields, Malaysia-day analytics and vendor role routing. The demo automation passed its local transaction tests and verified each hosted collection/receipt. The dashboard's Generate action and adjustable assumptions were exercised in a live vendor browser session. Build and typecheck pass.

Live weather ingestion, verified audience data, ingredient costs/margin constraints and measured price elasticity are still outstanding. The current business preview deliberately labels those inputs as assumptions. Public real-money launch still requires verified payments and the separate launch gates described in the MVP/handoff.
