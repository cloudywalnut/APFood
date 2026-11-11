# Latest UI update · 11 November 2026

This update applies only to APFoods-Latest-UI. The original APFood checkout and backend are unchanged.

- Student banner is composed in HTML/CSS with live text, navigation and individual meal artwork. Its cream/gold background fills the banner on desktop and phone.
- The cafeteria is an interactive SVG floor plan with warm tiled flooring, stepped walls, striped counters, seating, planters and area labels, following the supplied visual guide. The full map stays visible: no viewBox zoom, animation or zoom controls. Hover or keyboard focus previews a stall and sample storefront; selecting it opens its existing menu. Phone users tap a counter, then select the stall. Storefronts remain configurable placeholders.
- Campus browse, recommendations, promotions and student meal search enter through the map. Promotional and search links prefill the map filter. Existing specific-stall menus and item pages remain available after selecting a stall.
- The browser basket retains meals from different stalls. Checkout offers pickup windows available at every selected stall, validates all groups before mutation, and creates one order per stall. Each order keeps its own item prices, kitchen scope, tracking, collection code and receipt flow. Multi-stall checkout opens the order list. These are frontend mock changes; no production backend was modified.
- Added-to-cart feedback uses one dismissible notification lasting five seconds, with no persistent confirmation below the item editor.
- Shared plain-language descriptions appear on hover and keyboard focus across student, vendor and administrator navigation, controls, metrics and sections. Section-card information icons also expose help. Escape dismisses help. This follows AIDA's concise explanation pattern; AIDA was inspected read-only.

Validation: 38 automated checks, TypeScript and production build. Browser checks cover full-view map, keyboard stall preview → menu, preserving a cross-stall basket, checkout’s shared pickup times, automatic toast dismissal, student/admin/vendor help, and no horizontal overflow at 390 px. Test-added basket item was removed after verification.

The map is drawn as vector artwork to follow the reference’s colours and layout; it is not a pixel-identical bitmap of the supplied diagram. Real storefront photos remain to be supplied.

The student hero now spans edge to edge directly beneath the app header as a horizontal strip with no rounded outer corners or page gutters.
