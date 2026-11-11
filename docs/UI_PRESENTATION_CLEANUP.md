# UI presentation cleanup · 11 November 2026

Removed global hover descriptions, information icons, the Workspaces & information card for all three roles, prototype/sample activity badges, the sign-in disclosure, decorative banner labels, the sign-in branding footer and the map entrance label. Stall image previews remain available as part of ordering navigation.

Replaced chart bars, chart legends, net flow lines, comparison colours, activity meters and status indicators with the cream, mustard, gold and espresso palette. Added contextual back arrows to secondary workspace pages; existing cart, checkout, order-detail and item-detail arrows remain.

Only display copy and frontend navigation/styles changed. Internal payment enum values, storage keys, ordering rules and backend code are preserved. Account shortcuts remain under Accounts. Reports retain calculations and data tables with cleaned display labels.

Validation: 38 tests, TypeScript, production build and browser checks of login, administrator charts, More and back navigation.

Selective help update: small information icons now explain only ambiguous metrics and controls. Each description is a single short sentence. Hover, focus and tap open the popup; Escape, blur or tapping elsewhere closes it. Broad section and navigation descriptions remain removed. Changes stay local until the user explicitly requests a push.
