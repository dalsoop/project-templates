(() => {
const STORAGE_KEY = "infocutter.ruleStore";
const STORAGE_VERSION = 4;
const STYLE_ELEMENT_ID = "infocutter-style-rules";
const PICKER_OVERLAY_ID = "infocutter-picker-overlay";
const PICKER_PREVIEW_STYLE_ID = "infocutter-preview-style";
const PICKER_PREVIEW_PANEL_ID = "infocutter-preview-panel";
const PICKER_STATUS_BADGE_ID = "infocutter-status-badge";
const PICKER_SESSION_PANEL_ID = "infocutter-session-panel";
const PICKER_SESSION_OVERLAY_ID = "infocutter-session-overlay";
const PICKER_FRAME_MESSAGE_TYPE = "infocutter/start-picker-in-frame";
const PICKER_FRAME_ACK_TYPE = "infocutter/start-picker-in-frame-ack";

const messageTypes = {
  updatePickerFocus: "infocutter/update-picker-focus",
  ping: "infocutter/ping",
  getPageState: "infocutter/get-page-state",
  startPicker: "infocutter/start-picker",
  stopPicker: "infocutter/stop-picker",
  hideLastContextTarget: "infocutter/hide-last-context-target",
  clearSiteRules: "infocutter/clear-site-rules",
  removeSiteRule: "infocutter/remove-site-rule",
  toggleSiteEnabled: "infocutter/toggle-site-enabled",
  toggleGlobalEnabled: "infocutter/toggle-global-enabled"
} as const;

const infocutterGlobal = globalThis as typeof globalThis & {
  __INFOCUTTER_CONTENT_LOADED__?: boolean;
};

if (!infocutterGlobal.__INFOCUTTER_CONTENT_LOADED__) {
infocutterGlobal.__INFOCUTTER_CONTENT_LOADED__ = true;

type SiteRuleSet = {
  cards: {
    createdAt: string;
    enabled: boolean;
    id: string;
    name: string;
    updatedAt: string;
  }[];
  id: string;
  matchers: string[];
  name: string;
  enabled: boolean;
  rules: {
    cardId: string;
    cardName: string;
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }[];
  updatedAt: string;
};

type RuleStore = {
  version: 4;
  settings: {
    globalEnabled: boolean;
  };
  profiles: SiteRuleSet[];
};

type ActiveSiteState = {
  activeProfileId: string | null;
  activeProfileName: string | null;
  cardCount: number;
  cards: {
    cardId: string;
    cardName: string;
    createdAt: string;
    enabled: boolean;
    frameScopes: (string | null)[];
    ruleCount: number;
    rules: {
      cardId: string;
      cardName: string;
      createdAt: string;
      frameScope: string | null;
      selector: string;
    }[];
  }[];
  enabledSelectorCount: number;
  globalEnabled: boolean;
  hostname: string;
  matchers: string[];
  profileEnabled: boolean;
  rules: {
    cardId: string;
    cardName: string;
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }[];
  selectorCount: number;
  updatedAt: string;
  url: string;
};

let pickerStop: (() => void) | null = null;
let lastContextTarget: Element | null = null;
let selectionSession: {
  cardId: string;
  cardName: string;
  createdAt: string;
  frameScope: string | null;
  selector: string;
}[] = [];
const selectionSessionPalette = [
  { fill: "rgba(34, 197, 94, 0.10)", stroke: "rgba(34, 197, 94, 0.92)" },
  { fill: "rgba(59, 130, 246, 0.10)", stroke: "rgba(59, 130, 246, 0.92)" },
  { fill: "rgba(249, 115, 22, 0.10)", stroke: "rgba(249, 115, 22, 0.92)" },
  { fill: "rgba(168, 85, 247, 0.10)", stroke: "rgba(168, 85, 247, 0.92)" },
  { fill: "rgba(236, 72, 153, 0.10)", stroke: "rgba(236, 72, 153, 0.92)" }
] as const;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createProfileCard(
  cardId = generateId(),
  cardName = "기본 카드",
  createdAt = new Date(0).toISOString()
): SiteRuleSet["cards"][number] {
  return {
    createdAt,
    enabled: true,
    id: cardId,
    name: cardName,
    updatedAt: createdAt
  };
}

function isSameStoredRule(
  rule: {
    cardId: string;
    createdAt: string;
    frameScope: string | null;
    selector: string;
  },
  targetRule: {
    cardId: string;
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }
): boolean {
  return (
    rule.cardId === targetRule.cardId &&
    rule.createdAt === targetRule.createdAt &&
    rule.frameScope === targetRule.frameScope &&
    rule.selector === targetRule.selector
  );
}

function groupRulesByCard(
  rules: {
    cardId: string;
    cardName: string;
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }[],
  profileCards: SiteRuleSet["cards"] = []
): ActiveSiteState["cards"] {
  const cards = new Map<string, ActiveSiteState["cards"][number]>();

  for (const profileCard of profileCards) {
    cards.set(profileCard.id, {
      cardId: profileCard.id,
      cardName: profileCard.name,
      createdAt: profileCard.createdAt,
      enabled: profileCard.enabled,
      frameScopes: [],
      ruleCount: 0,
      rules: []
    });
  }

  for (const rule of rules) {
    const current = cards.get(rule.cardId);
    if (current) {
      current.rules.push(rule);
      current.ruleCount += 1;
      current.cardName = rule.cardName;
      if (!current.frameScopes.includes(rule.frameScope)) {
        current.frameScopes.push(rule.frameScope);
      }
      continue;
    }

    cards.set(rule.cardId, {
      cardId: rule.cardId,
      cardName: rule.cardName,
      createdAt: rule.createdAt,
      enabled: true,
      frameScopes: [rule.frameScope],
      ruleCount: 1,
      rules: [rule]
    });
  }

  return Array.from(cards.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function emptySiteRuleSet(): SiteRuleSet {
  return {
    cards: [],
    id: generateId(),
    matchers: [],
    name: "새 프로필",
    enabled: true,
    rules: [],
    updatedAt: new Date(0).toISOString()
  };
}

function emptyStore(): RuleStore {
  return {
    version: STORAGE_VERSION,
    settings: {
      globalEnabled: true
    },
    profiles: []
  };
}

function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function hostnameMatcher(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

function matcherToRegExp(matcher: string): RegExp {
  const escaped = matcher.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesUrl(matcher: string, url: string): boolean {
  return matcherToRegExp(matcher).test(url);
}

function ownerPageUrl(): string {
  if (window.top === window) {
    return window.location.href;
  }

  return document.referrer || window.location.href;
}

function currentFrameScope(): string | null {
  if (window.top === window) {
    return null;
  }

  return `${window.location.origin}${window.location.pathname}`;
}

function currentFrameLabel(): string {
  const frameScope = currentFrameScope();
  return frameScope ? `iframe 안 선택 중: ${frameScope}` : "메인 문서에서 선택 중";
}

function updatePickerFocusState(focused: boolean, label: string): void {
  void chrome.runtime.sendMessage({
    type: messageTypes.updatePickerFocus,
    focused,
    frameScope: currentFrameScope(),
    label
  }).catch(() => {
    // Ignore focus reporting failures.
  });
}

function iframeAccessMode(iframeElement: HTMLIFrameElement): "same-origin" | "cross-origin" | "unknown" {
  try {
    void iframeElement.contentDocument?.body;
    return iframeElement.contentWindow ? "same-origin" : "unknown";
  } catch {
    return "cross-origin";
  }
}

function normalizeCard(rawCard: unknown): SiteRuleSet["cards"][number] | null {
  if (!rawCard || typeof rawCard !== "object") {
    return null;
  }

  const createdAtValue: unknown = Reflect.get(rawCard, "createdAt");
  const enabledValue: unknown = Reflect.get(rawCard, "enabled");
  const idValue: unknown = Reflect.get(rawCard, "id");
  const nameValue: unknown = Reflect.get(rawCard, "name");
  const updatedAtValue: unknown = Reflect.get(rawCard, "updatedAt");
  const createdAt = typeof createdAtValue === "string" ? createdAtValue : new Date(0).toISOString();

  return {
    createdAt,
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    id: typeof idValue === "string" && idValue.length > 0 ? idValue : generateId(),
    name: typeof nameValue === "string" && nameValue.length > 0 ? nameValue : "기본 카드",
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : createdAt
  };
}

function deriveCardsFromRules(rules: SiteRuleSet["rules"]): SiteRuleSet["cards"] {
  const cards = new Map<string, SiteRuleSet["cards"][number]>();

  for (const rule of rules) {
    if (cards.has(rule.cardId)) {
      continue;
    }

    cards.set(rule.cardId, createProfileCard(rule.cardId, rule.cardName, rule.createdAt));
  }

  return Array.from(cards.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function reconcileProfileCards(
  rules: SiteRuleSet["rules"],
  cards: SiteRuleSet["cards"]
): { cards: SiteRuleSet["cards"]; rules: SiteRuleSet["rules"] } {
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const nextRules = rules.map((rule) => {
    const card = cardMap.get(rule.cardId);
    if (card) {
      return {
        ...rule,
        cardName: card.name
      };
    }

    const fallbackCard = createProfileCard(rule.cardId, rule.cardName, rule.createdAt);
    cardMap.set(fallbackCard.id, fallbackCard);
    return {
      ...rule,
      cardName: fallbackCard.name
    };
  });

  return {
    cards: Array.from(cardMap.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    rules: nextRules
  };
}

function normalizeSiteRuleSet(rawSiteRules: unknown): SiteRuleSet {
  const partialSiteRules =
    rawSiteRules && typeof rawSiteRules === "object"
      ? rawSiteRules
      : {};

  const enabledValue: unknown = Reflect.get(partialSiteRules, "enabled");
  const cardsValue: unknown = Reflect.get(partialSiteRules, "cards");
  const idValue: unknown = Reflect.get(partialSiteRules, "id");
  const matchersValue: unknown = Reflect.get(partialSiteRules, "matchers");
  const nameValue: unknown = Reflect.get(partialSiteRules, "name");
  const rulesValue: unknown = Reflect.get(partialSiteRules, "rules");
  const selectorsValue: unknown = Reflect.get(partialSiteRules, "selectors");
  const updatedAtValue: unknown = Reflect.get(partialSiteRules, "updatedAt");

  const rawRules: unknown[] = Array.isArray(rulesValue)
    ? rulesValue
    : Array.isArray(selectorsValue)
      ? selectorsValue.map((selector: unknown) => ({
        createdAt: new Date(0).toISOString(),
        frameScope: null,
        selector
      }))
      : [];

  const rules = rawRules
    .map((rule) => {
      if (typeof rule === "string") {
        return {
          cardId: generateId(),
          cardName: "기본 카드",
          createdAt: new Date(0).toISOString(),
          frameScope: null,
          selector: rule
        };
      }

      if (!rule || typeof rule !== "object") {
        return null;
      }

      const candidate = rule as {
        cardId?: unknown;
        cardName?: unknown;
        createdAt?: unknown;
        frameScope?: unknown;
        selector?: unknown;
      };

      if (typeof candidate.selector !== "string") {
        return null;
      }

      return {
        cardId: typeof candidate.cardId === "string" ? candidate.cardId : generateId(),
        cardName: typeof candidate.cardName === "string" && candidate.cardName.length > 0 ? candidate.cardName : "기본 카드",
        createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
        frameScope: typeof candidate.frameScope === "string" ? candidate.frameScope : null,
        selector: candidate.selector
      };
    })
    .filter((rule): rule is SiteRuleSet["rules"][number] => rule !== null);
  const rawCards = Array.isArray(cardsValue)
    ? cardsValue.map(normalizeCard).filter((card): card is SiteRuleSet["cards"][number] => card !== null)
    : deriveCardsFromRules(rules);
  const reconciled = reconcileProfileCards(rules, rawCards);

  return {
    cards: reconciled.cards,
    id: typeof idValue === "string" && idValue.length > 0 ? idValue : generateId(),
    matchers: Array.isArray(matchersValue)
      ? matchersValue.filter((matcher): matcher is string => typeof matcher === "string" && matcher.length > 0)
      : [],
    name: typeof nameValue === "string" && nameValue.length > 0 ? nameValue : "이름 없는 프로필",
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    rules: reconciled.rules,
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : new Date(0).toISOString()
  };
}

function normalizeStore(candidate: unknown): RuleStore {
  if (!candidate || typeof candidate !== "object") {
    return emptyStore();
  }

  const partialStore = candidate as {
    profiles?: unknown;
    settings?: unknown;
    sites?: unknown;
    version?: number;
  };
  const profilesValue: unknown = Reflect.get(partialStore, "profiles");

  const rawSites =
    partialStore.sites && typeof partialStore.sites === "object"
      ? partialStore.sites
      : {};

  const profiles = Array.isArray(profilesValue)
    ? profilesValue.map((profile) => normalizeSiteRuleSet(profile))
    : [];

  if (partialStore.version === 4 || partialStore.version === 3) {
    return {
      version: STORAGE_VERSION,
      settings: {
        globalEnabled:
          partialStore.settings &&
          typeof partialStore.settings === "object" &&
          "globalEnabled" in partialStore.settings &&
          typeof partialStore.settings.globalEnabled === "boolean"
            ? partialStore.settings.globalEnabled
            : true
      },
      profiles
    };
  }

  const migratedProfiles: SiteRuleSet[] = [];
  for (const [hostname, rawSiteRules] of Object.entries(rawSites)) {
    const normalized = normalizeSiteRuleSet(rawSiteRules);
    migratedProfiles.push({
      ...normalized,
      matchers: [hostnameMatcher(`https://${hostname}/`)],
      name: hostname
    });
  }

  if (partialStore.version !== 1 && partialStore.version !== 2) {
    return emptyStore();
  }

  return {
    version: STORAGE_VERSION,
    settings: {
      globalEnabled:
        partialStore.settings &&
        typeof partialStore.settings === "object" &&
        "globalEnabled" in partialStore.settings &&
        typeof partialStore.settings.globalEnabled === "boolean"
          ? partialStore.settings.globalEnabled
          : true
    },
    profiles: migratedProfiles
  };
}

async function readStore(): Promise<RuleStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const candidate: unknown = result[STORAGE_KEY];
  return normalizeStore(candidate);
}

async function writeStore(store: RuleStore): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: store
  });
}

function findMatchingProfile(store: RuleStore, url: string): SiteRuleSet | null {
  return store.profiles.find((profile) => profile.matchers.some((matcher) => matchesUrl(matcher, url))) ?? null;
}

async function ensureProfileForUrl(url: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const existing = findMatchingProfile(store, url);
  if (existing) {
    return existing;
  }

  const profile: SiteRuleSet = {
    ...emptySiteRuleSet(),
    matchers: [hostnameMatcher(url)],
    name: hostnameFromUrl(url),
    updatedAt: new Date().toISOString()
  };

  store.profiles.push(profile);
  await writeStore(store);
  return profile;
}

async function addSiteRule(
  url: string,
  selector: string,
  frameScope: string | null,
  card: { cardId: string; cardName: string }
): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = findMatchingProfile(store, url) ?? (await ensureProfileForUrl(url));
  const refreshedStore = await readStore();
  const profile = refreshedStore.profiles.find((item) => item.id === current.id) ?? current;
  const existingCard = profile.cards.find((item) => item.id === card.cardId);
  const nextRule = {
    cardId: card.cardId,
    cardName: existingCard?.name ?? card.cardName,
    createdAt: new Date().toISOString(),
    frameScope,
    selector
  };
  const next: SiteRuleSet = {
    ...profile,
    cards: existingCard
      ? profile.cards
      : [...profile.cards, createProfileCard(card.cardId, card.cardName, nextRule.createdAt)],
    enabled: true,
    rules: profile.rules.some((rule) =>
      rule.selector === selector &&
      rule.frameScope === frameScope &&
      rule.cardId === card.cardId
    )
      ? profile.rules
      : [...profile.rules, nextRule],
    updatedAt: new Date().toISOString()
  };

  refreshedStore.profiles = refreshedStore.profiles.map((item) => (item.id === profile.id ? next : item));
  await writeStore(refreshedStore);
  return next;
}

async function removeSiteRule(
  profileId: string,
  targetRule: {
    cardId: string;
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }
): Promise<SiteRuleSet | null> {
  const store = await readStore();
  const current = store.profiles.find((item) => item.id === profileId);
  if (!current) {
    return null;
  }
  const remainingRules = current.rules.filter((rule) => !isSameStoredRule(rule, targetRule));
  const remainingCardIds = new Set(remainingRules.map((rule) => rule.cardId));
  const next: SiteRuleSet = {
    ...current,
    cards: current.cards.filter((card) => remainingCardIds.has(card.id)),
    rules: remainingRules,
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profileId ? next : item));
  await writeStore(store);
  return next;
}

async function clearSiteRules(profileId: string): Promise<SiteRuleSet | null> {
  const store = await readStore();
  const current = store.profiles.find((item) => item.id === profileId);
  if (!current) {
    return null;
  }
  const next: SiteRuleSet = {
    ...current,
    cards: [],
    rules: [],
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profileId ? next : item));
  await writeStore(store);
  return next;
}

async function setSiteEnabled(profileId: string, enabled: boolean): Promise<SiteRuleSet | null> {
  const store = await readStore();
  const current = store.profiles.find((item) => item.id === profileId);
  if (!current) {
    return null;
  }
  const next: SiteRuleSet = {
    ...current,
    enabled,
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profileId ? next : item));
  await writeStore(store);
  return next;
}

async function setGlobalEnabled(globalEnabled: boolean): Promise<RuleStore> {
  const store = await readStore();
  const next: RuleStore = {
    ...store,
    settings: {
      globalEnabled
    }
  };

  await writeStore(next);
  return next;
}

async function readActiveSiteState(url: string): Promise<ActiveSiteState> {
  const store = await readStore();
  const profile = findMatchingProfile(store, url);
  const rules = profile?.rules ? [...profile.rules] : [];
  const cards = groupRulesByCard(rules, profile?.cards ?? []);
  const enabledRules = cards
    .filter((card) => card.enabled)
    .flatMap((card) => card.rules);

  return {
    activeProfileId: profile?.id ?? null,
    activeProfileName: profile?.name ?? null,
    cardCount: cards.length,
    cards,
    enabledSelectorCount: enabledRules.length,
    globalEnabled: store.settings.globalEnabled,
    hostname: hostnameFromUrl(url),
    matchers: profile?.matchers ?? [],
    profileEnabled: profile?.enabled ?? true,
    rules,
    selectorCount: rules.length,
    updatedAt: profile?.updatedAt ?? new Date(0).toISOString(),
    url
  };
}

function escapeSelector(value: string): string {
  return CSS.escape(value);
}

function isUniqueSelector(selector: string, root: Document = document): boolean {
  return root.querySelectorAll(selector).length === 1;
}

function maybeStableClassName(className: string): boolean {
  if (!/^[a-z][a-z0-9_-]{1,40}$/i.test(className)) {
    return false;
  }

  const digitCount = className.replace(/\D/g, "").length;
  return digitCount <= 3;
}

function stableClasses(element: Element): string[] {
  return Array.from(element.classList).filter(maybeStableClassName).slice(0, 3);
}

function attributeSelectors(element: Element): string[] {
  const stableAttributes = ["data-testid", "data-test", "data-qa", "aria-label", "title", "alt"];
  const selectors: string[] = [];

  for (const attribute of stableAttributes) {
    const value = element.getAttribute(attribute);
    if (value && value.length <= 80) {
      selectors.push(`${element.localName}[${attribute}="${escapeSelector(value)}"]`);
      selectors.push(`[${attribute}="${escapeSelector(value)}"]`);
    }
  }

  return selectors;
}

function nthOfTypeSelector(element: Element): string {
  const parent = element.parentElement;
  if (!parent) {
    return element.localName;
  }

  const siblings = Array.from(parent.children).filter((child) => child.localName === element.localName);
  const index = siblings.indexOf(element) + 1;
  return `${element.localName}:nth-of-type(${index})`;
}

function classSelectors(element: Element): string[] {
  const classes = stableClasses(element);
  const selectors: string[] = [];

  for (let size = 1; size <= classes.length; size += 1) {
    const joined = classes.slice(0, size).map((className) => `.${escapeSelector(className)}`).join("");
    selectors.push(`${element.localName}${joined}`);
    selectors.push(joined);
  }

  return selectors;
}

function simpleCandidates(element: Element, options?: { allowNth?: boolean }): string[] {
  const selectors: string[] = [];
  const id = element.getAttribute("id");

  if (id) {
    selectors.push(`#${escapeSelector(id)}`);
    selectors.push(`${element.localName}#${escapeSelector(id)}`);
  }

  selectors.push(...attributeSelectors(element));
  selectors.push(...classSelectors(element));
  selectors.push(element.localName);

  if (options?.allowNth) {
    selectors.push(nthOfTypeSelector(element));
  }

  return Array.from(new Set(selectors));
}

function isUniqueAmongSiblings(element: Element, segment: string): boolean {
  const parent = element.parentElement;
  if (!parent) {
    return true;
  }

  try {
    return parent.querySelectorAll(`:scope > ${segment}`).length === 1;
  } catch {
    return false;
  }
}

function preferredExactSegmentSelector(element: Element): string {
  const candidates = simpleCandidates(element, { allowNth: false })
    .filter((candidate) => !isBareTagSelector(candidate))
    .sort((left, right) => selectorSpecificityScore(right) - selectorSpecificityScore(left));

  for (const candidate of candidates) {
    if (isUniqueAmongSiblings(element, candidate)) {
      return candidate;
    }
  }

  return nthOfTypeSelector(element);
}

function buildForcedUniqueSelector(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    segments.unshift(preferredExactSegmentSelector(current));
    const selector = segments.join(" > ");
    if (isUniqueSelector(selector)) {
      return selector;
    }
    current = current.parentElement;
  }

  return segments.join(" > ");
}

function buildGroupSelectorCandidates(element: Element): string[] {
  return simpleCandidates(element, { allowNth: false })
    .filter((candidate) => !isBareTagSelector(candidate))
    .sort((left, right) => selectorSpecificityScore(right) - selectorSpecificityScore(left))
    .filter((candidate) => {
      const assessment = selectorAssessment(candidate);
      return assessment.applyAllowed && (assessment.matches ?? 0) > 1;
    });
}

function pathSelector(ancestor: Element, target: Element): string {
  const segments: string[] = [];
  let current: Element | null = target;

  while (current && current !== ancestor) {
    segments.unshift(preferredSegmentSelector(current));
    current = current.parentElement;
  }

  const anchor = simpleCandidates(ancestor, { allowNth: true })
    .filter((candidate) => !isBareTagSelector(candidate))
    .find((candidate) => isUniqueSelector(candidate))
    ?? nthOfTypeSelector(ancestor);

  return [anchor, ...segments].join(" > ");
}

function buildSelectorCandidates(element: Element): string[] {
  const seen = new Set<string>();
  const selectors: string[] = [];

  const pushIfUseful = (selector: string): void => {
    if (!selector || seen.has(selector)) {
      return;
    }

    seen.add(selector);
    selectors.push(selector);
  };

  pushIfUseful(buildForcedUniqueSelector(element));

  const directCandidates = simpleCandidates(element, { allowNth: true }).sort(
    (left, right) => selectorSpecificityScore(right) - selectorSpecificityScore(left)
  );

  for (const selector of directCandidates) {
    if (isUniqueSelector(selector)) {
      pushIfUseful(selector);
    }
  }

  let ancestor = element.parentElement;
  let depth = 0;

  while (ancestor && depth < 4) {
    const selector = pathSelector(ancestor, element);
    pushIfUseful(selector);
    if (isUniqueSelector(selector)) {
      break;
    }

    ancestor = ancestor.parentElement;
    depth += 1;
  }

  for (const groupSelector of buildGroupSelectorCandidates(element)) {
    pushIfUseful(groupSelector);
  }

  if (selectors.length === 0) {
    pushIfUseful(pathSelector(element.parentElement ?? element, element));
    pushIfUseful(nthOfTypeSelector(element));
  }

  return selectors;
}

function buildSelector(element: Element): string {
  return buildSelectorCandidates(element)[0] ?? element.localName;
}

function selectorCss(selectors: string[]): string {
  return selectors.map((selector) => `${selector} { display: none !important; }`).join("\n");
}

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) {
    return existing;
  }

  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  document.documentElement.append(style);
  return style;
}

async function renderRules(): Promise<void> {
  const activeSiteState = await readActiveSiteState(ownerPageUrl());
  const style = ensureStyleElement();
  const frameScope = currentFrameScope();

  if (!activeSiteState.globalEnabled || !activeSiteState.profileEnabled) {
    style.textContent = "";
    return;
  }

  style.textContent = selectorCss(
    activeSiteState.cards
      .filter((card) => card.enabled)
      .flatMap((card) => card.rules)
      .filter((rule) => rule.frameScope === frameScope)
      .map((rule) => rule.selector)
  );
}

function removePickerArtifacts(): void {
  document.getElementById(PICKER_OVERLAY_ID)?.remove();
  document.getElementById(`${PICKER_OVERLAY_ID}-label`)?.remove();
  document.getElementById(PICKER_STATUS_BADGE_ID)?.remove();
  document.getElementById(PICKER_PREVIEW_PANEL_ID)?.remove();
  document.getElementById(PICKER_PREVIEW_STYLE_ID)?.remove();
  document.getElementById(PICKER_SESSION_OVERLAY_ID)?.remove();
  document.documentElement.style.cursor = "";
}

function buildOverlay(): HTMLDivElement {
  removePickerArtifacts();
  const overlay = document.createElement("div");
  overlay.id = PICKER_OVERLAY_ID;
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.pointerEvents = "auto";
  overlay.style.zIndex = "2147483645";
  overlay.style.transition = "all 80ms ease-out";
  document.documentElement.append(overlay);
  return overlay;
}

function buildPickerLabel(): HTMLDivElement {
  const label = document.createElement("div");
  label.id = `${PICKER_OVERLAY_ID}-label`;
  label.style.position = "fixed";
  label.style.right = "16px";
  label.style.bottom = "16px";
  label.style.padding = "10px 12px";
  label.style.background = "#231f17";
  label.style.color = "#f7f4eb";
  label.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';
  label.style.zIndex = "2147483647";
  label.style.pointerEvents = "none";
  label.textContent = `인포커터 선택 모드: ${currentFrameLabel()} / 숨길 요소를 클릭하거나 Escape로 취소하세요.`;
  document.documentElement.append(label);
  return label;
}

function setPickerLabelText(text: string): void {
  const label = document.getElementById(`${PICKER_OVERLAY_ID}-label`);
  if (label instanceof HTMLDivElement) {
    label.textContent = text;
  }
}

function setPickerStatusBadge(label: string, tone: string): void {
  let badge = document.getElementById(PICKER_STATUS_BADGE_ID);
  if (!(badge instanceof HTMLDivElement)) {
    badge = document.createElement("div");
    badge.id = PICKER_STATUS_BADGE_ID;
    badge.style.position = "fixed";
    badge.style.right = "16px";
    badge.style.bottom = "116px";
    badge.style.padding = "8px 10px";
    badge.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';
    badge.style.zIndex = "2147483647";
    badge.style.pointerEvents = "none";
    badge.style.border = "1px solid rgba(255,255,255,0.2)";
    badge.style.boxShadow = "0 8px 20px rgba(0,0,0,0.18)";
    document.documentElement.append(badge);
  }

  badge.textContent = label;
  badge.style.background = tone;
  badge.style.color = "#231f17";
}

function matchCountForSelector(selector: string): number | null {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return null;
  }
}

function selectorRects(selector: string): DOMRect[] {
  try {
    return Array.from(document.querySelectorAll(selector))
      .filter((element): element is Element => element instanceof Element)
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 || rect.height > 0);
  } catch {
    return [];
  }
}

function setOverlayRects(overlay: HTMLDivElement, rects: DOMRect[], tone: "hover" | "preview" = "hover"): void {
  overlay.replaceChildren();
  overlay.style.opacity = rects.length > 0 ? "1" : "0";

  const palette = tone === "preview"
    ? {
        background: "rgba(59, 130, 246, 0.14)",
        border: "2px solid rgba(59, 130, 246, 0.95)"
      }
    : {
        background: "rgba(217, 119, 6, 0.12)",
        border: "2px solid rgba(217, 119, 6, 0.95)"
      };

  for (const rect of rects) {
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.style.pointerEvents = "none";
    box.style.background = palette.background;
    box.style.border = palette.border;
    box.style.boxSizing = "border-box";
    box.style.borderRadius = "2px";
    overlay.append(box);
  }
}

function ensureSessionOverlayRoot(): HTMLDivElement {
  const existingOverlay = document.getElementById(PICKER_SESSION_OVERLAY_ID);
  if (existingOverlay instanceof HTMLDivElement) {
    return existingOverlay;
  }

  const overlay = document.createElement("div");
  overlay.id = PICKER_SESSION_OVERLAY_ID;
  overlay.style.position = "fixed";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "2147483646";
  document.documentElement.append(overlay);
  return overlay;
}

function isBareTagSelector(selector: string): boolean {
  return /^[a-z][a-z0-9-]*$/i.test(selector);
}

function selectorSpecificityScore(selector: string): number {
  let score = 0;
  if (selector.includes("#")) {
    score += 6;
  }
  if (selector.includes("[")) {
    score += 4;
  }
  if (selector.includes(".")) {
    score += 3;
  }
  if (selector.includes(":nth-of-type")) {
    score -= 2;
  }
  if (selector.includes(">")) {
    score += 2;
  }
  if (isBareTagSelector(selector)) {
    score -= 6;
  }
  return score;
}

function selectorAssessment(selector: string): {
  applyAllowed: boolean;
  label: string;
  matches: number | null;
  tone: string;
} {
  const matches = matchCountForSelector(selector);

  if (matches === null) {
    return {
      applyAllowed: false,
      label: "잘못된 선택자",
      matches,
      tone: "#fca5a5"
    };
  }

  if (matches === 1) {
    return {
      applyAllowed: true,
      label: "단일 요소",
      matches,
      tone: "#86efac"
    };
  }

  if (isBareTagSelector(selector)) {
    return {
      applyAllowed: matches <= 3,
      label: matches <= 3 ? "넓은 태그 선택자" : "위험한 태그 선택자",
      matches,
      tone: matches <= 3 ? "#fde68a" : "#fca5a5"
    };
  }

  if (matches <= 12) {
    return {
      applyAllowed: true,
      label: "그룹 선택",
      matches,
      tone: "#93c5fd"
    };
  }

  return {
    applyAllowed: false,
    label: "너무 넓은 선택자",
    matches,
    tone: "#fca5a5"
  };
}

function applyPreviewSelector(selector: string): boolean {
  let style = document.getElementById(PICKER_PREVIEW_STYLE_ID);
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement("style");
    style.id = PICKER_PREVIEW_STYLE_ID;
    document.documentElement.append(style);
  }

  if (matchCountForSelector(selector) === null) {
    style.textContent = "";
    return false;
  }

  style.textContent = `
    ${selector} {
      outline: 2px solid rgba(59, 130, 246, 0.95) !important;
      outline-offset: -1px !important;
      background: rgba(59, 130, 246, 0.10) !important;
      box-shadow: inset 0 0 0 9999px rgba(59, 130, 246, 0.08) !important;
    }
  `;
  return true;
}

function applySelectionSessionHighlights(): void {
  const overlay = ensureSessionOverlayRoot();
  overlay.replaceChildren();

  if (selectionSession.length === 0) {
    overlay.style.opacity = "0";
    return;
  }

  overlay.style.opacity = "1";

  for (const [index, card] of selectionSession.entries()) {
    const palette = selectionSessionPalette[index % selectionSessionPalette.length] ?? selectionSessionPalette[0];
    const rects = selectorRects(card.selector);
    for (const [rectIndex, rect] of rects.entries()) {
      const box = document.createElement("div");
      box.style.position = "fixed";
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.style.pointerEvents = "none";
      box.style.background = palette.fill;
      box.style.border = `2px solid ${palette.stroke}`;
      box.style.boxSizing = "border-box";
      box.style.borderRadius = "2px";
      overlay.append(box);

      if (rectIndex === 0) {
        const badge = document.createElement("div");
        badge.textContent = card.cardName;
        badge.style.position = "fixed";
        badge.style.left = `${Math.max(8, rect.left)}px`;
        badge.style.top = `${Math.max(8, rect.top - 22)}px`;
        badge.style.padding = "2px 6px";
        badge.style.background = palette.stroke;
        badge.style.color = "#fff";
        badge.style.font = '11px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';
        badge.style.borderRadius = "999px";
        badge.style.boxShadow = "0 4px 12px rgba(0,0,0,0.18)";
        overlay.append(badge);
      }
    }
  }
}

function buildHoverSummary(element: Element): {
  assessment: ReturnType<typeof selectorAssessment> | null;
  label: string;
  selector: string | null;
} {
  const selector = buildSelectorCandidates(element)[0] ?? null;
  if (selector) {
    const assessment = selectorAssessment(selector);
    if (assessment.matches !== null) {
      const selectionLabel = assessment.matches === 1
        ? "현재 요소 하나를 기준으로 선택합니다."
        : `같은 성격의 요소 ${assessment.matches}개가 함께 선택될 수 있습니다.`;
      return {
        assessment,
        label: `인포커터 선택 모드: ${currentFrameLabel()} / ${selectionLabel} 상태: ${assessment.label}`,
        selector
      };
    }
  }

  return {
    assessment: null,
    label: `인포커터 선택 모드: ${currentFrameLabel()} / 범위가 넓을 수 있어 클릭 후 미리보기에서 다시 조정하세요.`,
    selector: null
  };
}

function isExtensionUiElement(element: Element): boolean {
  const id = element.getAttribute("id");
  return typeof id === "string" && id.startsWith("infocutter-");
}

function candidateTargetScore(element: Element, stackIndex: number): number {
  const selector = buildSelectorCandidates(element)[0] ?? buildSelector(element);
  const assessment = selectorAssessment(selector);
  const rect = element.getBoundingClientRect();
  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  const rectArea = rect.width * rect.height;
  const areaRatio = rectArea / viewportArea;
  const areaScore = Math.min(rectArea / 500, 16);
  const stackBonus = Math.max(0, 28 - stackIndex * 6);
  const applyBonus = assessment.applyAllowed ? 50 : 0;
  const matchPenalty = assessment.matches === null ? 20 : Math.min(assessment.matches, 20);
  const interactiveBonus = element.closest("button, a, input, textarea, select, option, label, [role='button'], [role='link']") ? 22 : 0;
  const tinyPenalty = rect.width < 24 || rect.height < 18 ? 8 : 0;
  const containerPenalty =
    areaRatio > 0.45
      ? 80
      : areaRatio > 0.25
        ? 36
        : areaRatio > 0.12
          ? 14
          : 0;
  const oversizedBlockPenalty =
    rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.22
      ? 24
      : 0;

  return (
    applyBonus +
    selectorSpecificityScore(selector) +
    areaScore +
    stackBonus +
    interactiveBonus -
    matchPenalty -
    tinyPenalty -
    containerPenalty -
    oversizedBlockPenalty
  );
}

function preferredSegmentSelector(element: Element): string {
  const candidates = simpleCandidates(element, { allowNth: false })
    .filter((candidate) => !isBareTagSelector(candidate))
    .sort((left, right) => selectorSpecificityScore(right) - selectorSpecificityScore(left));
  if (candidates.length > 0) {
    return candidates[0] ?? element.localName;
  }

  return nthOfTypeSelector(element);
}

function buildDepthChain(element: Element, maxDepth = 4): Element[] {
  const chain: Element[] = [element];
  let current = element.parentElement;
  let depth = 0;

  while (current && current !== document.documentElement && depth < maxDepth) {
    chain.push(current);
    current = current.parentElement;
    depth += 1;
  }

  return chain;
}

function depthLabel(depthIndex: number): string {
  if (depthIndex === 0) {
    return "현재 요소";
  }

  return `부모 ${depthIndex}단계`;
}

function elementShortLabel(element: Element): string {
  const id = element.getAttribute("id");
  if (id) {
    return `${element.localName}#${id}`;
  }

  const firstClass = Array.from(element.classList).find((className) => maybeStableClassName(className));
  if (firstClass) {
    return `${element.localName}.${firstClass}`;
  }

  return element.localName;
}

function hoverCandidatePreview(element: Element): {
  assessment: ReturnType<typeof selectorAssessment> | null;
  label: string;
  selector: string | null;
} {
  const selector = buildSelectorCandidates(element)[0] ?? null;
  if (!selector) {
    return {
      assessment: null,
      label: elementShortLabel(element),
      selector: null
    };
  }

  const assessment = selectorAssessment(selector);
  return {
    assessment: assessment.matches === null ? null : assessment,
    label: elementShortLabel(element),
    selector
  };
}

function candidateRelationshipLabel(candidate: Element, currentTarget: Element): string {
  if (candidate === currentTarget) {
    return "현재 타깃";
  }

  if (candidate.contains(currentTarget)) {
    return "부모 후보";
  }

  if (currentTarget.contains(candidate)) {
    return "자식 후보";
  }

  return "대체 후보";
}

function candidateKindLabel(element: Element): string {
  if (element.matches("button, [role='button']")) {
    return "버튼";
  }
  if (element.matches("a, [role='link']")) {
    return "링크";
  }
  if (element.matches("input, textarea, select, option")) {
    return "입력";
  }
  if (element.matches("img, picture, svg")) {
    return "미디어";
  }
  if (element.children.length === 0) {
    return "리프";
  }
  return "컨테이너";
}

function buildSessionPanel(onDone: () => void, onCancel: () => void): HTMLDivElement {
  document.getElementById(PICKER_SESSION_PANEL_ID)?.remove();
  applySelectionSessionHighlights();

  const panel = document.createElement("div");
  panel.id = PICKER_SESSION_PANEL_ID;
  panel.style.position = "fixed";
  panel.style.left = "16px";
  panel.style.bottom = "16px";
  panel.style.width = "320px";
  panel.style.maxHeight = "50vh";
  panel.style.overflow = "auto";
  panel.style.padding = "12px";
  panel.style.background = "#231f17";
  panel.style.color = "#f7f4eb";
  panel.style.zIndex = "2147483647";
  panel.style.boxShadow = "0 12px 30px rgba(0,0,0,0.24)";
  panel.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';

  const title = document.createElement("div");
  title.textContent = `선택 세션 카드 ${selectionSession.length}개`;
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "8px";
  list.style.marginBottom = "10px";

  for (const card of selectionSession) {
    const item = document.createElement("div");
    item.style.padding = "8px";
    item.style.background = "rgba(255,255,255,0.08)";
    item.style.border = "1px solid rgba(255,255,255,0.12)";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = card.cardName;
    nameInput.placeholder = "카드 이름";
    nameInput.style.display = "block";
    nameInput.style.width = "100%";
    nameInput.style.boxSizing = "border-box";
    nameInput.style.padding = "8px";
    nameInput.style.background = "rgba(255,255,255,0.08)";
    nameInput.style.color = "#f7f4eb";
    nameInput.style.border = "1px solid rgba(255,255,255,0.18)";
    nameInput.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';
    nameInput.addEventListener("input", () => {
      selectionSession = selectionSession.map((entry) => (
        entry.cardId === card.cardId
          ? {
              ...entry,
              cardName: nameInput.value.trim() || entry.cardName
            }
          : entry
      ));
    });

    const cardId = document.createElement("div");
    cardId.textContent = `카드 ID: ${card.cardId}`;
    cardId.style.color = "#c9ba9c";
    cardId.style.marginTop = "6px";
    cardId.style.wordBreak = "break-all";

    const scope = document.createElement("div");
    scope.textContent = card.frameScope ? `iframe: ${card.frameScope}` : "메인 문서";
    scope.style.color = "#c9ba9c";
    scope.style.marginTop = "4px";

    const selector = document.createElement("code");
    selector.textContent = card.selector;
    selector.style.display = "block";
    selector.style.marginTop = "6px";
    selector.style.whiteSpace = "pre-wrap";
    selector.style.wordBreak = "break-word";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "카드 제거";
    removeButton.style.marginTop = "8px";
    removeButton.style.border = "1px solid #f7f4eb";
    removeButton.style.background = "transparent";
    removeButton.style.color = "#f7f4eb";
    removeButton.style.padding = "6px 8px";
    removeButton.style.cursor = "pointer";
    removeButton.addEventListener("click", () => {
      selectionSession = selectionSession.filter((entry) => entry.cardId !== card.cardId);
      buildSessionPanel(onDone, onCancel);
    });

    item.append(nameInput, cardId, scope, selector, removeButton);
    list.append(item);
  }

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const doneButton = document.createElement("button");
  doneButton.type = "button";
  doneButton.textContent = "완료 적용";
  doneButton.style.flex = "1";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "세션 취소";
  cancelButton.style.flex = "1";

  for (const button of [doneButton, cancelButton]) {
    button.style.border = "1px solid #f7f4eb";
    button.style.background = "transparent";
    button.style.color = "#f7f4eb";
    button.style.padding = "8px 10px";
    button.style.cursor = "pointer";
  }

  doneButton.disabled = selectionSession.length === 0;
  doneButton.addEventListener("click", onDone);
  cancelButton.addEventListener("click", onCancel);

  actions.append(doneButton, cancelButton);
  panel.append(title, list, actions);
  document.documentElement.append(panel);
  return panel;
}

async function persistSelectionSession(): Promise<void> {
  for (const card of selectionSession) {
    await addSiteRule(ownerPageUrl(), card.selector, card.frameScope, {
      cardId: card.cardId,
      cardName: card.cardName
    });
  }

  selectionSession = [];
  applySelectionSessionHighlights();
}

function buildPreviewPanel(
  hoverCandidates: Element[],
  hoverCandidateIndex: number,
  currentTarget: Element,
  depthChain: Element[],
  depthIndex: number,
  depthTotal: number,
  selectorCandidates: string[],
  selectorCandidateIndex: number,
  selector: string,
  defaultCardName: string,
  onSelectHoverCandidate: (nextIndex: number) => void,
  onInspectHoverCandidate: (nextIndex: number | null) => void,
  onSelectSelectorCandidate: (nextIndex: number) => void,
  onAddCard: (selector: string, cardName: string) => void,
  onNarrow: () => void,
  onNext: () => void,
  onWider: () => void,
  onCancel: () => void
): HTMLDivElement {
  document.getElementById(PICKER_PREVIEW_PANEL_ID)?.remove();

  const panel = document.createElement("div");
  panel.id = PICKER_PREVIEW_PANEL_ID;
  panel.style.position = "fixed";
  panel.style.right = "16px";
  panel.style.bottom = "64px";
  panel.style.width = "360px";
  panel.style.padding = "12px";
  panel.style.background = "#231f17";
  panel.style.color = "#f7f4eb";
  panel.style.zIndex = "2147483647";
  panel.style.boxShadow = "0 12px 30px rgba(0,0,0,0.24)";
  panel.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';

  const title = document.createElement("div");
  title.textContent = `미리보기 선택자 ${selectorCandidateIndex + 1}/${selectorCandidates.length}`;
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";

  const meta = document.createElement("div");
  meta.textContent = `${depthLabel(depthIndex)} · 현재 선택자를 확인하는 중입니다.`;
  meta.style.marginBottom = "8px";
  meta.style.color = "#f5d6b0";

  const depthMeta = document.createElement("div");
  depthMeta.textContent = `범위 단계 ${depthIndex + 1}/${depthTotal}`;
  depthMeta.style.marginBottom = "8px";
  depthMeta.style.color = "#c9ba9c";

  const candidateSection = document.createElement("div");
  candidateSection.style.marginBottom = "10px";

  const candidateTitle = document.createElement("div");
  candidateTitle.textContent = `포인터 후보 ${hoverCandidateIndex + 1}/${hoverCandidates.length}`;
  candidateTitle.style.fontWeight = "700";
  candidateTitle.style.marginBottom = "6px";

  const candidateGuide = document.createElement("div");
  candidateGuide.textContent = "클릭 순간의 후보 스택입니다. 원하는 오브젝트를 눌러 고정하세요.";
  candidateGuide.style.marginBottom = "8px";
  candidateGuide.style.color = "#c9ba9c";
  candidateGuide.style.lineHeight = "1.45";

  const candidateList = document.createElement("div");
  candidateList.style.display = "grid";
  candidateList.style.gap = "6px";
  candidateList.style.maxHeight = "190px";
  candidateList.style.overflow = "auto";

  const candidateSections = [
    { label: "현재 타깃", match: (candidate: Element) => candidate === currentTarget },
    { label: "자식 후보", match: (candidate: Element) => currentTarget.contains(candidate) && candidate !== currentTarget },
    { label: "부모 후보", match: (candidate: Element) => candidate.contains(currentTarget) && candidate !== currentTarget },
    { label: "대체 후보", match: (candidate: Element) => candidateRelationshipLabel(candidate, currentTarget) === "대체 후보" }
  ] as const;

  const createCandidateButton = (candidateElement: Element, candidateStackIndex: number): HTMLButtonElement => {
    const candidatePreview = hoverCandidatePreview(candidateElement);
    const candidateAssessment = candidatePreview.assessment;
    const palette = selectionSessionPalette[candidateStackIndex % selectionSessionPalette.length] ?? selectionSessionPalette[0];

    const candidateButton = document.createElement("button");
    candidateButton.type = "button";
    candidateButton.style.display = "grid";
    candidateButton.style.gridTemplateColumns = "12px 1fr";
    candidateButton.style.gap = "8px";
    candidateButton.style.alignItems = "start";
    candidateButton.style.width = "100%";
    candidateButton.style.padding = "8px";
    candidateButton.style.border = candidateStackIndex === hoverCandidateIndex
      ? `1px solid ${palette.stroke}`
      : "1px solid rgba(255,255,255,0.18)";
    candidateButton.style.background = candidateStackIndex === hoverCandidateIndex
      ? "rgba(255,255,255,0.10)"
      : "rgba(255,255,255,0.05)";
    candidateButton.style.color = "#f7f4eb";
    candidateButton.style.cursor = "pointer";
    candidateButton.style.textAlign = "left";

    const swatch = document.createElement("span");
    swatch.style.display = "block";
    swatch.style.width = "12px";
    swatch.style.height = "12px";
    swatch.style.borderRadius = "999px";
    swatch.style.marginTop = "2px";
    swatch.style.background = palette.stroke;

    const candidateCopy = document.createElement("div");

    const candidateName = document.createElement("div");
    candidateName.textContent = `${candidateStackIndex + 1}. ${candidatePreview.label}`;
    candidateName.style.fontWeight = "700";
    candidateName.style.marginBottom = "3px";

    const candidateBadgeRow = document.createElement("div");
    candidateBadgeRow.style.display = "flex";
    candidateBadgeRow.style.flexWrap = "wrap";
    candidateBadgeRow.style.gap = "4px";
    candidateBadgeRow.style.marginBottom = "4px";

    const relationshipBadge = document.createElement("span");
    relationshipBadge.textContent = candidateRelationshipLabel(candidateElement, currentTarget);
    relationshipBadge.style.padding = "1px 6px";
    relationshipBadge.style.borderRadius = "999px";
    relationshipBadge.style.background = "rgba(255,255,255,0.10)";
    relationshipBadge.style.color = "#fff7ed";

    const kindBadge = document.createElement("span");
    kindBadge.textContent = candidateKindLabel(candidateElement);
    kindBadge.style.padding = "1px 6px";
    kindBadge.style.borderRadius = "999px";
    kindBadge.style.background = "rgba(255,255,255,0.08)";
    kindBadge.style.color = "#f7f4eb";

    if (candidateStackIndex === hoverCandidateIndex) {
      const currentBadge = document.createElement("span");
      currentBadge.textContent = "사용 중";
      currentBadge.style.padding = "1px 6px";
      currentBadge.style.borderRadius = "999px";
      currentBadge.style.background = palette.stroke;
      currentBadge.style.color = "#fff";
      candidateBadgeRow.append(currentBadge);
    }

    candidateBadgeRow.append(relationshipBadge, kindBadge);

    const candidateMeta = document.createElement("div");
    candidateMeta.style.color = candidateAssessment?.tone ?? "#c9ba9c";
    candidateMeta.style.lineHeight = "1.35";
    candidateMeta.textContent = candidateAssessment
      ? `${candidateAssessment.label} · ${candidateAssessment.matches ?? 0}개`
      : "후보 상태를 확인하지 못했습니다.";

    const candidateSelector = document.createElement("code");
    candidateSelector.textContent = candidatePreview.selector ?? "선택자 없음";
    candidateSelector.style.display = "block";
    candidateSelector.style.marginTop = "4px";
    candidateSelector.style.whiteSpace = "pre-wrap";
    candidateSelector.style.wordBreak = "break-word";
    candidateSelector.style.opacity = "0.9";

    candidateCopy.append(candidateName, candidateBadgeRow, candidateMeta, candidateSelector);
    candidateButton.append(swatch, candidateCopy);
    candidateButton.addEventListener("click", () => {
      onSelectHoverCandidate(candidateStackIndex);
    });
    candidateButton.addEventListener("mouseenter", () => {
      onInspectHoverCandidate(candidateStackIndex);
    });
    candidateButton.addEventListener("mouseleave", () => {
      onInspectHoverCandidate(null);
    });
    return candidateButton;
  };

  for (const section of candidateSections) {
    const sectionCandidates = hoverCandidates
      .map((candidateElement, candidateStackIndex) => ({ candidateElement, candidateStackIndex }))
      .filter(({ candidateElement }) => section.match(candidateElement));

    if (sectionCandidates.length === 0) {
      continue;
    }

    const sectionTitle = document.createElement("div");
    sectionTitle.textContent = `${section.label} ${sectionCandidates.length}개`;
    sectionTitle.style.marginTop = "4px";
    sectionTitle.style.marginBottom = "4px";
    sectionTitle.style.fontWeight = "700";
    sectionTitle.style.color = "#f5d6b0";
    candidateList.append(sectionTitle);

    for (const { candidateElement, candidateStackIndex } of sectionCandidates) {
      candidateList.append(createCandidateButton(candidateElement, candidateStackIndex));
    }
  }

  candidateSection.append(candidateTitle, candidateGuide, candidateList);

  const breadcrumb = document.createElement("div");
  breadcrumb.style.display = "flex";
  breadcrumb.style.flexWrap = "wrap";
  breadcrumb.style.gap = "6px";
  breadcrumb.style.marginBottom = "8px";

  for (const [index, node] of depthChain.entries()) {
    const chip = document.createElement("span");
    chip.textContent = elementShortLabel(node);
    chip.style.padding = "3px 6px";
    chip.style.border = "1px solid rgba(255,255,255,0.18)";
    chip.style.background = index === depthIndex ? "rgba(217,119,6,0.24)" : "rgba(255,255,255,0.08)";
    chip.style.color = index === depthIndex ? "#fff7ed" : "#f7f4eb";
    breadcrumb.append(chip);
  }

  const qualityMeta = document.createElement("div");
  qualityMeta.style.marginBottom = "8px";
  qualityMeta.style.fontWeight = "700";

  const assistMeta = document.createElement("div");
  assistMeta.style.marginBottom = "8px";
  assistMeta.style.color = "#c9ba9c";
  assistMeta.style.lineHeight = "1.45";

  const cardNameInput = document.createElement("input");
  cardNameInput.type = "text";
  cardNameInput.value = defaultCardName;
  cardNameInput.placeholder = "카드 이름";
  cardNameInput.style.display = "block";
  cardNameInput.style.width = "100%";
  cardNameInput.style.boxSizing = "border-box";
  cardNameInput.style.padding = "10px";
  cardNameInput.style.background = "rgba(255,255,255,0.08)";
  cardNameInput.style.color = "#f7f4eb";
  cardNameInput.style.border = "1px solid rgba(255,255,255,0.18)";
  cardNameInput.style.marginBottom = "10px";
  cardNameInput.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';

  const input = document.createElement("textarea");
  input.value = selector;
  input.style.display = "block";
  input.style.width = "100%";
  input.style.minHeight = "84px";
  input.style.boxSizing = "border-box";
  input.style.whiteSpace = "pre-wrap";
  input.style.wordBreak = "break-word";
  input.style.padding = "10px";
  input.style.background = "rgba(255,255,255,0.08)";
  input.style.color = "#f7f4eb";
  input.style.border = "1px solid rgba(255,255,255,0.18)";
  input.style.marginBottom = "10px";
  input.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';

  const selectorDetails = document.createElement("div");
  selectorDetails.style.marginBottom = "10px";

  const selectorDetailsTitle = document.createElement("div");
  selectorDetailsTitle.textContent = `선택자 상세 ${selectorCandidateIndex + 1}/${selectorCandidates.length}`;
  selectorDetailsTitle.style.fontWeight = "700";
  selectorDetailsTitle.style.marginBottom = "6px";

  const selectorDetailsGuide = document.createElement("div");
  selectorDetailsGuide.textContent = "현재 오브젝트에서 생성된 selector 후보 전체입니다. 긴 경로도 그대로 확인할 수 있습니다.";
  selectorDetailsGuide.style.marginBottom = "8px";
  selectorDetailsGuide.style.color = "#c9ba9c";
  selectorDetailsGuide.style.lineHeight = "1.45";

  const selectorDetailsList = document.createElement("div");
  selectorDetailsList.style.display = "grid";
  selectorDetailsList.style.gap = "6px";
  selectorDetailsList.style.maxHeight = "210px";
  selectorDetailsList.style.overflow = "auto";

  for (const [candidateIndex, candidateSelector] of selectorCandidates.entries()) {
    const candidateAssessment = selectorAssessment(candidateSelector);
    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.style.display = "block";
    detailButton.style.width = "100%";
    detailButton.style.padding = "8px";
    detailButton.style.border = candidateIndex === selectorCandidateIndex
      ? "1px solid rgba(59, 130, 246, 0.95)"
      : "1px solid rgba(255,255,255,0.18)";
    detailButton.style.background = candidateIndex === selectorCandidateIndex
      ? "rgba(59, 130, 246, 0.12)"
      : "rgba(255,255,255,0.05)";
    detailButton.style.color = "#f7f4eb";
    detailButton.style.cursor = "pointer";
    detailButton.style.textAlign = "left";

    const detailMeta = document.createElement("div");
    detailMeta.textContent = candidateAssessment.matches === null
      ? `${candidateIndex + 1}. 잘못된 선택자`
      : `${candidateIndex + 1}. ${candidateAssessment.label} · ${candidateAssessment.matches}개`;
    detailMeta.style.marginBottom = "4px";
    detailMeta.style.fontWeight = "700";
    detailMeta.style.color = candidateAssessment.tone;

    const detailBadgeRow = document.createElement("div");
    detailBadgeRow.style.display = "flex";
    detailBadgeRow.style.flexWrap = "wrap";
    detailBadgeRow.style.gap = "4px";
    detailBadgeRow.style.marginBottom = "4px";

    if (candidateIndex === selectorCandidateIndex) {
      const currentBadge = document.createElement("span");
      currentBadge.textContent = "현재 사용 중";
      currentBadge.style.padding = "1px 6px";
      currentBadge.style.borderRadius = "999px";
      currentBadge.style.background = "rgba(59, 130, 246, 0.95)";
      currentBadge.style.color = "#fff";
      detailBadgeRow.append(currentBadge);
    }

    const detailCode = document.createElement("code");
    detailCode.textContent = candidateSelector;
    detailCode.style.display = "block";
    detailCode.style.whiteSpace = "pre-wrap";
    detailCode.style.wordBreak = "break-word";
    detailCode.style.opacity = "0.95";

    detailButton.append(detailMeta, detailBadgeRow, detailCode);
    detailButton.addEventListener("click", () => {
      onSelectSelectorCandidate(candidateIndex);
    });
    selectorDetailsList.append(detailButton);
  }

  selectorDetails.append(selectorDetailsTitle, selectorDetailsGuide, selectorDetailsList);

  const primaryActions = document.createElement("div");
  primaryActions.style.display = "grid";
  primaryActions.style.gridTemplateColumns = "1fr 1fr";
  primaryActions.style.gap = "8px";
  primaryActions.style.marginBottom = "8px";

  const addCardButton = document.createElement("button");
  addCardButton.type = "button";
  addCardButton.textContent = "카드에 담기";
  addCardButton.style.gridColumn = "1 / -1";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "선택자 다시 읽기";

  const rangeActions = document.createElement("div");
  rangeActions.style.display = "grid";
  rangeActions.style.gridTemplateColumns = "1fr 1fr 1fr";
  rangeActions.style.gap = "8px";
  rangeActions.style.marginBottom = "8px";

  const narrowButton = document.createElement("button");
  narrowButton.type = "button";
  narrowButton.textContent = "대상 좁히기";
  narrowButton.disabled = depthIndex === 0;

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.textContent = selectorCandidates.length > 1 ? "다음 선택자" : "후보 없음";
  nextButton.disabled = selectorCandidates.length <= 1;

  const widerButton = document.createElement("button");
  widerButton.type = "button";
  widerButton.textContent = "대상 넓히기";
  widerButton.disabled = depthIndex >= depthTotal - 1;

  const secondaryActions = document.createElement("div");
  secondaryActions.style.display = "grid";
  secondaryActions.style.gridTemplateColumns = "1fr";
  secondaryActions.style.gap = "8px";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "패널 닫기";

  for (const button of [addCardButton, refreshButton, narrowButton, nextButton, widerButton, cancelButton]) {
    button.style.border = "1px solid #f7f4eb";
    button.style.background = "transparent";
    button.style.color = "#f7f4eb";
    button.style.padding = "8px 10px";
    button.style.cursor = "pointer";
    button.style.whiteSpace = "nowrap";
  }

  const updatePreview = (): void => {
    const currentSelector = input.value.trim();
    const assessment = currentSelector
      ? selectorAssessment(currentSelector)
      : {
          applyAllowed: false,
          label: "선택자가 비어 있습니다",
          matches: null,
          tone: "#fca5a5"
        };

    if (!currentSelector) {
      meta.textContent = `${depthLabel(depthIndex)} · 선택자가 비어 있습니다.`;
      qualityMeta.textContent = "상태: 비어 있음";
      qualityMeta.style.color = "#fca5a5";
      assistMeta.textContent = "안내: 선택자가 비어 있어 적용할 수 없습니다.";
      addCardButton.disabled = true;
      applyPreviewSelector("__infocutter_invalid__");
      return;
    }

    if (assessment.matches === null) {
      meta.textContent = `${depthLabel(depthIndex)} · 올바르지 않은 선택자입니다.`;
      qualityMeta.textContent = `상태: ${assessment.label}`;
      qualityMeta.style.color = assessment.tone;
      assistMeta.textContent = "안내: CSS 선택자 문법을 다시 확인하세요.";
      addCardButton.disabled = true;
      applyPreviewSelector("__infocutter_invalid__");
      return;
    }

    meta.textContent = `${depthLabel(depthIndex)} · 현재 선택자는 ${assessment.matches}개 요소에 적용됩니다.`;
    qualityMeta.textContent = `상태: ${assessment.label}`;
    qualityMeta.style.color = assessment.tone;
    assistMeta.textContent = assessment.applyAllowed
      ? "안내: 지금은 숨기지 않고 오브젝트 영역만 표시합니다. 카드에 추가한 뒤, 세션 완료 버튼으로 한 번에 적용할 수 있습니다."
      : "안내: 현재 선택자는 범위가 너무 넓습니다. 더 좁게 가거나 다른 선택자로 바꾸세요.";
    addCardButton.disabled = !assessment.applyAllowed;
    applyPreviewSelector(currentSelector);
  };

  addCardButton.addEventListener("click", () => {
    onAddCard(input.value.trim(), cardNameInput.value.trim() || defaultCardName);
  });
  refreshButton.addEventListener("click", updatePreview);
  narrowButton.addEventListener("click", onNarrow);
  nextButton.addEventListener("click", onNext);
  widerButton.addEventListener("click", onWider);
  cancelButton.addEventListener("click", onCancel);
  input.addEventListener("input", updatePreview);

  primaryActions.append(addCardButton, refreshButton);
  rangeActions.append(narrowButton, nextButton, widerButton);
  secondaryActions.append(cancelButton);
  panel.append(
    title,
    meta,
    depthMeta,
    candidateSection,
    breadcrumb,
    qualityMeta,
    assistMeta,
    cardNameInput,
    input,
    selectorDetails,
    primaryActions,
    rangeActions,
    secondaryActions
  );
  document.documentElement.append(panel);
  updatePreview();
  return panel;
}

function buildIframePanel(
  iframeElement: HTMLIFrameElement,
  onHideFrame: () => void,
  onEnterFrame: () => void,
  onCancel: () => void
): HTMLDivElement {
  document.getElementById(PICKER_PREVIEW_PANEL_ID)?.remove();

  const panel = document.createElement("div");
  panel.id = PICKER_PREVIEW_PANEL_ID;
  panel.style.position = "fixed";
  panel.style.right = "16px";
  panel.style.bottom = "64px";
  panel.style.width = "320px";
  panel.style.padding = "12px";
  panel.style.background = "#231f17";
  panel.style.color = "#f7f4eb";
  panel.style.zIndex = "2147483647";
  panel.style.boxShadow = "0 12px 30px rgba(0,0,0,0.24)";
  panel.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';

  const title = document.createElement("div");
  title.textContent = "iframe 감지됨";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";

  const meta = document.createElement("div");
  const frameHint = iframeElement.getAttribute("src") ?? iframeElement.getAttribute("title") ?? "내부 프레임";
  meta.textContent = `이 요소는 iframe 입니다: ${frameHint}`;
  meta.style.marginBottom = "8px";
  meta.style.color = "#f5d6b0";
  meta.style.whiteSpace = "pre-wrap";
  meta.style.wordBreak = "break-word";

  const guide = document.createElement("div");
  const accessMode = iframeAccessMode(iframeElement);
  if (accessMode === "cross-origin") {
    guide.textContent = "이 iframe은 다른 출처일 가능성이 있어 내부 선택이 제한될 수 있습니다. 안으로 들어가지 못하면 프레임 자체 숨기기를 사용하세요.";
  } else {
    guide.textContent = "프레임 자체를 숨기거나, 프레임 안으로 들어가서 내부 요소를 다시 선택할 수 있습니다.";
  }
  guide.style.marginBottom = "10px";
  guide.style.lineHeight = "1.45";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const hideButton = document.createElement("button");
  hideButton.type = "button";
  hideButton.textContent = "프레임 숨기기";
  hideButton.style.flex = "1";

  const enterButton = document.createElement("button");
  enterButton.type = "button";
  enterButton.textContent = "프레임 안 선택";
  enterButton.style.flex = "1";
  if (accessMode === "cross-origin") {
    enterButton.textContent = "프레임 안 선택 시도";
  }

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "취소";
  cancelButton.style.flex = "1";

  for (const button of [hideButton, enterButton, cancelButton]) {
    button.style.border = "1px solid #f7f4eb";
    button.style.background = "transparent";
    button.style.color = "#f7f4eb";
    button.style.padding = "8px 10px";
    button.style.cursor = "pointer";
  }

  hideButton.addEventListener("click", onHideFrame);
  enterButton.addEventListener("click", onEnterFrame);
  cancelButton.addEventListener("click", onCancel);

  actions.append(hideButton, enterButton, cancelButton);
  panel.append(title, meta, guide, actions);
  document.documentElement.append(panel);
  return panel;
}

async function startPickerInIframe(iframeElement: HTMLIFrameElement): Promise<boolean> {
  if (!iframeElement.contentWindow) {
    return false;
  }

  const requestId = generateId();

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", handleAck);
      resolve(false);
    }, 1200);

    const handleAck = (event: MessageEvent): void => {
      const payload: unknown = event.data;
      if (!payload || typeof payload !== "object") {
        return;
      }

      const source = "source" in payload ? Reflect.get(payload, "source") : null;
      const type = "type" in payload ? Reflect.get(payload, "type") : null;
      const ackRequestId = "requestId" in payload ? Reflect.get(payload, "requestId") : null;

      if (source === "infocutter" && type === PICKER_FRAME_ACK_TYPE && ackRequestId === requestId) {
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handleAck);
        resolve(true);
      }
    };

    window.addEventListener("message", handleAck);

    iframeElement.contentWindow?.postMessage(
      {
        requestId,
        source: "infocutter",
        type: PICKER_FRAME_MESSAGE_TYPE
      },
      "*"
    );
  });
}

function startPicker(): void {
  pickerStop?.();

  const overlay = buildOverlay();
  buildPickerLabel();
  let active = true;
  let overlayOpen = true;
  let currentOverlaySelector: string | null = null;
  let currentOverlayTone: "hover" | "preview" = "hover";
  let currentOverlayFallbackElement: Element | null = null;
  let hoverCandidates: Element[] = [];
  let hoverCandidateIndex = 0;
  let lastPointerPosition: { clientX: number; clientY: number } | null = null;
  document.documentElement.style.cursor = "crosshair";
  updatePickerFocusState(true, currentFrameLabel());

  const candidateTargetsAtPoint = (clientX: number, clientY: number): Element[] => {
    const sessionOverlay = document.getElementById(PICKER_SESSION_OVERLAY_ID);
    const previousOverlayDisplay = overlay.style.display;
    const previousSessionDisplay = sessionOverlay instanceof HTMLElement ? sessionOverlay.style.display : null;

    overlay.style.display = "none";
    if (sessionOverlay instanceof HTMLElement) {
      sessionOverlay.style.display = "none";
    }

    const targets = document.elementsFromPoint(clientX, clientY)
      .filter((element): element is Element => element instanceof Element)
      .filter((element) => !isExtensionUiElement(element));

    overlay.style.display = previousOverlayDisplay;
    if (sessionOverlay instanceof HTMLElement && previousSessionDisplay !== null) {
      sessionOverlay.style.display = previousSessionDisplay;
    }

    return [...targets].sort((left, right) => {
      const leftIndex = targets.indexOf(left);
      const rightIndex = targets.indexOf(right);
      return candidateTargetScore(right, rightIndex) - candidateTargetScore(left, leftIndex);
    });
  };

  const currentHoverTarget = (): Element | null => hoverCandidates[hoverCandidateIndex] ?? null;

  const renderHoverTarget = (): void => {
    const target = currentHoverTarget();
    if (!target) {
      currentOverlaySelector = null;
      currentOverlayFallbackElement = null;
      syncOverlay();
      setPickerStatusBadge("선택 상태: 후보 없음", "#fde68a");
      return;
    }

    const hoverSummary = buildHoverSummary(target);
    currentOverlaySelector = hoverSummary.selector;
    currentOverlayTone = "hover";
    currentOverlayFallbackElement = target;
    syncOverlay();
    setPickerLabelText(hoverSummary.label);
    if (hoverSummary.assessment) {
      setPickerStatusBadge(
        `선택 상태: ${hoverSummary.assessment.label} · 후보 ${hoverCandidateIndex + 1}/${hoverCandidates.length} · Tab 전환`,
        hoverSummary.assessment.tone
      );
      return;
    }

    setPickerStatusBadge(
      `선택 상태: 범위 재조정 필요 · 후보 ${hoverCandidateIndex + 1}/${hoverCandidates.length} · Tab 전환`,
      "#fde68a"
    );
  };

  const syncOverlay = (): void => {
    if (!overlayOpen) {
      return;
    }

    const rects = currentOverlaySelector
      ? selectorRects(currentOverlaySelector)
      : [];
    const fallbackRects = currentOverlayFallbackElement
      ? [currentOverlayFallbackElement.getBoundingClientRect()]
      : [];

    setOverlayRects(
      overlay,
      rects.length > 0 ? rects : fallbackRects,
      currentOverlayTone
    );
    applySelectionSessionHighlights();
  };

  const updateOverlay = (event: MouseEvent): void => {
    if (!active) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    lastPointerPosition = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    hoverCandidates = candidateTargetsAtPoint(event.clientX, event.clientY);
    hoverCandidateIndex = 0;
    if (hoverCandidates.length === 0) {
      return;
    }
    renderHoverTarget();
  };

  const handleViewportChange = (): void => {
    if (active && lastPointerPosition) {
      hoverCandidates = candidateTargetsAtPoint(lastPointerPosition.clientX, lastPointerPosition.clientY);
      if (hoverCandidates.length === 0) {
        hoverCandidateIndex = 0;
        currentOverlaySelector = null;
        currentOverlayFallbackElement = null;
        syncOverlay();
        setPickerStatusBadge("선택 상태: 후보 없음", "#fde68a");
        return;
      }

      hoverCandidateIndex = Math.min(hoverCandidateIndex, hoverCandidates.length - 1);
      renderHoverTarget();
      return;
    }

    syncOverlay();
  };

  const stopPicker = (): void => {
    active = false;
    overlayOpen = false;
    document.removeEventListener("mousemove", updateOverlay, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
    window.removeEventListener("scroll", handleViewportChange, true);
    window.removeEventListener("resize", handleViewportChange, true);
    removePickerArtifacts();
    pickerStop = null;
    updatePickerFocusState(false, "선택 모드 비활성");
  };

  pickerStop = stopPicker;

  const handleKeydown = (event: KeyboardEvent): void => {
    if (active && event.key === "Tab" && hoverCandidates.length > 1) {
      event.preventDefault();
      event.stopPropagation();
      hoverCandidateIndex = event.shiftKey
        ? (hoverCandidateIndex - 1 + hoverCandidates.length) % hoverCandidates.length
        : (hoverCandidateIndex + 1) % hoverCandidates.length;
      renderHoverTarget();
      return;
    }

    if (event.key === "Escape") {
      stopPicker();
    }
  };

  const handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const previousPointerX = lastPointerPosition?.clientX ?? Number.NaN;
    const previousPointerY = lastPointerPosition?.clientY ?? Number.NaN;
    const pointerChanged =
      previousPointerX !== event.clientX ||
      previousPointerY !== event.clientY;

    if (pointerChanged) {
      lastPointerPosition = {
        clientX: event.clientX,
        clientY: event.clientY
      };
      hoverCandidates = candidateTargetsAtPoint(event.clientX, event.clientY);
      hoverCandidateIndex = 0;
    }

    const frozenHoverCandidates = [...hoverCandidates];
    const initialTarget = currentHoverTarget();
    if (!initialTarget) {
      stopPicker();
      return;
    }
    let target: Element = initialTarget;

    active = false;
    document.removeEventListener("mousemove", updateOverlay, true);
    document.removeEventListener("click", handleClick, true);

    if (target instanceof HTMLIFrameElement) {
      const frameTarget = target;
      buildIframePanel(
        frameTarget,
        () => {
          void (async () => {
            await hideTargetElement(frameTarget);
            stopPicker();
          })();
        },
        () => {
          void (async () => {
            const accessMode = iframeAccessMode(frameTarget);
            const started = await startPickerInIframe(frameTarget);
            if (!started) {
              const label = buildPickerLabel();
              label.textContent = accessMode === "cross-origin"
                ? "cross-origin iframe이라 내부 선택을 시작하지 못했습니다. 프레임 자체 숨기기를 사용해보세요."
                : "iframe 내부 선택을 시작하지 못했습니다. 프레임 자체 숨기기를 사용해보세요.";
              return;
            }

            document.getElementById(PICKER_PREVIEW_PANEL_ID)?.remove();
            document.getElementById(PICKER_PREVIEW_STYLE_ID)?.remove();
            document.getElementById(`${PICKER_OVERLAY_ID}-label`)?.remove();
            buildPickerLabel().textContent = "iframe 안으로 들어갔습니다. 프레임 내부에서 다시 요소를 선택하세요.";
            window.removeEventListener("scroll", handleViewportChange, true);
            window.removeEventListener("resize", handleViewportChange, true);
            overlay.remove();
            document.documentElement.style.cursor = "";
            overlayOpen = false;
            pickerStop = null;
            updatePickerFocusState(false, "iframe 내부 선택 대기 중");
          })();
        },
        () => {
          stopPicker();
        }
      );
      return;
    }

    let depthChain = buildDepthChain(target);
    let depthIndex = 0;
    let candidateIndex = 0;

    const renderCandidate = (): void => {
      const focusElement = depthChain[depthIndex] ?? target;
      const candidates = buildSelectorCandidates(focusElement);
      const selector = candidates[candidateIndex] ?? buildSelector(focusElement);
      const focusSummary = buildHoverSummary(target);
      const applyTransientHoverCandidate = (nextHoverCandidateIndex: number | null): void => {
        if (nextHoverCandidateIndex === null) {
          currentOverlaySelector = selector;
          currentOverlayTone = "preview";
          currentOverlayFallbackElement = focusElement;
          syncOverlay();
          setPickerLabelText(focusSummary.label);
          if (focusSummary.assessment) {
            setPickerStatusBadge(
              `선택 상태: ${focusSummary.assessment.label} · 후보 ${hoverCandidateIndex + 1}/${frozenHoverCandidates.length}`,
              focusSummary.assessment.tone
            );
          } else {
            setPickerStatusBadge(
              `선택 상태: 범위 재조정 필요 · 후보 ${hoverCandidateIndex + 1}/${frozenHoverCandidates.length}`,
              "#fde68a"
            );
          }
          return;
        }

        const hoveredCandidate = frozenHoverCandidates[nextHoverCandidateIndex];
        if (!hoveredCandidate) {
          return;
        }

        const hoveredSummary = hoverCandidatePreview(hoveredCandidate);
        currentOverlaySelector = hoveredSummary.selector;
        currentOverlayTone = "hover";
        currentOverlayFallbackElement = hoveredCandidate;
        syncOverlay();
        setPickerLabelText(
          `인포커터 선택 모드: ${currentFrameLabel()} / 후보 미리보기 ${nextHoverCandidateIndex + 1}/${frozenHoverCandidates.length} · ${hoveredSummary.label}`
        );
        if (hoveredSummary.assessment) {
          setPickerStatusBadge(
            `후보 미리보기: ${hoveredSummary.assessment.label} · ${hoveredSummary.assessment.matches ?? 0}개`,
            hoveredSummary.assessment.tone
          );
        } else {
          setPickerStatusBadge("후보 미리보기: 상태를 확인하지 못했습니다", "#fde68a");
        }
      };
      currentOverlaySelector = selector;
      currentOverlayTone = "preview";
      currentOverlayFallbackElement = focusElement;
      syncOverlay();
      setPickerLabelText(focusSummary.label);
      if (focusSummary.assessment) {
        setPickerStatusBadge(
          `선택 상태: ${focusSummary.assessment.label} · 후보 ${hoverCandidateIndex + 1}/${frozenHoverCandidates.length}`,
          focusSummary.assessment.tone
        );
      } else {
        setPickerStatusBadge(
          `선택 상태: 범위 재조정 필요 · 후보 ${hoverCandidateIndex + 1}/${frozenHoverCandidates.length}`,
          "#fde68a"
        );
      }
      applyPreviewSelector(selector);
      buildPreviewPanel(
        frozenHoverCandidates,
        hoverCandidateIndex,
        target,
        depthChain,
        depthIndex,
        depthChain.length,
        candidates,
        candidateIndex,
        selector,
        elementShortLabel(focusElement),
        (nextHoverCandidateIndex) => {
          const nextTarget = frozenHoverCandidates[nextHoverCandidateIndex];
          if (!nextTarget) {
            return;
          }

          hoverCandidateIndex = nextHoverCandidateIndex;
          target = nextTarget;
          depthChain = buildDepthChain(target);
          depthIndex = 0;
          candidateIndex = 0;
          renderCandidate();
        },
        applyTransientHoverCandidate,
        (nextSelectorCandidateIndex) => {
          candidateIndex = nextSelectorCandidateIndex;
          renderCandidate();
        },
        (selectedSelector, cardName) => {
          selectionSession.push({
            cardId: generateId(),
            cardName,
            createdAt: new Date().toISOString(),
            frameScope: currentFrameScope(),
            selector: selectedSelector
          });

          buildSessionPanel(
            () => {
              void (async () => {
                await persistSelectionSession();
                await renderRules();
                pickerStop?.();
              })();
            },
            () => {
              selectionSession = [];
              pickerStop?.();
            }
          );
          startPicker();
        },
        () => {
          depthIndex = Math.max(0, depthIndex - 1);
          candidateIndex = 0;
          renderCandidate();
        },
        () => {
          candidateIndex = (candidateIndex + 1) % candidates.length;
          renderCandidate();
        },
        () => {
          depthIndex = Math.min(depthChain.length - 1, depthIndex + 1);
          candidateIndex = 0;
          renderCandidate();
        },
        () => {
          stopPicker();
        }
      );
    };

    renderCandidate();
  };

  const swallowPointer = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  overlay.addEventListener("mousemove", updateOverlay, true);
  overlay.addEventListener("mousedown", swallowPointer, true);
  overlay.addEventListener("mouseup", swallowPointer, true);
  overlay.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("scroll", handleViewportChange, true);
  window.addEventListener("resize", handleViewportChange, true);

  buildSessionPanel(
    () => {
      void (async () => {
        await persistSelectionSession();
        await renderRules();
        pickerStop?.();
      })();
    },
    () => {
      selectionSession = [];
      pickerStop?.();
    }
  );
}

async function hideTargetElement(target: Element): Promise<string> {
  const selector = buildSelector(target);
  await addSiteRule(ownerPageUrl(), selector, currentFrameScope(), {
    cardId: generateId(),
    cardName: "기본 카드"
  });
  await renderRules();
  return selector;
}

document.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target;
    lastContextTarget = target instanceof Element ? target : null;
  },
  true
);

window.addEventListener("message", (event: MessageEvent) => {
  const payload: unknown = event.data;
  if (!payload || typeof payload !== "object") {
    return;
  }

  const source = "source" in payload ? Reflect.get(payload, "source") : null;
  const type = "type" in payload ? Reflect.get(payload, "type") : null;

  if (source === "infocutter" && type === PICKER_FRAME_MESSAGE_TYPE) {
    const requestId = "requestId" in payload ? Reflect.get(payload, "requestId") : null;
    if (requestId && event.source && "postMessage" in event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage(
        {
          requestId,
          source: "infocutter",
          type: PICKER_FRAME_ACK_TYPE
        },
        {
          targetOrigin: "*"
        }
      );
    }
    startPicker();
  }
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void (async () => {
    if (!message || typeof message !== "object") {
      sendResponse({ ok: false });
      return;
    }

    const type = "type" in message ? message.type : null;

    if (type === messageTypes.ping) {
      sendResponse({
        ok: true,
        data: {
          ready: true,
          url: window.location.href
        }
      });
      return;
    }

    if (type === messageTypes.getPageState) {
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    if (type === messageTypes.startPicker) {
      startPicker();
      sendResponse({ ok: true });
      return;
    }

    if (type === messageTypes.stopPicker) {
      pickerStop?.();
      sendResponse({ ok: true });
      return;
    }

    if (type === messageTypes.hideLastContextTarget) {
      if (!lastContextTarget) {
        sendResponse({ ok: false });
        return;
      }

      const selector = await hideTargetElement(lastContextTarget);
      sendResponse({
        ok: true,
        data: {
          selector,
          state: await readActiveSiteState(window.location.href)
        }
      });
      return;
    }

    if (type === messageTypes.clearSiteRules) {
      const currentState = await readActiveSiteState(ownerPageUrl());
      if (!currentState.activeProfileId) {
        sendResponse({ ok: false });
        return;
      }

      await clearSiteRules(currentState.activeProfileId);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    if (type === messageTypes.removeSiteRule) {
      const selector = "selector" in message && typeof message.selector === "string" ? message.selector : null;
      const cardId = "cardId" in message && typeof message.cardId === "string" ? message.cardId : null;
      const createdAt = "createdAt" in message && typeof message.createdAt === "string"
        ? message.createdAt
        : null;
      const frameScope =
        "frameScope" in message && typeof message.frameScope === "string"
          ? message.frameScope
          : null;
      const profileId =
        "profileId" in message && typeof message.profileId === "string"
          ? message.profileId
          : null;
      if (!selector || !cardId || !createdAt) {
        sendResponse({ ok: false });
        return;
      }

      if (!profileId) {
        sendResponse({ ok: false });
        return;
      }

      await removeSiteRule(profileId, {
        cardId,
        createdAt,
        frameScope,
        selector
      });
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    if (type === messageTypes.toggleSiteEnabled) {
      const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : null;
      const currentState = await readActiveSiteState(ownerPageUrl());
      if (enabled === null) {
        sendResponse({ ok: false });
        return;
      }

      if (!currentState.activeProfileId) {
        sendResponse({ ok: false });
        return;
      }

      await setSiteEnabled(currentState.activeProfileId, enabled);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    if (type === messageTypes.toggleGlobalEnabled) {
      const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : null;
      if (enabled === null) {
        sendResponse({ ok: false });
        return;
      }

      await setGlobalEnabled(enabled);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    sendResponse({ ok: false });
  })().catch((error: unknown) => {
    console.error("콘텐츠 스크립트 메시지 처리에 실패했습니다", error);
    sendResponse({ ok: false });
  });

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !(STORAGE_KEY in changes)) {
    return;
  }

  void renderRules();
});

void renderRules();
}
})();
