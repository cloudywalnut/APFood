# Historical demonstration data

Imported directly into the dedicated hosted Supabase project `vymnnyyuiujmxxycqiod` on 13 November 2026. All added activity is fictional; payment records and receipts are not evidence of real bank transactions.

## Latest state (13 November 2026)

The 2024 and 2025 demonstration orders and ledger entries have now been removed. November has been repopulated with 15,586 additional campus-scale orders through 12 November. See [CAMPUS_MONTH_DATA.md](CAMPUS_MONTH_DATA.md) for current verified coverage and backups. Counts below describe earlier imports and resets, not the present database totals.

## Earlier current-month reset

After the initial import, November 2026's generated history was removed at the user's request: **253 orders, 265 ledger entries and 170 payment records**. Generated history now ends on **31 October 2026**, with **76,513 orders**, **72,257 ledger entries** and **46,116 payment records** remaining. The import counts below describe the original import before this reset.

Orders created through the app and all earlier history were preserved. Database totals after reset were 76,756 orders and 72,481 ledger entries. Only the removed orders' slot allocations were released. An ignored local backup is saved as `.env.history-data-vymnnyyuiujmxxycqiod/reset-2026-11-backup.json`.

The November audit marker now reads `Demo history reset`; its ID is retained so running the original import again will not silently recreate November's history. Hosted verification confirmed zero remaining November history-seed orders/ledger entries, unchanged preserved-record counts, and an enabled order notification trigger.

## Imported coverage

The history runs from **1 January 2023 to 12 November 2026**, using Malaysia time, across all **10 approved stalls** and **37 existing menu products**.

| Year                      | Added orders |
| ------------------------- | -----------: |
| 2023                      |       15,460 |
| 2024                      |       18,601 |
| 2025                      |       21,637 |
| 2026, through 12 November |       21,068 |
| Total                     |   **76,766** |

- 71,042 collected orders, 3,413 cancelled orders and 2,311 rejected orders.
- 72,522 ledger entries: collection receipts, monthly ingredient/packaging/staffing expenses, and linked expense reversals.
- 46,286 payment records for collected counter and DuitNow orders. Demo-channel orders retain the existing receipt-only convention.
- 24 new fictional student accounts, plus the two existing sample students, distribute the order history across 26 accounts.
- 47 atomic monthly batches, each recorded in the audit log.

The generator varies weekday/weekend activity, semester periods, annual growth, stall demand, business hours, quantities, historical prices, meal options and payment methods. These are reproducible synthetic patterns, not actual campus measurements. It does not manufacture weather observations, AI-generated insights, real customer identities or refund completions.

## Preservation and reporting

All 243 original orders and 224 original ledger entries were preserved. Existing account passwords, menu stock, current prices and live kitchen orders were not reset. Added orders have terminal statuses, so historical seeding does not flood the kitchen with pending work.

Recent synthetic activity is capped to keep the current reporting queries below the hosted API row limit: the verification snapshot contained 614 orders and 601 ledger entries in the latest 14 days, including existing records. The dashboard still offers its existing 1/7/14-day filters; this import does not add multi-year chart controls. Longer-range reporting needs paginated queries or database aggregates before exposing those controls.

Every added ledger entry uses the `[DEMO HISTORY v1]` label. Seed IDs are deterministic and monthly audit markers use `apfoods-history-v1:YYYY-MM`. Do not delete or alter these markers independently of their associated records.

## Running and resuming

Requires the configured dedicated project, `DATABASE_URL`, server API key and the Supabase CLI. Credentials belong in ignored local configuration.

```sh
# Preview only: no database/account writes.
npm run seed:history -- --end=2026-11-12

# Apply, or safely resume the same anchored import.
npm run seed:history -- --apply --end=2026-11-12
```

The ignored `.env.history-data-vymnnyyuiujmxxycqiod/` directory stores the manifest, deterministic monthly plans, verification snapshot and generated student credentials in `students.json`. Treat that file as a secret. Keep this directory to resume the import; existing manifests require the same start/end range. Existing matching fixture accounts are reused without password resets.

Each month commits orders, slot allocations, payments, ledger entries and its audit marker in one transaction. During that short transaction, the order notification trigger is suppressed under a table lock, then restored before commit, preventing thousands of historical realtime notifications. Constraints and ownership/security rules are retained. Failure rolls back the batch. A successful month's audit marker makes replay a no-op.

## Verification performed

- Hosted counts matched the generated plans across all four years and ten stalls.
- Zero receipt/total mismatches, line-total mismatches, invalid slot allocations or future-dated orders.
- Notification trigger remained enabled after import.
- Replaying January 2023 changed neither order counts nor reserved allocations.
- Authenticated admin and noodles-vendor 14-day report APIs returned HTTP 200 with coherent ledger totals.
- Unit tests (55), backend tests (27), TypeScript checking and the production build passed. Backend tests include batch replay and rollback against a local database.
- The formatting command could not run because the local Prettier executable is missing.

The final database-size snapshot was approximately 96 MB; total hosted orders were 77,009.
