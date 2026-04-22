import test from "node:test";
import assert from "node:assert/strict";

import { selectorCss } from "../src/shared/selector.js";

void test("selectorCss emits display none rules", () => {
  const css = selectorCss([".target", "#banner"]);

  assert.equal(
    css,
    '.target { display: none !important; }\n#banner { display: none !important; }'
  );
});
