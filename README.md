# Infocutter

Manifest V3 Chrome extension for hiding page elements with saved per-site selectors.

## What It Does

- Hide any element on the current site through picker mode
- Save selectors per hostname
- Remove saved selectors one by one
- Disable hiding for a site without deleting its rules
- Disable the extension globally without clearing saved data

## Development Rules

- Keep selector generation centralized in `src/shared/selector.ts`
- Keep storage normalization centralized in `src/shared/storage.ts`
- Keep popup as an operator surface, not a second business-logic layer
- Keep the extension dependency-light and inspectable

## Commands

- `npm install`
- `npm run build`
- `npm run build:zip`
- `npm run check`

## Load In Chrome

1. Run `npm install`
2. Run `npm run build`
3. Open `chrome://extensions`
4. Enable `Developer mode`
5. Click `Load unpacked`
6. Select the `dist` directory

## Package For Distribution

- Run `npm run build:zip`
- The packaged archive is created in `dist-package/infocutter-v0.1.0.zip`

## Layout

- `src/background` service worker and badge updates
- `src/content` selector application and picker mode
- `src/popup` toolbar management UI
- `src/shared` schema, storage, selector, and message contracts
- `public` manifest, popup markup, and icons
- `tests` selector and storage migration tests
