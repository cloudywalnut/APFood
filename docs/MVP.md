# AP Food + FIF · Product scope

The demo succeeds when a student orders from a campus stall, the vendor prepares and hands off the order, and a cafeteria admin can trace the operational and financial result, with FIF helping at each step. Stalls, orders and payments in the demo project are fictional. See the [engineering overview](HANDOFF.md) for what is built.

## Core flows

1. **Student pickup.** Find stalls on the cafeteria map or as cards, build a basket across stalls, see confirmed prices and shared 15-minute pickup windows, pay by QR, counter or demo tender, and follow each order to pickup with a one-time code.
2. **Vendor fulfilment.** Accept, prepare and mark orders ready. Verify the pickup code and confirm counter payment. Manage menu, stock, hours, capacity and order intake.
3. **Cafeteria operations.** Compare vendors and products, review receipts, expenses, reversals and net flow, manage stall approval and food courts, manage users, and review the audit trail.
4. **FIF.** Pickup windows only offer slots the kitchen can handle. Traffic shows booked pickup load per stall. Vendor and admin dashboards recommend the next action from live data, with rules always available and optional Gemini ranking.

## Out of scope

Delivery, real money movement and bank verification, measured physical crowd data, advanced forecasting, timetable sync and campus system integration. Student FIF can prepare cart additions and save them after explicit student confirmation. It cannot place, pay for, change or cancel orders, or autonomously remove items from the cart.
