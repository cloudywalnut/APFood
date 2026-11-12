# Frontend functionality audit — 12 November 2026

Focused code review and browser walkthrough against the current tree, using localhost:3000 and existing fictional hosted demo accounts. No orders, payments, invitations, credential changes, role changes or history resets were submitted.

## Confirmed issues fixed

- Student workspace and protected student tools only checked the student membership. They now use the shared workspace eligibility rule, which excludes vendor accounts even when those accounts also have a student membership. Vendor access to `/app` was verified to show Workspace unavailable and the vendor entrance.
- Every workspace/account navigation fetched its own session, despite an existing root session provider. The common workspace gates and account page now consume that provider, retaining the authenticated identity across navigation and responding immediately to sign-in/sign-out invalidation.
- Account settings always linked to student settings. The link now opens the account's assigned workspace settings, and student entrances are omitted for vendor accounts.
- The header account dropdown was missing after UI cleanup. Student, vendor/admin and account headers now expose View account, Settings and Log out. The dropdown supports keyboard Escape, outside dismissal, error display and double-submit prevention.
- The account security form attempted to reset `event.currentTarget` after an await, when React has cleared it. It now captures the form before the request. Credential mutation was code-reviewed only; no credentials were changed.
- The development sign-in quick-fill list contained current public seed identities that are absent from the currently connected hosted demo project. Removed the misleading list. Private local fixture credentials remain local and are not bundled into browser code.

## Browser checks completed

| Flow | Observed result |
| --- | --- |
| Guest storefront and meal options | Stall/menu/deal navigation rendered; two discounted noodle portions added to browser cart |
| Guest cart quantities | Decrease changed quantity 2 to 1 and total RM18 to RM9; original-price savings remained correct |
| Hosted student sign-in with checkout return | Existing student fixture signed in and returned to `/app/checkout` |
| Guest-to-account cart import | Empty account cart automatically imported the one-portion guest basket |
| Checkout quote and scheduling | Server quote RM9; soonest pickup and shared 15-minute later windows rendered; no place-order action submitted |
| Account menu and account navigation | Student menu exposed correct account/settings destinations; View account opened authenticated profile without a sign-in screen |
| Orders and mobile width | Existing collected/cancelled/ready records loaded at 390×844; Active filter left the Ready order; header and fixed navigation fit the viewport |
| Session logout | Existing vendor logout initially failed origin validation; after backend origin fix it returned to the sign-in screen |

Evidence: `functional-audit/student-checkout-account.png`, `functional-audit/mobile-tracking-account.png`, `functional-audit/logout-result.png`.

Final browser checks: the existing Ready order detail rendered its pickup details, line total and progress at 390px; the mobile dropdown fitted within the viewport; Settings opened `/app/settings`; account-menu Log out returned to the sign-in form. The viewport override was reset. The saved one-portion cart remains on the fictional student account. No pickup token was issued.

Validation: `npm run typecheck` and `npm test` passed (24 unit tests). `npm run format` could not run because the declared Prettier dependency was absent from node_modules; the main agent is resolving dependencies and running the complete required checks.

## Limits

- No new order was needed; placing/collecting/cancelling an order, QR claiming, pickup token issuance, refunds and receipts were not mutated in this walkthrough.
- Existing guest/account cart conflict choice was code-reviewed but the hosted account cart was empty, so the conflict UI was not exercised.
- Signup, email delivery/recovery/invitation and security updates were intentionally not submitted.
- This focused sweep does not claim that every route or every viewport was interactively exercised. Backend invariants and the complete automated check results are tracked in the main handoff.
