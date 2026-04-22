import { messageTypes } from "../shared/messages.js";
import { findMatchingProfile, readStore } from "../shared/storage.js";

const contextMenuIds = {
  root: "infocutter-root",
  hideTarget: "infocutter-hide-target",
  startPicker: "infocutter-start-picker"
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isSupportedUrl(url?: string): boolean {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

async function updateBadgeForTab(tabId: number, url?: string): Promise<void> {
  if (!url || !/^https?:\/\//.test(url)) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  const store = await readStore();
  const profile = findMatchingProfile(store, url);

  if (!store.settings.globalEnabled || !profile || !profile.enabled || profile.rules.length === 0) {
    await chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  await chrome.action.setBadgeBackgroundColor({
    tabId,
    color: "#8f2d1d"
  });
  await chrome.action.setBadgeText({
    tabId,
    text: String(Math.min(profile.rules.length, 99))
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
    target: { tabId, allFrames: true },
    files: ["src/content/index.js"]
  });
}

async function pingTab(tabId: number): Promise<boolean> {
  try {
    const response: unknown = await chrome.tabs.sendMessage(tabId, { type: messageTypes.ping });
    if (!response || typeof response !== "object") {
      return false;
    }

    return "ok" in response && response.ok === true;
  } catch {
    return false;
  }
}

async function ensureTabReady(tabId: number): Promise<boolean> {
  const wasReady = await pingTab(tabId);
  if (wasReady) {
    return true;
  }

  await ensureContentScript(tabId);

  for (const delayMs of [80, 180, 320]) {
    await sleep(delayMs);
    const ready = await pingTab(tabId);
    if (ready) {
      return true;
    }
  }

  return false;
}

async function sendMessageToAllFrames(tabId: number, type: string): Promise<void> {
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  const resolvedFrames = frames ?? [];
  const frameIds = resolvedFrames
    .map((frame) => frame.frameId)
    .filter((frameId): frameId is number => typeof frameId === "number");

  if (frameIds.length === 0) {
    await chrome.tabs.sendMessage(tabId, { type });
    return;
  }

  await Promise.all(
    frameIds.map(async (frameId) => {
      try {
        await chrome.tabs.sendMessage(tabId, { type }, { frameId });
      } catch {
        // Ignore per-frame failures.
      }
    })
  );
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

  const tabId = tab.id;

  if (info.menuItemId === contextMenuIds.hideTarget) {
    void ensureContentScript(tabId)
      .then(async () => sendTabMessage(tabId, messageTypes.hideLastContextTarget))
      .catch((error: unknown) => {
      console.warn("인포커터 우클릭 숨기기에 실패했습니다", error);
    });
    return;
  }

  if (info.menuItemId === contextMenuIds.startPicker) {
    void ensureContentScript(tabId)
      .then(async () => sendMessageToAllFrames(tabId, messageTypes.startPicker))
      .catch((error: unknown) => {
      console.warn("인포커터 선택 모드 시작에 실패했습니다", error);
    });
  }
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void (async () => {
    if (!message || typeof message !== "object") {
      sendResponse({ ok: false });
      return;
    }

    const type = "type" in message ? message.type : null;
    const tabId = "tabId" in message && typeof message.tabId === "number" ? message.tabId : null;
    const url = "url" in message && typeof message.url === "string" ? message.url : undefined;

    if (tabId === null) {
      sendResponse({ ok: false });
      return;
    }

    if (type === messageTypes.ensureTabReady) {
      sendResponse({ ok: await ensureTabReady(tabId) });
      return;
    }

    if (type === messageTypes.runDiagnostics) {
      if (!isSupportedUrl(url)) {
        sendResponse({
          ok: true,
          data: "진단 결과: 이 페이지는 확장 대상이 아닙니다."
        });
        return;
      }

      const wasReady = await pingTab(tabId);
      if (wasReady) {
        sendResponse({
          ok: true,
          data: "진단 결과: 콘텐츠 스크립트가 이미 연결되어 있습니다."
        });
        return;
      }

      const ready = await ensureTabReady(tabId);
      sendResponse({
        ok: true,
        data: ready
          ? "진단 결과: 콘텐츠 스크립트를 다시 연결했습니다."
          : "진단 결과: 콘텐츠 스크립트 연결에 실패했습니다."
      });
      return;
    }

    if (type === messageTypes.startPickerFlow) {
      if (!isSupportedUrl(url)) {
        sendResponse({
          ok: false,
          data: "이 페이지는 선택 모드를 지원하지 않습니다."
        });
        return;
      }

      const ready = await ensureTabReady(tabId);
      if (!ready) {
        sendResponse({
          ok: false,
          data: "콘텐츠 스크립트를 연결하지 못했습니다."
        });
        return;
      }

      await sendMessageToAllFrames(tabId, messageTypes.startPicker);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false });
  })().catch((error: unknown) => {
    console.warn("인포커터 백그라운드 메시지 처리에 실패했습니다", error);
    sendResponse({ ok: false });
  });

  return true;
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
