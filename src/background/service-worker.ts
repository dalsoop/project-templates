import { messageTypes } from "../shared/messages.js";
import { hostnameFromUrl, readSiteRules, readStore } from "../shared/storage.js";

const contextMenuIds = {
  root: "infocutter-root",
  hideTarget: "infocutter-hide-target",
  startPicker: "infocutter-start-picker"
} as const;

function isSupportedUrl(url?: string): boolean {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

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

function createContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: contextMenuIds.root,
      title: "인포커터",
      contexts: ["all"]
    });

    chrome.contextMenus.create({
      id: contextMenuIds.hideTarget,
      parentId: contextMenuIds.root,
      title: "이 요소 숨기기",
      contexts: ["all"]
    });

    chrome.contextMenus.create({
      id: contextMenuIds.startPicker,
      parentId: contextMenuIds.root,
      title: "선택 모드 시작",
      contexts: ["all"]
    });
  });
}

async function sendTabMessage(tabId: number, type: string): Promise<void> {
  await chrome.tabs.sendMessage(tabId, { type });
}

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content/index.js"]
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeTextColor({ color: "#f7f4eb" }).catch(() => {
    // Older Chrome versions may not support badge text color changes.
  });
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id || !isSupportedUrl(tab.url)) {
    return;
  }

  if (info.menuItemId === contextMenuIds.hideTarget) {
    void ensureContentScript(tab.id)
      .then(async () => sendTabMessage(tab.id, messageTypes.hideLastContextTarget))
      .catch((error: unknown) => {
      console.warn("인포커터 우클릭 숨기기에 실패했습니다", error);
    });
    return;
  }

  if (info.menuItemId === contextMenuIds.startPicker) {
    void ensureContentScript(tab.id)
      .then(async () => sendTabMessage(tab.id, messageTypes.startPicker))
      .catch((error: unknown) => {
      console.warn("인포커터 선택 모드 시작에 실패했습니다", error);
    });
  }
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
