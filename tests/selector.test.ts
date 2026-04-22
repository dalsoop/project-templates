import test from "node:test";
import assert from "node:assert/strict";

import { selectorCss } from "../src/shared/selector.js";
import { groupRulesByCard, matchesUrl, normalizeStore, readStore, removeRuleFromProfile, setCardEnabled } from "../src/shared/storage.js";

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
    version: 4,
    settings: {
      globalEnabled: true
    },
    profiles: [
      {
        cards: [
          {
            createdAt: "1970-01-01T00:00:00.000Z",
            enabled: true,
            id: migratedCardId,
            name: "기본 카드",
            updatedAt: "1970-01-01T00:00:00.000Z"
          }
        ],
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
        sourceTemplateSlug: null,
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    ]
  });
});

void test("groupRulesByCard builds first-class card summaries", () => {
  const cards = groupRulesByCard([
    {
      cardId: "card-a",
      cardName: "헤더",
      createdAt: "2026-04-22T00:00:00.000Z",
      frameScope: null,
      selector: ".header"
    },
    {
      cardId: "card-a",
      cardName: "헤더",
      createdAt: "2026-04-22T00:00:01.000Z",
      frameScope: "https://example.com/frame",
      selector: ".header .cta"
    },
    {
      cardId: "card-b",
      cardName: "배너",
      createdAt: "2026-04-22T00:00:02.000Z",
      frameScope: null,
      selector: ".banner"
    }
  ]);

  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], {
    cardId: "card-a",
    cardName: "헤더",
    createdAt: "2026-04-22T00:00:00.000Z",
    enabled: true,
    frameScopes: [null, "https://example.com/frame"],
    ruleCount: 2,
    rules: [
      {
        cardId: "card-a",
        cardName: "헤더",
        createdAt: "2026-04-22T00:00:00.000Z",
        frameScope: null,
        selector: ".header"
      },
      {
        cardId: "card-a",
        cardName: "헤더",
        createdAt: "2026-04-22T00:00:01.000Z",
        frameScope: "https://example.com/frame",
        selector: ".header .cta"
      }
    ]
  });
  const secondCard = cards[1];

  assert.ok(secondCard);
  assert.equal(secondCard.cardId, "card-b");
  assert.equal(secondCard.ruleCount, 1);
});

void test("matchesUrl respects non-default ports in origin-based matchers", () => {
  assert.equal(matchesUrl("http://127.0.0.1:41771/*", "http://127.0.0.1:41771/"), true);
  assert.equal(matchesUrl("http://127.0.0.1:41771/*", "http://127.0.0.1:41772/"), false);
});

void test("removeRuleFromProfile removes only the targeted card rule", async () => {
  let persistedStore: unknown = {
    version: 4,
    settings: {
      globalEnabled: true
    },
    profiles: [
      {
        cards: [
          {
            createdAt: "2026-04-22T00:00:00.000Z",
            enabled: true,
            id: "card-a",
            name: "카드 A",
            updatedAt: "2026-04-22T00:00:00.000Z"
          },
          {
            createdAt: "2026-04-22T00:00:01.000Z",
            enabled: true,
            id: "card-b",
            name: "카드 B",
            updatedAt: "2026-04-22T00:00:01.000Z"
          }
        ],
        id: "profile-1",
        matchers: ["https://example.com/*"],
        name: "example.com",
        enabled: true,
        rules: [
          {
            cardId: "card-a",
            cardName: "카드 A",
            createdAt: "2026-04-22T00:00:00.000Z",
            frameScope: null,
            selector: ".banner"
          },
          {
            cardId: "card-b",
            cardName: "카드 B",
            createdAt: "2026-04-22T00:00:01.000Z",
            frameScope: null,
            selector: ".banner"
          }
        ],
        sourceTemplateSlug: null,
        updatedAt: "2026-04-22T00:00:00.000Z"
      }
    ]
  };

  Object.assign(globalThis, {
    chrome: {
      storage: {
        local: {
          get(key: string) {
            return Promise.resolve({ [key]: persistedStore });
          },
          set(nextValue: Record<string, unknown>) {
            persistedStore = nextValue["infocutter.ruleStore"];
            return Promise.resolve();
          }
        }
      }
    }
  });

  await removeRuleFromProfile("profile-1", {
    cardId: "card-a",
    createdAt: "2026-04-22T00:00:00.000Z",
    frameScope: null,
    selector: ".banner"
  });

  const nextStore = await readStore();
  const remainingProfile = nextStore.profiles[0];

  assert.ok(remainingProfile);
  assert.equal(remainingProfile.rules.length, 1);
  const remainingRule = remainingProfile.rules[0];

  assert.ok(remainingRule);
  assert.equal(remainingRule.cardId, "card-b");
  assert.equal(remainingRule.selector, ".banner");
});

void test("setCardEnabled updates card metadata without removing rules", async () => {
  let persistedStore: unknown = {
    version: 4,
    settings: {
      globalEnabled: true
    },
    profiles: [
      {
        cards: [
          {
            createdAt: "2026-04-22T00:00:00.000Z",
            enabled: true,
            id: "card-a",
            name: "카드 A",
            updatedAt: "2026-04-22T00:00:00.000Z"
          }
        ],
        id: "profile-1",
        matchers: ["https://example.com/*"],
        name: "example.com",
        enabled: true,
        rules: [
          {
            cardId: "card-a",
            cardName: "카드 A",
            createdAt: "2026-04-22T00:00:00.000Z",
            frameScope: null,
            selector: ".banner"
          }
        ],
        sourceTemplateSlug: null,
        updatedAt: "2026-04-22T00:00:00.000Z"
      }
    ]
  };

  Object.assign(globalThis, {
    chrome: {
      storage: {
        local: {
          get(key: string) {
            return Promise.resolve({ [key]: persistedStore });
          },
          set(nextValue: Record<string, unknown>) {
            persistedStore = nextValue["infocutter.ruleStore"];
            return Promise.resolve();
          }
        }
      }
    }
  });

  await setCardEnabled("profile-1", "card-a", false);

  const nextStore = await readStore();
  const nextProfile = nextStore.profiles[0];

  assert.ok(nextProfile);
  assert.equal(nextProfile.rules.length, 1);
  assert.equal(nextProfile.cards[0]?.enabled, false);
});
