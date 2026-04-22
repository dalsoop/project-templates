import { STORAGE_KEY, STORAGE_VERSION } from "./constants.js";
import type { ActiveSiteState, RuleProfile, RuleStore, StoredRule } from "./types.js";

function emptyProfile(): RuleProfile {
  return {
    enabled: true,
    id: crypto.randomUUID(),
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
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

function normalizeRule(rule: unknown): StoredRule | null {
  if (typeof rule === "string") {
    return {
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
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
    frameScope: typeof candidate.frameScope === "string" ? candidate.frameScope : null,
    selector: candidate.selector
  };
}

function normalizeProfile(rawProfile: unknown): RuleProfile | null {
  if (!rawProfile || typeof rawProfile !== "object") {
    return null;
  }

  const enabledValue: unknown = Reflect.get(rawProfile, "enabled");
  const idValue: unknown = Reflect.get(rawProfile, "id");
  const matchersValue: unknown = Reflect.get(rawProfile, "matchers");
  const nameValue: unknown = Reflect.get(rawProfile, "name");
  const rulesValue: unknown = Reflect.get(rawProfile, "rules");
  const updatedAtValue: unknown = Reflect.get(rawProfile, "updatedAt");

  const rules = Array.isArray(rulesValue)
    ? rulesValue.map(normalizeRule).filter((rule): rule is StoredRule => rule !== null)
    : [];

  const matchers = Array.isArray(matchersValue)
    ? matchersValue.filter((matcher): matcher is string => typeof matcher === "string" && matcher.length > 0)
    : [];

  return {
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    id: typeof idValue === "string" && idValue.length > 0 ? idValue : crypto.randomUUID(),
    matchers,
    name: typeof nameValue === "string" && nameValue.length > 0
      ? nameValue
      : matchers[0]
        ? profileNameFromMatcher(matchers[0])
        : "이름 없는 프로필",
    rules,
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
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    id: crypto.randomUUID(),
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

  if (versionValue === 3) {
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
  const store = await readStore();
  const current = findMatchingProfile(store, url) ?? (await ensureProfileForUrl(url));
  const refreshedStore = await readStore();
  const profile = refreshedStore.profiles.find((item) => item.id === current.id) ?? current;
  const nextRule: StoredRule = {
    createdAt: new Date().toISOString(),
    frameScope,
    selector
  };

  const nextProfile: RuleProfile = {
    ...profile,
    enabled: true,
    rules: profile.rules.some((rule) => rule.selector === selector && rule.frameScope === frameScope)
      ? profile.rules
      : [...profile.rules, nextRule],
    updatedAt: new Date().toISOString()
  };

  refreshedStore.profiles = refreshedStore.profiles.map((item) => (item.id === profile.id ? nextProfile : item));
  await writeStore(refreshedStore);
  return nextProfile;
}

export async function removeRuleFromProfile(profileId: string, selector: string, frameScope: string | null): Promise<RuleProfile | null> {
  const store = await readStore();
  const profile = store.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return null;
  }

  const nextProfile: RuleProfile = {
    ...profile,
    rules: profile.rules.filter((rule) => !(rule.selector === selector && rule.frameScope === frameScope)),
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

  return {
    activeProfileId: profile?.id ?? null,
    activeProfileName: profile?.name ?? null,
    globalEnabled: store.settings.globalEnabled,
    hostname: hostnameFromUrl(url),
    matchers: profile?.matchers ?? [],
    profileEnabled: profile?.enabled ?? true,
    rules: profile?.rules ? [...profile.rules] : [],
    selectorCount: profile?.rules.length ?? 0,
    updatedAt: profile?.updatedAt ?? new Date(0).toISOString(),
    url
  };
}
