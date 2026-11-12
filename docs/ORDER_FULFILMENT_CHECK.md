# Order cancellation, collection and My Orders

Verified on 13 November 2026 against hosted project `vymnnyyuiujmxxycqiod` and the local app.

## Cancellation

The frontend already offered cancellation for placed, accepted, preparing and ready orders. Hosted Supabase was still running the older transition function, which rejected student cancellation after acceptance. Applied the existing `20261112120000_cancel_orders_at_any_stage.sql` migration and recorded it in hosted migration history.

Hosted API checks confirmed:

- Owner cancellation succeeds at all four active stages.
- Another student's cancellation is rejected.
- Repeating cancellation fails without restoring stock twice.
- Placed/accepted cancellation restores unused stock and reserved work.
- Preparing/ready cancellation retains already-consumed stock/work; the confirmation explains this.
- Ready-order cancellation removes its pickup code.
- Cancelling a paid QR order marks the payment `refund_pending`; cancellation creates no collection receipt.

The browser confirmation flow was exercised with a newly created demonstration order, and the resulting cancelled order appeared in History. Temporary check orders, hidden menu items, synthetic receipts and their allocations were removed afterward. Existing catalogue stock was not used or reset.

## Short collection codes

Applied `20261113000100_eight_digit_pickup_codes.sql` to hosted Supabase. New codes are eight numeric characters generated from cryptographic UUID entropy, including leading zeroes. They remain hashed at rest, expire after five minutes, belong to one order and can only be redeemed once by that stall. QR collection remains available. Previously issued 32-character codes remain acceptable until their existing expiry.

The API and vendor collection field accept the new code format. The student pickup dialog displays the short code prominently. Hosted generation/collection checked a wrong code, correct code and repeated collection. Database tests additionally exercise leading zeroes, expiration, legacy tokens and exactly one receipt.

## My Orders

`/app/orders` opens on **Active orders**, with a separate **History** tab. Ready pickups appear first, followed by pickup time. Active rows use a restrained mustard accent; the empty state points to History or browsing.

The existing owner-scoped orders endpoint now accepts `?view=active` or `?view=history`. Status filtering happens before its 100-row limit, preventing recent completed history from hiding older active orders. The unfiltered endpoint retains its prior behavior for existing clients. History still shows the latest 100 terminal orders; it is not an exhaustive paginated archive.

A hosted/browser test used an active order dated 2023 that was outside the latest 100 orders: it appeared in Active and its pickup dialog generated an eight-digit code. Cancellation moved it out of Active. The existing `/app/history` route opens the History tab.

## Checks

Typecheck, production build, 58 unit tests and 28 backend tests passed. Pickup layout was checked at 390, 768 and 1440 pixels with no horizontal overflow. The formatting command remains unavailable because the local Prettier executable is missing. These changes have not been pushed.
