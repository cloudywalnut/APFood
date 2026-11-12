# APFoods functionality audit - 12 November 2026

This pass reviewed the current repository, repaired confirmed defects and used separate backend and frontend agents. It preserved the existing hosted catalogue and history. Nothing was committed or pushed.

## Repairs

- Vendor-only workspace eligibility is enforced in navigation, protected APIs, RPC authorization and student-data policies, including accounts retaining a student membership.
- Development loopback origin validation no longer blocks legitimate local sign-in or logout. Production origin checks remain strict.
- Account menus expose account details, the correct workspace settings and logout. Workspace navigation reuses the existing session provider instead of restarting session loading on every screen.
- Account forms capture their form before asynchronous requests; malformed administrative JSON returns an input error.
- Confirmed copilot updates use one authenticated transaction with row locking and complete original-state comparison. Prices, discounts, stock and publication status cannot partially commit or silently overwrite a changed proposal.
- Analytics seeding discovers current and legacy fixture accounts across pages, uses an actual administrator for audit records and persists its complete plan before writes. Retrying an interrupted run reuses order and receipt IDs. No analytics seed or fixture reset was performed during this audit.
- Vendor copilot tests now run in the backend test command.
- The hosted race script now uses two actual students and validates session roles, catalogue, reporting endpoints and both race setups before placing orders. A second current-generation fixture student was added to the fixture definition, without resetting or provisioning hosted accounts.

## FIF: automatic evidence beyond weather

Generating insights fetches seven inputs without requiring the vendor to enter them:

| Input | What is observed or inferred |
| --- | --- |
| Sales and demand | Selected-period order history, collected product quantities and values |
| Peak periods | Pickup-hour and weekday patterns from actual order records |
| Stock and menu | Current available portions, publication status and historical sales pace |
| Live kitchen demand | Active orders, late preparation and pickups due within an hour |
| Campus pricing | Published menu prices at other approved campus stalls; approximate product matching |
| Campus timing | Malaysia weekday/time; likely audience is explicitly an estimate |
| Local conditions | Validated Open-Meteo observations; unavailable data is labelled as an assumption |

Recommendations cover replenishment risk, clearing late preparation, peak-hour preparation, slow movers, pricing experiments and weather-sensitive merchandising. The evidence drawer is collapsed initially so charts remain visible. Estimated revenue and preparation changes retain their assumptions; extra demand may increase workload.

Incomplete sales history is rejected; incomplete peer data cannot produce a ranking. Incomplete live queues do not generate queue-specific advice. Explicit scenario overrides are labelled as selected scenarios. Malformed weather responses cannot be reported as live observations. Provider requests are bounded and read-only tool calls share the agent deadline; the client allows sufficient time for a fallback response.

Campus events, academic calendars, personal timetables, ingredient costs, measured customer demographics and wider-market research are not connected. FIF does not invent these inputs.

## Verification

- Unit and isolated API regressions: 34 passed, including the final smoke preflight revision.
- Backend/Postgres/AI tests: 21 passed, including authorization, basket atomicity, stock allocation, payment expiry, pickup replay prevention, ledger receipts and copilot updates.
- Final typecheck and production build passed; `git diff --check` passed. These results supersede intermediate agent counts.
- Browser: guest cart quantities, guest-to-account import, hosted student sign-in, checkout quote and pickup windows, existing order tracking, account/settings navigation and logout; mobile checks at 390px.
- Browser: vendor sales/collections chart toggle and one insight generation. Seven automatically checked signals and five recommendations appeared. The observed provider source was FIF Smart Rules; live Gemini success is not established by this walkthrough.
- Hosted API walkthrough: existing private demo student/vendor accounts placed one RM9 counter order, replayed checkout with the same idempotency key, verified another student received 404, advanced accepted/preparing/ready, issued a pickup code and collected with counter confirmation. Reusing the pickup code was denied; the administrator report contained exactly one RM9 receipt. The order remains as fictional demonstration history (`107a71b2-bc5c-4b44-8c99-1b2a166d9f62`). Vendor checkout was denied with 403. The initial test script accidentally used GET for token issuance; correcting the test to POST completed the same order without creating another.
- Screenshots are under `docs/functional-audit/`; detailed scope is in [FRONTEND_FUNCTIONALITY_AUDIT.md](FRONTEND_FUNCTIONALITY_AUDIT.md) and [BACKEND_FUNCTIONALITY_AUDIT.md](BACKEND_FUNCTIONALITY_AUDIT.md).

## Hosted database

The configured project `vymnnyyuiujmxxycqiod` received migrations `20261112113440` and `20261112113649`. The earlier menu-image migration was already present but unrecorded. Its function body, policies, column, bucket and execution permissions were checked before repairing its history record. A subsequent migration dry run reported the remote database up to date. No seed data was applied.

## Remaining gates

- `npm run format` is blocked: the declared Prettier package is absent from the local install, and two dependency installations failed with `ECONNRESET`. Do not report formatting as passed.
- Hosted counter checkout/fulfilment/collection passed. Hosted QR claim/expiry/refund and real multi-connection race tests were not run in this sweep. Local database tests cover their invariants; they do not prove every hosted integration.
- Email signup/recovery/invitation delivery, merchant QR uploads and every route at all three requested widths need a dedicated release rehearsal.
- Current hosted credentials differ from fresh public fixtures. Fresh fixture setup resets demonstration data, so it was deliberately not run.
- Payments remain customer-claimed demonstration payments; bank verification is outside this implementation.
- During the initial audit a direct bounded Gemini check timed out. The subsequent [student chat repair](FIF_CHAT_STATUS.md) verified live Gemini greetings, order lookup, deals and pickup windows. Live OpenAI authentication remains blocked by the rejected supplied key; local chat is explicitly configured for Gemini.

The passing checks establish the repaired paths above, not a guarantee that every production integration is ready.
