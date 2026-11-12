# Backend functionality audit

Verified against the current repository on 12 November 2026. This audit used disposable in-memory PGlite databases and isolated API dependency fakes. It did not change a hosted database, seed hosted data, send mail, or invoke a live payment service.

## Confirmed defects repaired

| Defect | Repair | Evidence |
| --- | --- | --- |
| Accounts with both vendor and student memberships could bypass the workspace restriction through direct checkout RPCs. Several student API mutations also omitted the application membership guard. | Added student guards to quote, order placement, payment claim and pickup token endpoints. The new role-helper migration denies the student role whenever a vendor membership exists, including direct RPC and personal student RLS access. Assigned vendor access remains available. | The new account test failed on the unmodified database with “Missing expected rejection”; it passes with the migration. API tests verify rejection before RPC and successful ordinary student calls. |
| Development sign-in failed when the configured loopback origin differed from the browser's loopback hostname. | Allowed development mutations when the browser origin exactly matches the request URL and both the configured and request hosts are loopback. Production retains the exact configured-origin check. | Tests cover localhost, 127.0.0.1, IPv6 loopback, foreign origins, port mismatches, missing origins and non-loopback configuration. |
| Copilot confirmations saved menu changes and discounts in separate transactions, using privileged access for the second write. Price, discount, visibility and stall snapshots could also become stale without detection. | Added a session-authenticated, vendor-scoped atomic RPC with the existing stall advisory lock, row locks, complete original snapshot comparison, allowed-field/range validation and one transaction for changes plus audit logging. The executor uses one RPC and no longer needs a secret key to update a discount. | PGlite verifies scope, stale snapshots, invalid price/discount rollback, combined updates and stale replay rejection. Executor tests verify one RPC and stale item/stall rejection before writing. |
| Malformed JSON in account management and invitation actions became a server error. | Both actions now return a structured invalid-input error. | Isolated tests verify status 400 and `INVALID_INPUT` before any account operation. |
| The analytics seeder searched only the first page of users and obsolete student aliases; interrupted runs could duplicate random-ID history, and its audit record used a student as the admin actor. | Paginated discovery accepts the current fixture student/admin accounts plus explicit legacy aliases. A project/stall-specific ignored JSON plan is persisted before writes and reused on retry; orders, receipts and the admin-authored marker use the persisted IDs with duplicate-ignoring upserts. Marker lookup errors abort safely. | Pure helper tests cover users beyond the first page, plan reuse, injected receipt and marker failures, idempotent retries, project mismatch and marker lookup errors. No seeder was run against a hosted project. |

The copilot now imports the shared campus-weather helper and no longer includes a hardcoded July semester claim. The shared helper and model/scenario changes are covered by the broader audit work.

## Existing behavior verified

- Student and stall order isolation, anonymous/private-table restrictions, unconfirmed and suspended-account denial, and last-admin protection.
- Checkout quote ownership, expired/used quotes, retry payload matching, stock and capacity conflicts, and stock/capacity release on cancellation.
- Atomic multi-stall basket checkout, exact retry behavior and preservation of a newer cart on retry.
- QR payment claims, unpaid expiry, refund state transitions and merchant settings; counter confirmation at collection.
- Pickup-code replacement, replay denial and exactly one receipt per collection.
- Discounted quote/order pricing, expense idempotency, reversals and historical ledger zone snapshots.
- Vendor access to its own ledger and denial of other stalls' receipts.
- Report collection revenue versus order-created-date values, cancelled-order exclusion from ordered value and pickup demand, reversals, product snapshot value, and rejection of truncated order/ledger results. No report implementation change was needed.

## Files changed in this backend audit

- `lib/backend/api.ts`, `lib/backend/supabase.ts`, `lib/backend/account-actions.ts`, `lib/backend/vendor-copilot.ts`, `lib/backend/errors.ts`.
- `supabase/migrations/20261112113440_vendor_student_workspace_isolation.sql`.
- `supabase/migrations/20261112113649_atomic_vendor_copilot_actions.sql`.
- `tests/accounts.test.mjs`, `tests/backend.test.mjs`.
- `tests/api-auth.test.cjs`, `tests/backend-reports.test.cjs`, `tests/request-origin.test.cjs`, `tests/copilot-execute.test.cjs`, `tests/support/load-typescript.cjs`.
- `scripts/seed-vendor-analytics.mjs`, `scripts/analytics-seed-plan.mjs`, `tests/analytics-seed-plan.test.cjs`.

## Validation and limits

During this backend pass, `npm run test:backend` passed 20 tests, `npm test` passed 24 tests and `npm run typecheck` passed. After the analytics seed repair, its three additional isolated tests also passed. The root audit owns the final combined tests, formatting and production-build verification. Prettier was absent from the installed local dependencies during this pass; an `npx prettier` attempt did not complete, so it is not reported as a successful formatting check.

Deployment update: the root audit subsequently applied both reviewed migrations to the configured hosted project. It also repaired the existing image migration's history after comparing the exact procedure body, column, bucket and policies; the subsequent migration dry run reported up to date. These hosted deployment checks were performed by the root audit, separately from the local backend tests above.

Hosted Auth/email delivery, storage uploads, actual Realtime delivery, cron scheduling, and real multi-connection concurrency remain outside these local results. PGlite uses stand-ins for Supabase Auth and Realtime; passing these tests does not establish those platform integrations. This project uses demo payment claims and does not verify bank transfers. No production-readiness claim is made.
