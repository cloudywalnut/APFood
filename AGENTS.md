<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## AP Food project context

Read [the engineering overview](docs/HANDOFF.md), [the product scope](docs/MVP.md) and [the backend guide](docs/BACKEND.md) before implementing changes. Backend rules live in the SQL migrations and are covered by `npm run test:backend`. Format with `npm run format`, then verify changes with `npm run typecheck`, `npm run build`, `npm test` and `npm run test:backend`.
