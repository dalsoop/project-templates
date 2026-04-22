import test from "node:test";
import assert from "node:assert/strict";

import { selectorCss } from "../src/shared/selector.js";
import { normalizeStore } from "../src/shared/storage.js";

void test("selectorCss emits display none rules", () => {
  const css = selectorCss([".target", "#banner"]);

  assert.equal(
    css,
    '.target { display: none !important; }\n#banner { display: none !important; }'
  );
});

void test("normalizeStore migrates version 1 shape to the current version", () => {
  const migrated = normalizeStore({
    version: 1,
    sites: {
      "example.com": {
        rules: [
          {
            cardName: "기본 카드",
            createdAt: "1970-01-01T00:00:00.000Z",
            frameScope: null,
            selector: ".banner"
          }
        ],
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  });

  const migratedProfileId = migrated.profiles[0]?.id;
  const migratedCardId = migrated.profiles[0]?.rules[0]?.cardId;

  assert.deepEqual(migrated, {
    version: 3,
    settings: {
      globalEnabled: true
    },
    profiles: [
      {
        id: migratedProfileId,
        matchers: ["https://example.com/*"],
        name: "example.com",
        enabled: true,
        rules: [
          {
            cardId: migratedCardId,
            cardName: "기본 카드",
            createdAt: "1970-01-01T00:00:00.000Z",
            frameScope: null,
            selector: ".banner"
          }
        ],
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });
});
