import { hostnameFromUrl, readSiteRules, readStore } from "../shared/storage.js";

async function updateBadgeForTab(tabId: number, url?: string): Promise<void> {
  if (!url || !/^https?:\/\//.test(url)) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  const store = await readStore();
  const hostname = hostnameFromUrl(url);
  const siteRules = await readSiteRules(hostname);

  if (!store.settings.globalEnabled || !siteRules.enabled || siteRules.selectors.length === 0) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: "#8f2d1d"
  });
  await chrome.action.setBadgeText({
    tabId,
    text: String(Math.min(siteRules.selectors.length, 99))
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeTextColor({ color: "#f7f4eb" }).catch(() => {
    // Older Chrome versions may not support badge text color changes.
  });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId).then(async (tab) => {
    await updateBadgeForTab(tabId, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    void updateBadgeForTab(tabId, tab.url);
  }
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  void chrome.tabs.query({}).then(async (tabs) => {
    await Promise.all(
      tabs
        .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
        .map(async (tab) => updateBadgeForTab(tab.id, tab.url))
    );
  });
});
