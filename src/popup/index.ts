import { messageTypes } from "../shared/messages.js";
import type { ActiveSiteState } from "../shared/types.js";

const siteLabel = document.getElementById("site-label");
const ruleCount = document.getElementById("rule-count");
const siteState = document.getElementById("site-state");
const globalState = document.getElementById("global-state");
const status = document.getElementById("status");
const pickButton = document.getElementById("pick-button");
const toggleSiteButton = document.getElementById("toggle-site-button");
const toggleGlobalButton = document.getElementById("toggle-global-button");
const refreshButton = document.getElementById("refresh-button");
const clearButton = document.getElementById("clear-button");
const ruleList = document.getElementById("rule-list");
const emptyState = document.getElementById("empty-state");
const debugSummary = document.getElementById("debug-summary");
const debugButton = document.getElementById("debug-button");

function assertElement(element: HTMLElement | null, name: string): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required popup element: ${name}`);
  }

  return element;
}

const siteLabelElement = assertElement(siteLabel, "site-label");
const ruleCountElement = assertElement(ruleCount, "rule-count");
const siteStateElement = assertElement(siteState, "site-state");
const globalStateElement = assertElement(globalState, "global-state");
const statusElement = assertElement(status, "status");
const pickButtonElement = assertElement(pickButton, "pick-button") as HTMLButtonElement;
const toggleSiteButtonElement = assertElement(toggleSiteButton, "toggle-site-button") as HTMLButtonElement;
const toggleGlobalButtonElement = assertElement(toggleGlobalButton, "toggle-global-button") as HTMLButtonElement;
const refreshButtonElement = assertElement(refreshButton, "refresh-button") as HTMLButtonElement;
const clearButtonElement = assertElement(clearButton, "clear-button") as HTMLButtonElement;
const ruleListElement = assertElement(ruleList, "rule-list") as HTMLUListElement;
const emptyStateElement = assertElement(emptyState, "empty-state");
const debugSummaryElement = assertElement(debugSummary, "debug-summary");
const debugButtonElement = assertElement(debugButton, "debug-button") as HTMLButtonElement;

type ActiveTab = chrome.tabs.Tab & { id: number };
type MessagePayload = {
  enabled?: boolean;
  selector?: string;
};

function isSupportedUrl(url?: string): boolean {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

function setUnsupportedState(url?: string): void {
  siteLabelElement.textContent = url ?? "지원되지 않는 페이지";
  ruleCountElement.textContent = "인포커터는 일반 http, https 웹페이지에서만 동작합니다.";
  siteStateElement.textContent = "이 페이지는 수정할 수 없습니다";
  globalStateElement.textContent = "선택 모드는 일반 웹사이트에서만 사용할 수 있습니다";
  pickButtonElement.disabled = true;
  toggleSiteButtonElement.disabled = true;
  toggleGlobalButtonElement.disabled = true;
  clearButtonElement.disabled = true;
  ruleListElement.replaceChildren();
  emptyStateElement.hidden = false;
  emptyStateElement.textContent = "Chrome 내부 페이지와 웹스토어는 확장 기능 적용 대상이 아닙니다.";
}

async function getActiveTab(): Promise<ActiveTab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      const [tab] = tabs;
      if (tab?.id === undefined) {
        reject(new Error("현재 활성 탭을 찾을 수 없습니다."));
        return;
      }

      resolve(tab as ActiveTab);
    });
  });
}

async function sendMessageToTab(
  tabId: number,
  type: string,
  payload?: MessagePayload
): Promise<{ ok: boolean; data?: unknown }> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type, ...payload }, (response: unknown) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      if (!response || typeof response !== "object") {
        reject(new Error(`메시지 처리에 실패했습니다: ${type}`));
        return;
      }

      resolve(response as { ok: boolean; data?: unknown });
    });
  });
}

function getScriptingApi(): chrome.scripting.Static | null {
  const scriptingApi = Reflect.get(chrome, "scripting");
  if (!scriptingApi || typeof scriptingApi !== "object") {
    return null;
  }

  if (!("executeScript" in scriptingApi) || typeof scriptingApi.executeScript !== "function") {
    return null;
  }

  return scriptingApi as chrome.scripting.Static;
}

async function ensureContentScript(tabId: number): Promise<void> {
  const scriptingApi = getScriptingApi();
  if (!scriptingApi) {
    throw new Error("확장 기능을 다시 불러와야 합니다. chrome://extensions 에서 인포커터를 새로고침한 뒤 다시 시도하세요.");
  }

  await scriptingApi.executeScript({
    target: { tabId },
    files: ["src/content/index.js"]
  });
}

async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    const response = await sendMessageToTab(tabId, messageTypes.ping);
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureConnectedTab(tabId: number): Promise<void> {
  const isReady = await pingContentScript(tabId);
  if (isReady) {
    return;
  }

  await ensureContentScript(tabId);
}

async function runDiagnostics(): Promise<void> {
  const tab = await getActiveTab();
  if (!isSupportedUrl(tab.url)) {
    debugSummaryElement.textContent = "진단 결과: 이 페이지는 확장 대상이 아닙니다.";
    return;
  }

  if (!getScriptingApi()) {
    debugSummaryElement.textContent =
      "진단 결과: scripting API를 찾을 수 없습니다. chrome://extensions 에서 인포커터를 새로고침하세요.";
    return;
  }

  const beforeInjection = await pingContentScript(tab.id);
  if (beforeInjection) {
    debugSummaryElement.textContent = "진단 결과: 콘텐츠 스크립트가 이미 연결되어 있습니다.";
    return;
  }

  await ensureContentScript(tab.id);
  const afterInjection = await pingContentScript(tab.id);
  debugSummaryElement.textContent = afterInjection
    ? "진단 결과: 콘텐츠 스크립트를 다시 연결했습니다."
    : "진단 결과: 콘텐츠 스크립트 연결에 실패했습니다.";
}

async function askContentScript<T>(type: string): Promise<T> {
  const tab = await getActiveTab();
  await ensureConnectedTab(tab.id);
  const response = await sendMessageToTab(tab.id, type);

  if (!response.ok || response.data === undefined) {
    throw new Error(`메시지 처리에 실패했습니다: ${type}`);
  }

  return response.data as T;
}

async function mutateContentScript<T>(type: string, payload?: MessagePayload): Promise<T> {
  const tab = await getActiveTab();
  await ensureConnectedTab(tab.id);
  const response = await sendMessageToTab(tab.id, type, payload);

  if (!response.ok || response.data === undefined) {
    throw new Error(`메시지 처리에 실패했습니다: ${type}`);
  }

  return response.data as T;
}

function buildRuleList(state: ActiveSiteState): void {
  const items = state.selectors.map((selector) => {
    const item = document.createElement("li");
    item.className = "popup__rule-item";

    const selectorText = document.createElement("code");
    selectorText.className = "popup__rule-selector";
    selectorText.textContent = selector;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "popup__rule-remove";
    removeButton.textContent = "삭제";
    removeButton.addEventListener("click", () => {
      void (async () => {
        const nextState = await mutateContentScript<ActiveSiteState>(messageTypes.removeSiteRule, { selector });
        renderState(nextState);
        statusElement.textContent = "선택자를 삭제했습니다.";
      })().catch((error: unknown) => {
        statusElement.textContent = error instanceof Error ? error.message : "선택자 삭제에 실패했습니다.";
      });
    });

    item.append(selectorText, removeButton);
    return item;
  });

  ruleListElement.replaceChildren(...items);
  emptyStateElement.hidden = items.length > 0;
}

function renderState(state: ActiveSiteState): void {
  siteLabelElement.textContent = state.hostname;
  ruleCountElement.textContent = `저장된 선택자 ${state.selectorCount}개`;
  siteStateElement.textContent = state.siteEnabled ? "이 사이트에서 사용 중" : "이 사이트에서 꺼짐";
  globalStateElement.textContent = state.globalEnabled ? "확장 기능이 켜져 있음" : "확장 기능이 전체 꺼짐";
  toggleSiteButtonElement.textContent = state.siteEnabled ? "이 사이트에서 끄기" : "이 사이트에서 켜기";
  toggleGlobalButtonElement.textContent = state.globalEnabled ? "전체 끄기" : "전체 켜기";
  pickButtonElement.disabled = !state.globalEnabled;
  buildRuleList(state);
}

async function refreshState(): Promise<void> {
  statusElement.textContent = "";
  const tab = await getActiveTab();
  if (!isSupportedUrl(tab.url)) {
    setUnsupportedState(tab.url);
    debugSummaryElement.textContent = "진단 결과: chrome 내부 페이지라 콘텐츠 스크립트를 붙일 수 없습니다.";
    return;
  }

  debugSummaryElement.textContent = "진단 결과: 콘텐츠 스크립트 연결 상태를 확인하는 중...";
  await ensureConnectedTab(tab.id);
  debugSummaryElement.textContent = "진단 결과: 콘텐츠 스크립트 연결됨.";
  const state = await askContentScript<ActiveSiteState>(messageTypes.getPageState);
  renderState(state);
}

pickButtonElement.addEventListener("click", () => {
  void (async () => {
    const tab = await getActiveTab();
    await ensureConnectedTab(tab.id);
    await sendMessageToTab(tab.id, messageTypes.startPicker);
    statusElement.textContent = "선택 모드를 시작했습니다. 페이지로 돌아가서 숨길 요소를 클릭하세요.";
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "선택 모드 시작에 실패했습니다.";
  });
});

debugButtonElement.addEventListener("click", () => {
  void runDiagnostics().catch((error: unknown) => {
    debugSummaryElement.textContent = error instanceof Error ? error.message : "진단 실행에 실패했습니다.";
  });
});

toggleSiteButtonElement.addEventListener("click", () => {
  void (async () => {
    const currentState = await askContentScript<ActiveSiteState>(messageTypes.getPageState);
    const nextState = await mutateContentScript<ActiveSiteState>(messageTypes.toggleSiteEnabled, {
      enabled: !currentState.siteEnabled
    });
    renderState(nextState);
    statusElement.textContent = nextState.siteEnabled ? "이 사이트에서 다시 켰습니다." : "이 사이트에서 껐습니다.";
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "사이트 상태 변경에 실패했습니다.";
  });
});

toggleGlobalButtonElement.addEventListener("click", () => {
  void (async () => {
    const currentState = await askContentScript<ActiveSiteState>(messageTypes.getPageState);
    const nextState = await mutateContentScript<ActiveSiteState>(messageTypes.toggleGlobalEnabled, {
      enabled: !currentState.globalEnabled
    });
    renderState(nextState);
    statusElement.textContent = nextState.globalEnabled ? "확장 기능을 전체 켰습니다." : "확장 기능을 전체 껐습니다.";
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "전체 상태 변경에 실패했습니다.";
  });
});

refreshButtonElement.addEventListener("click", () => {
  void refreshState().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "새로고침에 실패했습니다.";
  });
});

clearButtonElement.addEventListener("click", () => {
  void (async () => {
    const state = await askContentScript<ActiveSiteState>(messageTypes.clearSiteRules);
    renderState(state);
    statusElement.textContent = "이 사이트 규칙을 모두 삭제했습니다.";
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "이 사이트 규칙 삭제에 실패했습니다.";
  });
});

void refreshState().catch((error: unknown) => {
  statusElement.textContent = error instanceof Error ? error.message : "팝업 초기화에 실패했습니다.";
});
