# Menu photograph coverage

All **37 existing menu items across all 10 stalls** have distinct bundled photographs and a saved hosted `menu_items.image` path. The image-only backfill was applied to dedicated Supabase project `vymnnyyuiujmxxycqiod` on 13 November 2026. Prices, descriptions, stock, payment settings and orders were not changed.

These are licensed, illustrative food photographs sourced from Wikimedia Commons, rather than AI-generated images or photographs of actual campus portions. Every source, photographer, license and modification is recorded in [MENU_PHOTO_CREDITS.md](MENU_PHOTO_CREDITS.md) and `supabase/fixtures/menu-images.json`. Each modified photograph retains its individual license. Credits are publicly accessible at `/food/menu/credits.html`, linked from every stall menu; a Markdown copy is available at `/food/menu/CREDITS.md`.

## Assets and frontend behavior

- `public/food/menu/`: 37 optimized 720 × 540 JPEGs, approximately 2.2 MB combined.
- `lib/menu-image-paths.json`: thin item-ID-to-asset mapping, used as a frontend fallback when the database has no image value.
- `supabase/fixtures/menu-images.json`: source and license manifest with asset SHA-256 checksums.
- `components/storefront/catalogue.ts`: vendor-supplied valid image first, then mapped item photograph, then a generic cuisine photograph for future items.
- `components/storefront/menu.tsx`: public source/license credits link.

Candidate photos were reviewed on contact sheets before the backfill; unrelated search results and weak dish matches were replaced. These photos show examples of the named dishes, not precise ingredient or allergen guarantees. Actual serving photos uploaded by vendors take precedence.

## Repeatable image-only backfill

```sh
# Validate local asset checksums, catalogue coverage and proposed changes.
node --env-file=.env.local scripts/sync-menu-images.mjs

# Save only currently empty image fields in the dedicated demo project.
node --env-file=.env.local scripts/sync-menu-images.mjs --apply
```

Requires `AP_FOOD_DEMO_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in ignored local configuration. The command verifies the project, all image files, IDs, names and stall assignments before applying changes. It refuses unmapped catalogue items, preserves nonempty vendor images, uses the original value as a concurrency check, and saves original image values in an ignored `.env.menu-image-backup-*.json` file. Rerunning after completion proposes zero changes. Temporary hidden cancellation-check fixtures are excluded.

When adding another menu product, provide a vendor photograph or add an appropriately licensed asset and manifest entry before running the sync. Do not use the general demo-account seed command just to install images: that command also resynchronizes catalogue/account fixtures.

## Verification

Hosted readback confirmed 37/37 nonempty image values and zero remaining backfill updates. All 37 local image URLs and the public credits page returned HTTP 200. There are 37 unique source photographs and 37 unique bundled file hashes. TypeScript checking, production build, unit tests and backend tests passed. The format command remains unavailable because the local Prettier executable is missing.
