# Campus month demonstration data

Hosted project `vymnnyyuiujmxxycqiod`, updated 13 November 2026. All activity is fictional, including payments and receipts.

## Current coverage

November now contains **15,586 additional orders**, **14,767 ledger entries**, and **9,320 payment records**, dated **1–12 November 2026** in Malaysia time. The import covers all ten approved stalls and 37 existing products. Five hundred fictional student accounts join the two existing sample students. The campus population of 5,000+ is a scenario assumption, not a count of registered or measured users.

Weekdays have roughly 1,300–1,700 orders across the cafeteria; weekends are quieter. Meal-hour peaks, stall popularity, quantities, payment methods and expenses vary. Imported orders are collected, cancelled or rejected, so they do not flood the live kitchen. No future actual sales were created. Existing application orders, menu stock, current prices and account passwords were preserved.

## Repeatable setup

Run `npm run seed:campus-month -- --month=2026-11 --through=2026-11-12 --apply` with the ignored `.env.local` configured for the designated demonstration project. Without `--apply`, the script previews the plan. Keep the original month and through date when resuming a saved manifest. Each daily batch is atomic and idempotent; audit markers prevent duplicate imports.

The ignored `.env.campus-month-vymnnyyuiujmxxycqiod-2026-11/` directory stores the manifest, daily plans, verification results and generated account credentials. Keep it private and preserve it when resuming. No passwords belong in Git.

## Removed years

At the user's request, **40,238 demonstration orders and 37,976 ledger entries from 2024 and 2025** were removed, together with their payment records and orphan pickup slots. Hosted checks found zero remaining orders or ledger entries in those years. Year 2023, year 2026 and application-created orders were preserved.

Per-month backups are in the ignored `.env.removed-years-vymnnyyuiujmxxycqiod-2024-2025/` directory. Historical import markers remain, labelled `Demo history reset`, so the original history generator does not silently resurrect removed years.

## Reporting and projections

Report reads paginate beyond Supabase's 1,000-row response limit, reject incomplete datasets and cap a single result at 50,000 rows. The admin ledger displays 50 entries per page. The report-read migration retains role checks while avoiding repeated global-role lookups per row.

The net income outlook defaults to 30 days, with 60-, 90- and 180-day horizons available. It plots cumulative net cashflow from receipts less refunds and recorded expenses, including reversals. The baseline uses completed-day averages. Generated FIF recommendations add a separately labelled AI estimate by applying their revenue adjustment once, while holding recorded costs steady; there is no automatic compounding or manual growth control. It is a cash-basis planning estimate, excludes unrecorded costs and taxes, and does not promise growth or predict future weather. Longer horizons carry greater uncertainty. Campus rating cards identify their exact reporting date range and data-as-of time in MYT. Current partial-day sales are excluded from the projection baseline.
