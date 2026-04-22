import { messageTypes } from "../shared/messages.js";
import { findMatchingProfile, getEnabledRules, readStore } from "../shared/storage.js";

const contextMenuIds = {
  root: "infocutter-root",
  hideTarget: "infocutter-hide-target",
  startPicker: "infocutter-start-picker"
} as const;

const pickerFocusByTab = new Map<number, { focused: boolean; frameScope: string | null; label: string }>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isSupportedUrl(url?: string): boolean {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

function isMissingTabError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("No tab with id");
}

async function doesTabExist(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
}

async function runBadgeOperation(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (isMissingTabError(error)) {
      return;
    }

    throw error;
  }
}

async function updateBadgeForTab(tabId: number, url?: string): Promise<void> {
  const exists = await doesTabExist(tabId);
  if (!exists) {
    pickerFocusByTab.delete(tabId);
    return;
  }

  if (!url || !/^https?:\/\//.test(url)) {
    await runBadgeOperation(() => chrome.action.setBadgeText({ tabId, text: "" }));
    return;
  }

  const store = await readStore();
  const profile = findMatchingProfile(store, url);
  const enabledRules = getEnabledRules(profile);

  if (!store.settings.globalEnabled || !profile || !profile.enabled || enabledRules.length === 0) {
    await runBadgeOperation(() => chrome.action.setBadgeText({ tabId, text: "" }));
    return;
  }

  await runBadgeOperation(() => chrome.action.setBadgeBackgroundColor({
    tabId,
    color: "#8f2d1d"
  }));
  await runBadgeOperation(() => chrome.action.setBadgeText({
    tabId,
    text: String(Math.min(enabledRules.length, 99))
  }));
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

async function sendTabMessage(tabId: number, type: string, frameId?: number): Promise<void> {
  if (typeof frameId === "number") {
    await chrome.tabs.sendMessage(tabId, { type }, { frameId });
    return;
  }

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

async function sendMessageToTopFrame(tabId: number, type: string): Promise<void> {
  await sendTabMessage(tabId, type, 0);
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
        // Ignore per-frame failures during cleanup.
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
  const frameId = typeof info.frameId === "number" ? info.frameId : undefined;

  if (info.menuItemId === contextMenuIds.hideTarget) {
    void ensureContentScript(tabId)
      .then(async () => sendTabMessage(tabId, messageTypes.hideLastContextTarget, frameId))
      .catch((error: unknown) => {
      console.warn("인포커터 우클릭 숨기기에 실패했습니다", error);
    });
    return;
  }

  if (info.menuItemId === contextMenuIds.startPicker) {
    void ensureContentScript(tabId)
      .then(async () => {
        await sendMessageToAllFrames(tabId, messageTypes.stopPicker);
        await sendMessageToTopFrame(tabId, messageTypes.startPicker);
      })
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

    if (type === messageTypes.getPickerFocus) {
      sendResponse({
        ok: true,
        data: pickerFocusByTab.get(tabId) ?? {
          focused: false,
          frameScope: null,
          label: "선택 모드 비활성"
        }
      });
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

      await sendMessageToAllFrames(tabId, messageTypes.stopPicker);
      pickerFocusByTab.set(tabId, {
        focused: true,
        frameScope: null,
        label: "메인 문서 선택 중"
      });
      await sendMessageToTopFrame(tabId, messageTypes.startPicker);
      sendResponse({ ok: true });
      return;
    }

    if (type === messageTypes.updatePickerFocus) {
      const senderTabId = _sender.tab?.id;
      if (typeof senderTabId !== "number") {
        sendResponse({ ok: false });
        return;
      }

      const focused = "focused" in message && typeof message.focused === "boolean" ? message.focused : false;
      const frameScope = "frameScope" in message && typeof message.frameScope === "string" ? message.frameScope : null;
      const label = "label" in message && typeof message.label === "string" ? message.label : "선택 모드 상태 미상";

      pickerFocusByTab.set(senderTabId, {
        focused,
        frameScope,
        label
      });
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
  void chrome.tabs.get(tabId)
    .then(async (tab) => {
      await updateBadgeForTab(tabId, tab.url);
    })
    .catch((error: unknown) => {
      if (isMissingTabError(error)) {
        pickerFocusByTab.delete(tabId);
        return;
      }

      console.warn("인포커터 활성 탭 배지 갱신에 실패했습니다", error);
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    void updateBadgeForTab(tabId, tab.url).catch((error: unknown) => {
      if (isMissingTabError(error)) {
        pickerFocusByTab.delete(tabId);
        return;
      }

      console.warn("인포커터 탭 업데이트 배지 갱신에 실패했습니다", error);
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pickerFocusByTab.delete(tabId);
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  void chrome.tabs.query({})
    .then(async (tabs) => {
      await Promise.all(
        tabs
          .filter((tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined)
          .map(async (tab) => updateBadgeForTab(tab.id, tab.url))
      );
    })
    .catch((error: unknown) => {
      console.warn("인포커터 저장소 변경 후 배지 재계산에 실패했습니다", error);
    });
});
