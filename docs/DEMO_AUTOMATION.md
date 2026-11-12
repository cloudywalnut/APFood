# Fictional menu, traffic and collection rehearsal

`scripts/demo-run.mjs` reuses the existing `local-demo-db.mjs` migration/seed harness and the same authenticated checkout and fulfilment RPCs as the application. `scripts/demo-menu.mjs` supplies ten fictional specials: hot laksa and soup noodles, dry noodles, dumplings, hot kopi/teh, iced drinks, toast and chilled fruit. Prices are integer MYR sen; items have stock and preparation work units. Every added name includes `[Demo <run-id>]`; descriptions explicitly say fictional demo.

The default is a dry run. No credentials, environment files, network or database are accessed. Hosted generation requires explicit execution and the designated-project guard.

```powershell
npm run demo:plan -- --scenario heavy --run-id lunch-rehearsal
```

Run the full flow in a fresh disposable in-memory PostgreSQL database:

```powershell
npm run demo:run -- --scenario light --run-id lunch-rehearsal
npm run demo:run -- --scenario medium --run-id lunch-rehearsal
npm run demo:run -- --scenario heavy --run-id lunch-rehearsal
```

These commands never connect to hosted Supabase, even if `.env.local` is present. Each invocation creates and closes its own database. Existing `npm run simulate:traffic -- heavy` remains the focused shared-bucket conflict demonstration; this runner adds varied menu purchases and completes every placed order.

| Profile | Student orders | Arrival interval | Flow |
| --- | ---: | ---: | --- |
| Light | 4 | 1,200 ms | Small mix of meals, cold tea and toast |
| Medium | 12 | 700 ms | All ten menu choices and occasional two-item quantities |
| Heavy | 24 | 250 ms | Compressed lunch rush; authoritative quotes spread overflow across buckets |

Use `--orders 48` to override a profile's order count in one run while adding only ten menu items. The count must be an integer from 1 to 100 and becomes part of the persisted run configuration. Capacity and opening hours still determine what can be placed; the override never expands them.

Each order takes the owner-authorized `duitnow_qr` demo path, submits `claim_qr_payment`, and moves through `accepted → preparing → ready`. Its student owner requests a real one-time pickup token and the assigned vendor redeems that token. The runner retries checkout with the same exact intent to verify idempotency, checks a second redemption returns `PICKUP_ALREADY_USED`, and reads the scoped ledger to assert exactly one matching receipt. Payment is `customer_claimed_demo`: no bank verification or real money movement occurs. Fulfilment is compressed in time; collection follows readiness without waiting until the scheduled pickup window, as allowed by the current API.

For an explicitly assumed-paid demonstration, `--payment demo` selects the application's existing simulated prepaid tender instead. It skips merchant QR prerequisites and `claim_qr_payment`, while preserving student checkout, scoped vendor stages, owner-issued pickup tokens and actual vendor redemption. Each collected order must have one matching `kind=demo` receipt. This is an explicit alternative, never an automatic fallback from QR failure. Payment mode is persisted and cannot change when resuming a run.

`--interval-ms 0 --stage-ms 0` runs an accelerated rehearsal. Defaults pause 150 ms at each preparation/collection step. The runner alternates two actual fixture student accounts; they represent fictional order cohorts, not unique enrolled students. Vendor fixture accounts only perform vendor operations. No service-role key is read or used. Local setup configures the demo-payment feature and placeholder merchant records only inside the disposable database; these placeholders are not uploaded QR assets.

## Opt-in hosted demonstration

Hosted execution adds persistent fictional menu items, orders and collected receipts to the designated demonstration project. It does not delete history, clear carts, reset stock, change capacity/hours, enable QR payments or replace merchant settings. This is an additive run in a shared designated demo project, not a separate hosted tenant or simulation schema. Its capacity and ledger totals include other activity already in that project. The output and menu names carry run provenance; the database does not have an order-level simulation-run column.

Prerequisites:

- Existing `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `AP_FOOD_DEMO_PROJECT_REF` for the designated project.
- Existing ignored `.env.demo-users.json` from the account bootstrap, with matching project and all five original passwords. The runner validates `app_metadata.ap_food_fixture` for every account before business mutations.
- Student A/B must remain actual student accounts; the two vendor fixtures must have their existing stall memberships, and the admin fixture must have its admin membership.
- The existing designated-project QR demo mechanism must already be enabled, and both vendors must have merchant QR settings configured through Vendor → Payment settings. Stalls must be approved, accepting orders, and have feasible windows at least 20 minutes ahead. This script does not change those controls.

Merchant QR settings and the QR feature flag are required only for the default `duitnow_qr` mode. `--payment demo` uses the supported simulated prepaid tender without configuring either. Both modes require approved, accepting stalls and authoritative feasible pickup windows.

Inspect a hosted plan first; replace the project-ref placeholder in the execution command:

```powershell
node scripts/demo-run.mjs --hosted --scenario medium --run-id judge-lunch-01
node --env-file=.env.local scripts/demo-run.mjs --hosted --execute --allow-project YOUR_DESIGNATED_PROJECT_REF --scenario medium --run-id judge-lunch-01
node --env-file=.env.local scripts/demo-run.mjs --hosted --execute --allow-project YOUR_DESIGNATED_PROJECT_REF --scenario heavy --orders 48 --payment demo --run-id dashboard-samples-01
```

Use the same command/run ID to resume after interruption. An ignored `.env.demo-run-<run-id>.json` persists the configuration, exact checkout intents and resulting order IDs before/after checkout. Stable request keys and persisted intents prevent duplicate checkout after an ambiguous response. Already collected orders are verified without being collected again; existing run menu stock is preserved. Do not delete the manifest to retry a hosted run. New run IDs intentionally add new menu records and orders. Run IDs cannot be reused across scenarios, projects or menu fixture versions.

A per-run exclusive lock prevents simultaneous processes on the same workstation from replaying the same manifest. After a process crash, confirm it has stopped before removing only its `.lock` file. Do not run the same run ID from separate machines: their manifests/locks are local. Credentials and manifests remain ignored; never paste credentials into docs or terminal output.

If the run stops due to expired payment, cancelled orders, closed stalls, exhausted windows or changed permissions, inspect that specific order through the application. The runner leaves the audit/history intact and fails with a concise error. It does not cancel an existing order or reset stock automatically. Unknown network failures retain the original pending intent for the next invocation. Recognized quote expiry/capacity conflicts trigger bounded fresh-quote attempts.

## Demo walkthrough

1. Start the app with `npm run dev`. For a hosted visual walkthrough, run the explicit hosted command above while using the same designated project in the app. In-memory rehearsals only produce terminal reports and cannot populate the browser's hosted database or preview localStorage.
2. Watch the fictional progress lines on stderr and JSON summary on stdout. The summary reports placed/collected counts, exactly-once receipts, totals in sen, chosen windows, capacity buckets and order IDs. Redirect stdout if a durable report is useful; it contains no pickup codes, passwords or access tokens.
3. Open Student Orders with Student A/B, Vendor Reports/Kitchen with the corresponding vendor, and Admin reports with the demo admin. Completed orders contribute to the default seven-day sales view. The vendor kitchen stages are brief; increase `--stage-ms` up to 5,000 to observe each transition.
4. Compare hot soups/noodles/hot drinks with cold drinks/snacks in the AI dashboard weather scenarios. The fixture provides candidate variety; recommendations remain dependent on the dashboard's authoritative evidence and rules.
5. Explain that traffic is **fictional app pickup activity** and that physical crowd conditions are **not verified**. Heavy traffic consumes historical capacity and moves later purchases to feasible windows. Collection keeps historical capacity reservations for analytics, as the checkout contract requires.

Focused verification: `npm run test:demo`. Existing backend checks remain available through `npm run test:backend`; repository gates are `npm run typecheck` and `npm run build`.

## Hosted sample run · 12 November 2026

At the user's request, `demo-dashboard-20261112-sample` added **48 completed fictional orders**, **48 exactly-once `demo` receipts**, and **ten new run-labelled menu specials** to designated project `vymnnyyuiujmxxycqiod`. New simulated sales total **37,350 sen (RM373.50)** across `campus-noodle-bar` and `brew-and-bites`. All purchases used owner-authorized checkout, normal vendor preparation stages, student-issued pickup credentials and actual vendor redemption. Every repeated checkout returned the same order; every second pickup redemption was rejected; every order's ledger amount and receipt count matched.

The execution used `--payment demo --orders 48 --scenario heavy`, spreading purchases across seven feasible 15-minute pickup windows without changing capacity, hours or payment feature flags. The initial QR preflight lacked a merchant profile and stopped before business writes; the explicitly selected supported simulated prepaid tender then completed successfully. No receipts were fabricated, backdated or inserted directly; existing history was retained. The ignored manifest for the completed run must remain in place to preserve safe repeat/resume behavior.

Collected orders no longer count as active pickups, so `pickup_activity().pickup_count` is zero for this finished cohort; historical reserved work units and collected sales remain available for analytics. The runner's three focused tests pass, including a 48-order isolated simulated-prepaid run.
