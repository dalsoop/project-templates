# Infocutter Chrome Extension Template

Strict Manifest V3 template for DOM-hiding extensions.

## Principles

- Keep the extension small, inspectable, and reversible.
- Treat selector generation as a critical subsystem, not a utility afterthought.
- Keep cross-context logic in `src/shared`.
- Store rules in a versioned schema.
- Prefer explicit DOM creation over `innerHTML`.

## Commands

- `npm install`
- `npm run build`
- `npm run check`

## Layout

- `src/background` service worker and lifecycle hooks
- `src/content` selector application and picker mode
- `src/popup` toolbar UI
- `src/shared` schema, storage, selector, and message contracts
- `public` static extension assets
- `tests` rule and selector tests
