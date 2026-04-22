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

type ActiveTab = chrome.tabs.Tab & { id: number };
type MessagePayload = {
  enabled?: boolean;
  selector?: string;
};

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
        reject(new Error("Could not resolve the active tab."));
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
        reject(new Error(`Message failed: ${type}`));
        return;
      }

      resolve(response as { ok: boolean; data?: unknown });
    });
  });
}

async function askContentScript<T>(type: string): Promise<T> {
  const tab = await getActiveTab();
  const response = await sendMessageToTab(tab.id, type);

  if (!response.ok || response.data === undefined) {
    throw new Error(`Message failed: ${type}`);
  }

  return response.data as T;
}

async function mutateContentScript<T>(type: string, payload?: MessagePayload): Promise<T> {
  const tab = await getActiveTab();
  const response = await sendMessageToTab(tab.id, type, payload);

  if (!response.ok || response.data === undefined) {
    throw new Error(`Message failed: ${type}`);
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
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      void (async () => {
        const nextState = await mutateContentScript<ActiveSiteState>(messageTypes.removeSiteRule, { selector });
        renderState(nextState);
        statusElement.textContent = "Removed selector.";
      })().catch((error: unknown) => {
        statusElement.textContent = error instanceof Error ? error.message : "Failed to remove selector.";
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
  ruleCountElement.textContent = `${state.selectorCount} saved selector${state.selectorCount === 1 ? "" : "s"}`;
  siteStateElement.textContent = state.siteEnabled ? "Site is enabled" : "Site is disabled";
  globalStateElement.textContent = state.globalEnabled ? "Extension is enabled" : "Extension is disabled everywhere";
  toggleSiteButtonElement.textContent = state.siteEnabled ? "Disable on this site" : "Enable on this site";
  toggleGlobalButtonElement.textContent = state.globalEnabled ? "Disable everywhere" : "Enable everywhere";
  pickButtonElement.disabled = !state.globalEnabled;
  buildRuleList(state);
}

async function refreshState(): Promise<void> {
  statusElement.textContent = "";
  const state = await askContentScript<ActiveSiteState>(messageTypes.getPageState);
  renderState(state);
}

pickButtonElement.addEventListener("click", () => {
  void (async () => {
    const tab = await getActiveTab();
    await sendMessageToTab(tab.id, messageTypes.startPicker);
    statusElement.textContent = "Picker armed. Click an element in the page, or press Escape.";
    window.close();
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "Failed to start picker.";
  });
});

toggleSiteButtonElement.addEventListener("click", () => {
  void (async () => {
    const currentState = await askContentScript<ActiveSiteState>(messageTypes.getPageState);
    const nextState = await mutateContentScript<ActiveSiteState>(messageTypes.toggleSiteEnabled, {
      enabled: !currentState.siteEnabled
    });
    renderState(nextState);
    statusElement.textContent = nextState.siteEnabled ? "Enabled on this site." : "Disabled on this site.";
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "Failed to update site state.";
  });
});

toggleGlobalButtonElement.addEventListener("click", () => {
  void (async () => {
    const currentState = await askContentScript<ActiveSiteState>(messageTypes.getPageState);
    const nextState = await mutateContentScript<ActiveSiteState>(messageTypes.toggleGlobalEnabled, {
      enabled: !currentState.globalEnabled
    });
    renderState(nextState);
    statusElement.textContent = nextState.globalEnabled ? "Extension enabled everywhere." : "Extension disabled everywhere.";
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "Failed to update global state.";
  });
});

refreshButtonElement.addEventListener("click", () => {
  void refreshState().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "Failed to refresh.";
  });
});

clearButtonElement.addEventListener("click", () => {
  void (async () => {
    const state = await askContentScript<ActiveSiteState>(messageTypes.clearSiteRules);
    renderState(state);
    statusElement.textContent = "Cleared rules for this site.";
  })().catch((error: unknown) => {
    statusElement.textContent = error instanceof Error ? error.message : "Failed to clear site rules.";
  });
});

void refreshState().catch((error: unknown) => {
  statusElement.textContent = error instanceof Error ? error.message : "Popup failed to initialize.";
});
