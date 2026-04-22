import { STORAGE_KEY, STORAGE_VERSION } from "./constants.js";
import type { ActiveSiteState, RuleStore, SiteRuleSet, StoredRule } from "./types.js";

function emptySiteRuleSet(): SiteRuleSet {
  return {
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
    sites: {}
  };
}

function normalizeSiteRuleSet(rawSiteRules: unknown): SiteRuleSet {
  const partialSiteRules =
    rawSiteRules && typeof rawSiteRules === "object"
      ? rawSiteRules
      : {};

  const enabledValue: unknown = Reflect.get(partialSiteRules, "enabled");
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
    .map((rule): StoredRule | null => {
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
    })
    .filter((rule): rule is StoredRule => rule !== null);

  return {
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    rules,
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : new Date(0).toISOString()
  };
}

export function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

export function normalizeStore(candidate: unknown): RuleStore {
  if (!candidate || typeof candidate !== "object") {
    return emptyStore();
  }

  const partialStore = candidate as {
    settings?: unknown;
    sites?: unknown;
    version?: number;
  };

  const rawSites =
    partialStore.sites && typeof partialStore.sites === "object"
      ? partialStore.sites
      : {};

  const sites: Record<string, SiteRuleSet> = {};
  for (const [hostname, rawSiteRules] of Object.entries(rawSites)) {
    sites[hostname] = normalizeSiteRuleSet(rawSiteRules);
  }

  if (partialStore.version === 1) {
    return {
      version: STORAGE_VERSION,
      settings: {
        globalEnabled: true
      },
      sites
    };
  }

  if (partialStore.version !== STORAGE_VERSION) {
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
    sites
  };
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

export async function readSiteRules(hostname: string): Promise<SiteRuleSet> {
  const store = await readStore();
  return store.sites[hostname] ?? emptySiteRuleSet();
}

export async function addSiteRule(hostname: string, selector: string, frameScope: string | null): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const nextRule: StoredRule = {
    createdAt: new Date().toISOString(),
    frameScope,
    selector
  };
  const next: SiteRuleSet = {
    enabled: true,
    rules: current.rules.some((rule) => rule.selector === selector && rule.frameScope === frameScope)
      ? current.rules
      : [...current.rules, nextRule],
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

export async function removeSiteRule(hostname: string, selector: string, frameScope: string | null): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    ...current,
    rules: current.rules.filter((rule) => !(rule.selector === selector && rule.frameScope === frameScope)),
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

export async function clearSiteRules(hostname: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    ...current,
    rules: [],
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

export async function setSiteEnabled(hostname: string, enabled: boolean): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    ...current,
    enabled,
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
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
  const hostname = hostnameFromUrl(url);
  const siteRules = store.sites[hostname] ?? emptySiteRuleSet();

  return {
    globalEnabled: store.settings.globalEnabled,
    hostname,
    rules: [...siteRules.rules],
    selectorCount: siteRules.rules.length,
    siteEnabled: siteRules.enabled,
    updatedAt: siteRules.updatedAt
  };
}
