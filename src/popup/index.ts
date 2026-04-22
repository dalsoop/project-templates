import { messageTypes } from "../shared/messages.js";
import type { ActiveSiteState } from "../shared/types.js";

const siteLabel = document.getElementById("site-label");
const ruleCount = document.getElementById("rule-count");
const status = document.getElementById("status");
const pickButton = document.getElementById("pick-button");
const refreshButton = document.getElementById("refresh-button");
const clearButton = document.getElementById("clear-button");

function assertElement(element: HTMLElement | null, name: string): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required popup element: ${name}`);
  }

  return element;
}

const siteLabelElement = assertElement(siteLabel, "site-label") as HTMLParagraphElement;
const ruleCountElement = assertElement(ruleCount, "rule-count") as HTMLParagraphElement;
const statusElement = assertElement(status, "status") as HTMLParagraphElement;
const pickButtonElement = assertElement(pickButton, "pick-button") as HTMLButtonElement;
const refreshButtonElement = assertElement(refreshButton, "refresh-button") as HTMLButtonElement;
const clearButtonElement = assertElement(clearButton, "clear-button") as HTMLButtonElement;

type ActiveTab = chrome.tabs.Tab & { id: number };

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

async function sendMessageToTab(tabId: number, type: string): Promise<{ ok: boolean; data?: unknown }> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type }, (response: unknown) => {
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

function renderState(state: ActiveSiteState): void {
  siteLabelElement.textContent = state.hostname;
  ruleCountElement.textContent = `${state.selectorCount} saved selector${state.selectorCount === 1 ? "" : "s"}`;
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
