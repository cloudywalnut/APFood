# FIF cart additions - 12 November 2026

The reported defect was a false claim: the assistant had only read-only tools and never called a cart mutation, while model-generated replies sometimes said an item had been added.

## Resulting behavior

- Direct “add” requests and Gemini's `prepare_cart_addition` tool prepare a structured cart proposal from current published menu data and the signed-in student's saved cart. Preparation never writes.
- Names must resolve unambiguously. Missing, paused, sold-out or excessive quantities are reported explicitly. A partial proposal identifies excluded requests before confirmation.
- The student confirms with the Add to cart button or “yes please.” The component then calls the existing authenticated `PUT /api/cart`/`save_cart` flow. Only a confirmed save or recovery of its exact resulting cart produces an “Added” message.
- Existing cart lines are preserved, including other stalls and meal options. Quantities across options are checked together. There is no automatic substitution for an unavailable item.
- Confirmation rechecks current menu publication, stall state, quantity and price. Stale revisions, expired suggestions, another account and unresolved checkout attempts cannot silently replace the current cart.
- The full target cart and original revision remain attached to the proposal. An uncertain save response is recovered by reading the resulting revision and cart; repeated confirmation does not increment the quantity again. Later edits are preserved rather than rebased automatically.
- Successful saves broadcast the existing cart invalidation event to refresh badges, the cart page and other tabs.
- Proposals and their added/failed status survive same-account chat restoration. Interrupted “yes please” confirmations retain a recoverable action rather than letting the model invent success. Logout/account-switch rules still isolate chat storage.
- Model-only claims that it added something are suppressed. The model cannot checkout, pay, remove cart lines or manipulate orders.

## Verification

The exact browser sequence “Can you add steamed vegetable dumplings and pineapple” → “yes please” identified pineapple as unavailable and saved one Steamed Vegetable Dumplings. The badge changed from zero to one. The cart page showed quantity one at RM7.50, and a full reload retained it. This requested sample item remains in the demo student's cart. No order or payment was created.

Regression tests cover partial requests, preservation of existing items, repeated confirmation, lost save responses, stale revisions, account ownership, stock and price changes, ambiguity, expiry, combined option quantities and unsupported model success claims. Existing database tests cover authorization and the cart revision transaction. No SQL migration or schema change was needed.

Evidence: `functional-audit/fif-cart-confirmed.png`.

Final verification: 51 unit/isolated tests and 24 backend tests passed, along with typecheck, production build and `git diff --check`. Formatting remains blocked by the existing missing local Prettier dependency. No changes were committed or pushed.
