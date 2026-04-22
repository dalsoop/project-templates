import { PICKER_OVERLAY_ID, STORAGE_KEY, STYLE_ELEMENT_ID } from "../shared/constants.js";
import { messageTypes } from "../shared/messages.js";
import { buildSelector, selectorCss } from "../shared/selector.js";
import {
  addSiteRule,
  clearSiteRules,
  hostnameFromUrl,
  readActiveSiteState,
  removeSiteRule,
  setGlobalEnabled,
  setSiteEnabled
} from "../shared/storage.js";

let pickerStop: (() => void) | null = null;
let lastContextTarget: Element | null = null;

function ensureStyleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ELEMENT_ID);
  if (existing instanceof HTMLStyleElement) {
    return existing;
  }

  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  document.documentElement.append(style);
  return style;
}

async function renderRules(): Promise<void> {
  const activeSiteState = await readActiveSiteState(window.location.href);
  const style = ensureStyleElement();

  if (!activeSiteState.globalEnabled || !activeSiteState.siteEnabled) {
    style.textContent = "";
    return;
  }

  style.textContent = selectorCss(activeSiteState.selectors);
}

function removePickerArtifacts(): void {
  document.getElementById(PICKER_OVERLAY_ID)?.remove();
  document.getElementById(`${PICKER_OVERLAY_ID}-label`)?.remove();
}

function buildOverlay(): HTMLDivElement {
  removePickerArtifacts();
  const overlay = document.createElement("div");
  overlay.id = PICKER_OVERLAY_ID;
  overlay.style.position = "fixed";
  overlay.style.pointerEvents = "none";
  overlay.style.border = "2px solid #d97706";
  overlay.style.background = "rgba(217, 119, 6, 0.12)";
  overlay.style.zIndex = "2147483647";
  overlay.style.transition = "all 80ms ease-out";
  document.documentElement.append(overlay);
  return overlay;
}

function buildPickerLabel(): HTMLDivElement {
  const label = document.createElement("div");
  label.id = `${PICKER_OVERLAY_ID}-label`;
  label.style.position = "fixed";
  label.style.right = "16px";
  label.style.bottom = "16px";
  label.style.padding = "10px 12px";
  label.style.background = "#231f17";
  label.style.color = "#f7f4eb";
  label.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';
  label.style.zIndex = "2147483647";
  label.style.pointerEvents = "none";
  label.textContent = "Infocutter pick mode: click an element, or press Escape.";
  document.documentElement.append(label);
  return label;
}

function startPicker(): void {
  pickerStop?.();

  const overlay = buildOverlay();
  const label = buildPickerLabel();
  let active = true;

  const updateOverlay = (event: MouseEvent): void => {
    if (!active) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const rect = target.getBoundingClientRect();
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  };

  const stopPicker = (): void => {
    active = false;
    document.removeEventListener("mousemove", updateOverlay, true);
    document.removeEventListener("click", handleClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
    overlay.remove();
    label.remove();
    pickerStop = null;
  };

  pickerStop = stopPicker;

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      stopPicker();
    }
  };

  const handleClick = async (event: MouseEvent): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const target = event.target;
    if (!(target instanceof Element)) {
      stopPicker();
      return;
    }

    const selector = buildSelector(target);
    await addSiteRule(hostnameFromUrl(window.location.href), selector);
    await renderRules();
    stopPicker();
  };

  document.addEventListener("mousemove", updateOverlay, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
}

async function hideTargetElement(target: Element): Promise<string> {
  const selector = buildSelector(target);
  await addSiteRule(hostnameFromUrl(window.location.href), selector);
  await renderRules();
  return selector;
}

document.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target;
    lastContextTarget = target instanceof Element ? target : null;
  },
  true
);

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  void (async () => {
    if (!message || typeof message !== "object") {
      sendResponse({ ok: false });
      return;
    }

    const type = "type" in message ? message.type : null;

    if (type === messageTypes.getPageState) {
      sendResponse({
        ok: true,
        data: await readActiveSiteState(window.location.href)
      });
      return;
    }

    if (type === messageTypes.startPicker) {
      startPicker();
      sendResponse({ ok: true });
      return;
    }

    if (type === messageTypes.hideLastContextTarget) {
      if (!lastContextTarget) {
        sendResponse({ ok: false });
        return;
      }

      const selector = await hideTargetElement(lastContextTarget);
      sendResponse({
        ok: true,
        data: {
          selector,
          state: await readActiveSiteState(window.location.href)
        }
      });
      return;
    }

    if (type === messageTypes.clearSiteRules) {
      await clearSiteRules(hostnameFromUrl(window.location.href));
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(window.location.href)
      });
      return;
    }

    if (type === messageTypes.removeSiteRule) {
      const selector = "selector" in message && typeof message.selector === "string" ? message.selector : null;
      if (!selector) {
        sendResponse({ ok: false });
        return;
      }

      await removeSiteRule(hostnameFromUrl(window.location.href), selector);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(window.location.href)
      });
      return;
    }

    if (type === messageTypes.toggleSiteEnabled) {
      const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : null;
      if (enabled === null) {
        sendResponse({ ok: false });
        return;
      }

      await setSiteEnabled(hostnameFromUrl(window.location.href), enabled);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(window.location.href)
      });
      return;
    }

    if (type === messageTypes.toggleGlobalEnabled) {
      const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : null;
      if (enabled === null) {
        sendResponse({ ok: false });
        return;
      }

      await setGlobalEnabled(enabled);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(window.location.href)
      });
      return;
    }

    sendResponse({ ok: false });
  })().catch((error: unknown) => {
    console.error("Content script message handling failed", error);
    sendResponse({ ok: false });
  });

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !(STORAGE_KEY in changes)) {
    return;
  }

  void renderRules();
});

void renderRules();
