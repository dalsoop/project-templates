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
        selectors: [".banner"],
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  });

  assert.deepEqual(migrated, {
    version: 2,
    settings: {
      globalEnabled: true
    },
    sites: {
      "example.com": {
        enabled: true,
        selectors: [".banner"],
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  });
});
