# Infocutter Template Rules

This directory is a strict template for Manifest V3 DOM-hiding extensions.

## Source Rules

- Do not add new runtime dependencies without a written reason in the commit body.
- Do not place business logic directly in popup or service worker files when it can live in `src/shared`.
- Do not write storage objects inline outside `src/shared/storage.ts`.
- Do not invent selector generation logic outside `src/shared/selector.ts`.
- Do not use `innerHTML`, `eval`, `new Function`, or remotely hosted code.
- Do not mix site-specific hacks into generic selector code. Put them behind a named adapter or not at all.
- Do not widen permissions casually. Prefer the smallest viable manifest surface.
- Do not persist unversioned storage data.
- Keep content script behavior deterministic and idempotent. Reapplying rules must be safe.
- Keep diffs small. Delete before adding abstractions.

## Architecture Rules

- `src/background` owns lifecycle and orchestration only.
- `src/content` owns page interaction, rule application, and picker mode.
- `src/popup` owns operator controls only.
- `src/shared` owns contracts, storage schema, selector logic, and pure helpers.

## Verification Rules

- Run `npm run lint`
- Run `npm run typecheck`
- Run `npm run test`

Do not claim the template is ready unless all three pass.
