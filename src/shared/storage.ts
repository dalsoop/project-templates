import { STORAGE_KEY, STORAGE_VERSION } from "./constants.js";
import type { ActiveSiteState, ProfileCard, RuleProfile, RuleStore, SavedCard, StoredRule } from "./types.js";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createProfileCard(cardId = generateId(), cardName = "기본 카드", createdAt = new Date(0).toISOString()): ProfileCard {
  return {
    createdAt,
    enabled: true,
    id: cardId,
    name: cardName,
    updatedAt: createdAt
  };
}

function emptyProfile(): RuleProfile {
  return {
    cards: [],
    enabled: true,
    id: generateId(),
    matchers: [],
    name: "새 프로필",
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

function profileNameFromMatcher(matcher: string): string {
  return matcher.replace(/^\*?:?\/\//, "").replace(/\/\*$/, "");
}

function hostnameMatcher(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}/*`;
}

function normalizeRule(rule: unknown): StoredRule | null {
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

  const candidate = rule as Partial<StoredRule>;
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
}

function normalizeCard(rawCard: unknown): ProfileCard | null {
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

function deriveCardsFromRules(rules: StoredRule[]): ProfileCard[] {
  const cards = new Map<string, ProfileCard>();

  for (const rule of rules) {
    if (cards.has(rule.cardId)) {
      continue;
    }

    cards.set(rule.cardId, createProfileCard(rule.cardId, rule.cardName, rule.createdAt));
  }

  return Array.from(cards.values()).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function reconcileProfileCards(rules: StoredRule[], cards: ProfileCard[]): { cards: ProfileCard[]; rules: StoredRule[] } {
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

function normalizeProfile(rawProfile: unknown): RuleProfile | null {
  if (!rawProfile || typeof rawProfile !== "object") {
    return null;
  }

  const cardsValue: unknown = Reflect.get(rawProfile, "cards");
  const enabledValue: unknown = Reflect.get(rawProfile, "enabled");
  const idValue: unknown = Reflect.get(rawProfile, "id");
  const matchersValue: unknown = Reflect.get(rawProfile, "matchers");
  const nameValue: unknown = Reflect.get(rawProfile, "name");
  const rulesValue: unknown = Reflect.get(rawProfile, "rules");
  const updatedAtValue: unknown = Reflect.get(rawProfile, "updatedAt");

  const rules = Array.isArray(rulesValue)
    ? rulesValue.map(normalizeRule).filter((rule): rule is StoredRule => rule !== null)
    : [];
  const rawCards = Array.isArray(cardsValue)
    ? cardsValue.map(normalizeCard).filter((card): card is ProfileCard => card !== null)
    : deriveCardsFromRules(rules);
  const reconciled = reconcileProfileCards(rules, rawCards);

  const matchers = Array.isArray(matchersValue)
    ? matchersValue.filter((matcher): matcher is string => typeof matcher === "string" && matcher.length > 0)
    : [];

  return {
    cards: reconciled.cards,
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    id: typeof idValue === "string" && idValue.length > 0 ? idValue : generateId(),
    matchers,
    name: typeof nameValue === "string" && nameValue.length > 0
      ? nameValue
      : matchers[0]
        ? profileNameFromMatcher(matchers[0])
        : "이름 없는 프로필",
    rules: reconciled.rules,
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : new Date(0).toISOString()
  };
}

function normalizeLegacySiteRules(hostname: string, rawSiteRules: unknown): RuleProfile {
  const enabledValue: unknown = rawSiteRules && typeof rawSiteRules === "object" ? Reflect.get(rawSiteRules, "enabled") : undefined;
  const rulesValue: unknown = rawSiteRules && typeof rawSiteRules === "object" ? Reflect.get(rawSiteRules, "rules") : undefined;
  const selectorsValue: unknown = rawSiteRules && typeof rawSiteRules === "object" ? Reflect.get(rawSiteRules, "selectors") : undefined;
  const updatedAtValue: unknown = rawSiteRules && typeof rawSiteRules === "object" ? Reflect.get(rawSiteRules, "updatedAt") : undefined;

  const rawRules: unknown[] = Array.isArray(rulesValue)
    ? rulesValue
    : Array.isArray(selectorsValue)
      ? selectorsValue
      : [];

  const rules = rawRules.map(normalizeRule).filter((rule): rule is StoredRule => rule !== null);
  const matcher = `https://${hostname}/*`;

  return {
    cards: deriveCardsFromRules(rules),
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    id: generateId(),
    matchers: [matcher],
    name: hostname,
    rules,
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : new Date(0).toISOString()
  };
}

export function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

export function matcherToRegExp(matcher: string): RegExp {
  const escaped = matcher.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesUrl(matcher: string, url: string): boolean {
  return matcherToRegExp(matcher).test(url);
}

export function findMatchingProfile(store: RuleStore, url: string): RuleProfile | null {
  return store.profiles.find((profile) => profile.matchers.some((matcher) => matchesUrl(matcher, url))) ?? null;
}

export function groupRulesByCard(rules: StoredRule[], profileCards: ProfileCard[] = []): SavedCard[] {
  const cards = new Map<string, SavedCard>();

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

export function getEnabledRules(profile: RuleProfile | null): StoredRule[] {
  if (!profile) {
    return [];
  }

  const enabledCardIds = new Set(
    profile.cards
      .filter((card) => card.enabled)
      .map((card) => card.id)
  );

  return profile.rules.filter((rule) => enabledCardIds.has(rule.cardId));
}

export function normalizeStore(candidate: unknown): RuleStore {
  if (!candidate || typeof candidate !== "object") {
    return emptyStore();
  }

  const versionValue: unknown = Reflect.get(candidate, "version");
  const settingsValue: unknown = Reflect.get(candidate, "settings");
  const profilesValue: unknown = Reflect.get(candidate, "profiles");
  const sitesValue: unknown = Reflect.get(candidate, "sites");

  const globalEnabled =
    settingsValue &&
    typeof settingsValue === "object" &&
    "globalEnabled" in settingsValue &&
    typeof settingsValue.globalEnabled === "boolean"
      ? settingsValue.globalEnabled
      : true;

  if (versionValue === 4 || versionValue === 3) {
    const profiles = Array.isArray(profilesValue)
      ? profilesValue.map(normalizeProfile).filter((profile): profile is RuleProfile => profile !== null)
      : [];

    return {
      version: STORAGE_VERSION,
      settings: {
        globalEnabled
      },
      profiles
    };
  }

  if (versionValue === 2 || versionValue === 1) {
    const rawSites =
      sitesValue && typeof sitesValue === "object"
        ? (sitesValue as Record<string, unknown>)
        : {};

    const profiles = Object.entries(rawSites).map(([hostname, rawSiteRules]) => normalizeLegacySiteRules(hostname, rawSiteRules));

    return {
      version: STORAGE_VERSION,
      settings: {
        globalEnabled
      },
      profiles
    };
  }

  return emptyStore();
}

export async function readStore(): Promise<RuleStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const candidate: unknown = result[STORAGE_KEY];
  return normalizeStore(candidate);
}

export async function writeStore(store: RuleStore): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: store
  });
}

export async function ensureProfileForUrl(url: string): Promise<RuleProfile> {
  const store = await readStore();
  const existing = findMatchingProfile(store, url);
  if (existing) {
    return existing;
  }

  const matcher = hostnameMatcher(url);
  const profile: RuleProfile = {
    ...emptyProfile(),
    matchers: [matcher],
    name: hostnameFromUrl(url),
    updatedAt: new Date().toISOString()
  };

  store.profiles.push(profile);
  await writeStore(store);
  return profile;
}

export async function createProfile(name: string, matcher: string): Promise<RuleProfile> {
  const store = await readStore();
  const profile: RuleProfile = {
    ...emptyProfile(),
    matchers: matcher ? [matcher] : [],
    name: name.trim() || "새 프로필",
    updatedAt: new Date().toISOString()
  };

  store.profiles.push(profile);
  await writeStore(store);
  return profile;
}

export async function updateProfile(
  profileId: string,
  updater: (profile: RuleProfile) => RuleProfile
): Promise<RuleProfile | null> {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const nextProfile = updater(profile);
  store.profiles = store.profiles.map((item) => (item.id === profileId ? nextProfile : item));
  await writeStore(store);
  return nextProfile;
}

export async function renameProfile(profileId: string, name: string): Promise<RuleProfile | null> {
  return updateProfile(profileId, (profile) => ({
    ...profile,
    name: name.trim() || profile.name,
    updatedAt: new Date().toISOString()
  }));
}

export async function setProfileMatchers(profileId: string, matchers: string[]): Promise<RuleProfile | null> {
  const sanitizedMatchers = matchers
    .map((matcher) => matcher.trim())
    .filter((matcher) => matcher.length > 0);

  return updateProfile(profileId, (profile) => ({
    ...profile,
    matchers: sanitizedMatchers,
    updatedAt: new Date().toISOString()
  }));
}

export async function deleteProfile(profileId: string): Promise<void> {
  const store = await readStore();
  store.profiles = store.profiles.filter((profile) => profile.id !== profileId);
  await writeStore(store);
}

export async function moveProfile(profileId: string, direction: "up" | "down"): Promise<void> {
  const store = await readStore();
  const index = store.profiles.findIndex((profile) => profile.id === profileId);
  if (index < 0) {
    return;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= store.profiles.length) {
    return;
  }

  const nextProfiles = [...store.profiles];
  const [profile] = nextProfiles.splice(index, 1);
  if (!profile) {
    return;
  }
  nextProfiles.splice(targetIndex, 0, profile);
  store.profiles = nextProfiles;
  await writeStore(store);
}

export async function addRuleToUrl(url: string, selector: string, frameScope: string | null): Promise<RuleProfile> {
  return addCardToUrl(url, {
    cardId: generateId(),
    cardName: "기본 카드",
    createdAt: new Date().toISOString(),
    frameScope,
    selector
  });
}

export async function addCardToUrl(url: string, rule: StoredRule): Promise<RuleProfile> {
  const store = await readStore();
  const current = findMatchingProfile(store, url) ?? (await ensureProfileForUrl(url));
  const refreshedStore = await readStore();
  const profile = refreshedStore.profiles.find((item) => item.id === current.id) ?? current;
  const existingCard = profile.cards.find((card) => card.id === rule.cardId);
  const nextRule: StoredRule = {
    cardId: rule.cardId,
    cardName: existingCard?.name ?? rule.cardName,
    createdAt: rule.createdAt,
    frameScope: rule.frameScope,
    selector: rule.selector
  };

  const nextProfile: RuleProfile = {
    ...profile,
    cards: existingCard
      ? profile.cards
      : [...profile.cards, createProfileCard(rule.cardId, rule.cardName, rule.createdAt)],
    enabled: true,
    rules: profile.rules.some((existingRule) =>
      existingRule.selector === nextRule.selector &&
      existingRule.frameScope === nextRule.frameScope &&
      existingRule.cardId === nextRule.cardId
    )
      ? profile.rules
      : [...profile.rules, nextRule],
    updatedAt: new Date().toISOString()
  };

  refreshedStore.profiles = refreshedStore.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(refreshedStore);
  return nextProfile;
}

function isSameStoredRule(
  rule: Pick<StoredRule, "cardId" | "createdAt" | "frameScope" | "selector">,
  targetRule: Pick<StoredRule, "cardId" | "createdAt" | "frameScope" | "selector">
): boolean {
  return (
    rule.cardId === targetRule.cardId &&
    rule.createdAt === targetRule.createdAt &&
    rule.frameScope === targetRule.frameScope &&
    rule.selector === targetRule.selector
  );
}

export async function removeRuleFromProfile(
  profileId: string,
  targetRule: Pick<StoredRule, "cardId" | "createdAt" | "frameScope" | "selector">
): Promise<RuleProfile | null> {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const remainingRules = profile.rules.filter((rule) => !isSameStoredRule(rule, targetRule));
  const remainingCardIds = new Set(remainingRules.map((rule) => rule.cardId));

  const nextProfile: RuleProfile = {
    ...profile,
    cards: profile.cards.filter((card) => remainingCardIds.has(card.id)),
    rules: remainingRules,
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(store);
  return nextProfile;
}

export async function renameCardInProfile(profileId: string, cardId: string, cardName: string): Promise<RuleProfile | null> {
  const nextName = cardName.trim();
  if (!nextName) {
    return null;
  }

  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const nextProfile: RuleProfile = {
    ...profile,
    cards: profile.cards.map((card) => (
      card.id === cardId
        ? {
            ...card,
            name: nextName,
            updatedAt: new Date().toISOString()
          }
        : card
    )),
    rules: profile.rules.map((rule) => (
      rule.cardId === cardId
        ? {
            ...rule,
            cardName: nextName
          }
        : rule
    )),
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(store);
  return nextProfile;
}

export async function removeCardFromProfile(profileId: string, cardId: string): Promise<RuleProfile | null> {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const nextProfile: RuleProfile = {
    ...profile,
    cards: profile.cards.filter((card) => card.id !== cardId),
    rules: profile.rules.filter((rule) => rule.cardId !== cardId),
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(store);
  return nextProfile;
}

export async function clearProfileRules(profileId: string): Promise<RuleProfile | null> {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const nextProfile: RuleProfile = {
    ...profile,
    cards: [],
    rules: [],
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(store);
  return nextProfile;
}

export async function setProfileEnabled(profileId: string, enabled: boolean): Promise<RuleProfile | null> {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const nextProfile: RuleProfile = {
    ...profile,
    enabled,
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(store);
  return nextProfile;
}

export async function setCardEnabled(profileId: string, cardId: string, enabled: boolean): Promise<RuleProfile | null> {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const nextProfile: RuleProfile = {
    ...profile,
    cards: profile.cards.map((card) => (
      card.id === cardId
        ? {
            ...card,
            enabled,
            updatedAt: new Date().toISOString()
          }
        : card
    )),
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(store);
  return nextProfile;
}

export async function setGlobalEnabled(globalEnabled: boolean): Promise<RuleStore> {
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

export async function readActiveSiteState(url: string): Promise<ActiveSiteState> {
  const store = await readStore();
  const profile = findMatchingProfile(store, url);
  const rules = profile?.rules ? [...profile.rules] : [];
  const cards = groupRulesByCard(rules, profile?.cards ?? []);
  const enabledRules = getEnabledRules(profile);

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
