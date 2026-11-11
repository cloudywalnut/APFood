# Storefront and preference update

The student storefront takes browsing cues from https://www.foodpanda.my/: a search-led header, cuisine shortcuts, promotions, stall cards and filters. It retains the AP Foods cream, mustard and espresso palette, cafeteria map and existing hosted checkout. The source homepage and listing were reviewed; restaurant detail access was blocked by the source site's bot check.

The AP monogram is followed by **Foods**, avoiding duplicated initials. Menu customisation, basket quantities, map navigation and workspace search remain connected to the existing data layer. Catalogue results use published stalls and active menu items; promotions use actual configured discounts.

## Guest boundaries

Guests can browse menus, search, filter, inspect public pickup activity and build a local basket. They do not receive personal FIF recommendations or active-order panels. The storefront instead offers sign-in. Checkout and order history require an active verified account. Reports, notifications and operations tools retain their existing role checks. Session invalidation and returning to the tab refresh the visitor session.

Signed-in FIF recommendations use server-derived app activity and pickup capacity. Timetable integration is not implemented; the UI must not claim to know the student's schedule.

## Preference cookies

- `ap_food_cookie_choice` remembers the optional-cookie decision for 180 days.
- With opt-in, `ap_food_preferences` remembers list density, display timezone and in-app update settings for 180 days.
- Both cookies are scoped to `/`, use `SameSite=Lax`, and use `Secure` on HTTPS. Preferences contain no credentials or account data.
- Essential-only mode removes the optional preference cookie. Changes then last for the current visit; a reload restores defaults.
- `/cookies` allows changing the choice later. Existing local preferences are imported when the user opts in. Sign-in, carts and checkout recovery retain their separate storage.
- No advertising or analytics cookies were added.

## Verification

Browser checks covered guest checkout/history/tool gating, cookie opt-in and opt-out after reload, catalogue filtering, map/card switching, menu customisation and adding to the basket. The storefront fits 390, 768 and 1440 px without horizontal document overflow. Preference persistence has a regression test. Frontend tests, backend tests, typecheck and production build pass.

Changes remain local on `Keyaan`; nothing was pushed.
