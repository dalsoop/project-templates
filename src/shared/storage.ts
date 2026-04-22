import { STORAGE_KEY, STORAGE_VERSION } from "./constants.js";
import type { ActiveSiteState, RuleStore, SiteRuleSet } from "./types.js";

function emptyStore(): RuleStore {
  return {
    version: STORAGE_VERSION,
    sites: {}
  };
}

export function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

export async function readStore(): Promise<RuleStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const candidate: unknown = result[STORAGE_KEY];

  if (!candidate || typeof candidate !== "object") {
    return emptyStore();
  }

  const store = candidate as Partial<RuleStore>;
  if (store.version !== STORAGE_VERSION || !store.sites || typeof store.sites !== "object") {
    return emptyStore();
  }

  return {
    version: STORAGE_VERSION,
    sites: store.sites
  };
}

export async function writeStore(store: RuleStore): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: store
  });
}

export async function readSiteRules(hostname: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const rules = store.sites[hostname];

  return rules ?? { selectors: [], updatedAt: new Date(0).toISOString() };
}

export async function addSiteRule(hostname: string, selector: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? { selectors: [], updatedAt: new Date(0).toISOString() };
  const selectors = current.selectors.includes(selector) ? current.selectors : [...current.selectors, selector];
  const next: SiteRuleSet = {
    selectors,
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

export async function clearSiteRules(hostname: string): Promise<void> {
  const store = await readStore();
  const sites = Object.fromEntries(
    Object.entries(store.sites).filter(([siteHostname]) => siteHostname !== hostname)
  );
  await writeStore({
    ...store,
    sites
  });
}

export async function readActiveSiteState(url: string): Promise<ActiveSiteState> {
  const hostname = hostnameFromUrl(url);
  const siteRules = await readSiteRules(hostname);

  return {
    hostname,
    selectorCount: siteRules.selectors.length
  };
}
