> Current UI: see [UI_PRESENTATION_CLEANUP.md](UI_PRESENTATION_CLEANUP.md) and [LATEST_UI_UPDATE.md](LATEST_UI_UPDATE.md). The basket supports multiple stalls, browsing starts on the map, and the UI uses the cream/gold/espresso theme. Backend development remains on Keyaan.

# AP Food + FIF · Current MVP

The hackathon demo succeeds when a student can order from a fictional campus stall, a vendor can prepare and hand off the order, and a cafeteria admin can trace the operational and financial result. FIF should visibly help at each step. See the [handoff](HANDOFF.md) for implementation status and the [original specification](../AP_Food_FIF_Agent_Ready_MVP_Spec.md) for the full domain and test reference.

## Core demo

1. **Student pickup.** Discover stalls on the cafeteria map, build a basket across stalls, see authoritative prices and shared feasible 15-minute slots, choose QR or counter payment, and follow each stall's order to pickup. The original single-stall flow remains supported.
2. **Vendor fulfilment.** Accept, prepare, and mark an order ready. Verify one-time pickup by QR or manual code and confirm counter payment when applicable. Manage menu stock, hours, capacity, and intake.
3. **Cafeteria operations.** Compare vendor activity and products. Review demo receipts, expenses, reversals, and net flow. Manage stall approval and zone assignments, with an audit trail.
4. **FIF at the point of decision.** SmartQueue computes feasible pickup windows, FlowSense shows app demand and load, and InsightAI ranks evidence-backed actions for students, vendors, and admins. Core operations have a deterministic fallback.
5. **Repeatable simulations.** Run Light, Medium, and Heavy demand through the real checkout path in an isolated demo context. Show the full bucket, resulting conflicts, and feasible alternatives. Label all simulated data and distinguish it from physical crowd observations.

## Release sequence

| Milestone | Gate |
| --- | --- |
| Frontend preview · available | Complete the three-role walkthrough with browser fixtures, including promotions, pickup, traffic filters, and expense reversal. |
| Supabase foundation | Migrations, seeded roles, RLS, atomic checkout and capacity allocation, and scoped fulfilment pass integration checks. |
| End-to-end backend demo | Private status updates, collection and receipt posting, and server-derived admin totals work across separate authenticated sessions. |
| FIF and simulation | The CLI produces distinct reproducible load profiles. Gemini ranks eligible actions with validated evidence and a rules-based fallback. |

Fictional orders and simulated tender are the basis for the demo. Keep the UI clear about the source of each metric. Delivery, real money movement, advanced forecasting, timetable sync, and campus service integration sit outside the hackathon release.
