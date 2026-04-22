import { PICKER_OVERLAY_ID, STYLE_ELEMENT_ID } from "../shared/constants.js";
import { messageTypes } from "../shared/messages.js";
import { buildSelector, selectorCss } from "../shared/selector.js";
import { addSiteRule, clearSiteRules, hostnameFromUrl, readActiveSiteState, readSiteRules } from "../shared/storage.js";

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
  const hostname = hostnameFromUrl(window.location.href);
  const siteRules = await readSiteRules(hostname);
  const style = ensureStyleElement();
  style.textContent = selectorCss(siteRules.selectors);
}

function removePickerOverlay(): void {
  document.getElementById(PICKER_OVERLAY_ID)?.remove();
}

function buildOverlay(): HTMLDivElement {
  removePickerOverlay();
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

function startPicker(): void {
  const overlay = buildOverlay();
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
    removePickerOverlay();
  };

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

    if (type === messageTypes.clearSiteRules) {
      await clearSiteRules(hostnameFromUrl(window.location.href));
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

void renderRules();
