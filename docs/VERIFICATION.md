# Verification · 11 November 2026

Target: dedicated fictional Supabase project `vymnnyyuiujmxxycqiod`; local application at `http://127.0.0.1:3000`. These checks create fictional transactions in that project.

## Passed

- `npm run typecheck` and `npm run build`.
- `npm run test:backend`: five tests covering actual SQL migrations, role isolation, stock/capacity allocation, retries, pickup replay, receipt accounting, persistent cart revisions, QR payment claims, cancellation, expiry, final-admin protection, isolated local traffic scenarios, and FIF output validation/fallback.
- Enabled hosted smoke: 20 concurrent requests to a five-unit noodle window produced five successes and 15 slot conflicts. The coffee stock test produced four successes and 16 stock conflicts. Scoped reads, pickup replay denial, and promotion receipt checks passed. Unused test orders were cancelled by the smoke script.
- Separate Chrome contexts for student, vendor, and administrator: merchant QR upload, guest cart import, QR checkout, pending-payment kitchen restriction, “I've paid” → Paid, repeated claim, preparation stages, cross-session status updates, pickup-code collection, and one RM9.00 receipt.
- Administrator suspension blocked the student's orders API with 403; reactivation restored access.
- The saved student cart appeared in a fresh browser context. An increase in one tab refreshed a second tab without reloading the page.
- All three FIF panels displayed server-generated recommendations using rules. A student requesting admin recommendations and a vendor requesting another stall's recommendations received 403.
- Posting a RM3.21 expense reduced authoritative net flow by 321 sen; its reversal restored the previous total.
- Signup, cart, vendor payment settings, and admin users pages had no horizontal document overflow at 390, 768, and 1440 pixels.

The browser scripts used during this session are local QA files under ignored `.playwright-cli/`. The SQL and FIF regression tests are checked in. To repeat hosted HTTP checks on the dedicated demo, enable `AP_FOOD_HOSTED_SMOKE=1` and run `npm run test:hosted` while the app is running. Restore fixture stock between repeated runs if a collected item is exhausted.

## Remaining checks and features

- Full email delivery and link walkthrough for confirmation resend, recovery, invitations, and email changes, including expired/reused links and deployed redirects. A prior confirmation email delivery succeeded; that alone does not verify every Auth email template.
- Live Gemini call after `GEMINI_API_KEY` is configured. Success, malformed output, unknown action/evidence IDs, provider errors, timeout exceptions, and missing-key fallback currently use controlled provider fixtures.
- Hosted simulation run persistence, resume, isolation, and dashboard run filters. Light/Medium/Heavy currently run through migrations in an isolated embedded database.
- Explicit WebSocket subscription evidence, broader keyboard/focus checks, and all-screen responsive review. The cross-session walkthrough verifies status propagation, which can also use the polling fallback.
- Production hosting, email template deployment, and production abuse controls. DemandSense and ScheduleSync remain follow-on scope.

Customer confirmation marks QR payment Paid immediately. Payment provenance remains `customer_claimed_demo`; no bank verification is performed. Real payment verification is deferred by the current demonstration requirement.
