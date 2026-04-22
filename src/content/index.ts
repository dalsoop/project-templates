const STORAGE_KEY = "infocutter.ruleStore";
const STORAGE_VERSION = 2;
const STYLE_ELEMENT_ID = "infocutter-style-rules";
const PICKER_OVERLAY_ID = "infocutter-picker-overlay";

const messageTypes = {
  ping: "infocutter/ping",
  getPageState: "infocutter/get-page-state",
  startPicker: "infocutter/start-picker",
  hideLastContextTarget: "infocutter/hide-last-context-target",
  clearSiteRules: "infocutter/clear-site-rules",
  removeSiteRule: "infocutter/remove-site-rule",
  toggleSiteEnabled: "infocutter/toggle-site-enabled",
  toggleGlobalEnabled: "infocutter/toggle-global-enabled"
} as const;

const infocutterGlobal = globalThis as typeof globalThis & {
  __INFOCUTTER_CONTENT_LOADED__?: boolean;
};

if (!infocutterGlobal.__INFOCUTTER_CONTENT_LOADED__) {
infocutterGlobal.__INFOCUTTER_CONTENT_LOADED__ = true;

type SiteRuleSet = {
  enabled: boolean;
  selectors: string[];
  updatedAt: string;
};

type RuleStore = {
  version: 2;
  settings: {
    globalEnabled: boolean;
  };
  sites: Record<string, SiteRuleSet>;
};

type ActiveSiteState = {
  globalEnabled: boolean;
  hostname: string;
  selectors: string[];
  selectorCount: number;
  siteEnabled: boolean;
  updatedAt: string;
};

let pickerStop: (() => void) | null = null;
let lastContextTarget: Element | null = null;

function emptySiteRuleSet(): SiteRuleSet {
  return {
    enabled: true,
    selectors: [],
    updatedAt: new Date(0).toISOString()
  };
}

function emptyStore(): RuleStore {
  return {
    version: STORAGE_VERSION,
    settings: {
      globalEnabled: true
    },
    sites: {}
  };
}

function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function normalizeSiteRuleSet(rawSiteRules: unknown): SiteRuleSet {
  const partialSiteRules =
    rawSiteRules && typeof rawSiteRules === "object"
      ? (rawSiteRules as {
          enabled?: boolean;
          selectors?: unknown;
          updatedAt?: unknown;
        })
      : {};

  return {
    enabled: partialSiteRules.enabled ?? true,
    selectors: Array.isArray(partialSiteRules.selectors)
      ? partialSiteRules.selectors.filter((selector): selector is string => typeof selector === "string")
      : [],
    updatedAt: typeof partialSiteRules.updatedAt === "string" ? partialSiteRules.updatedAt : new Date(0).toISOString()
  };
}

function normalizeStore(candidate: unknown): RuleStore {
  if (!candidate || typeof candidate !== "object") {
    return emptyStore();
  }

  const partialStore = candidate as {
    settings?: unknown;
    sites?: unknown;
    version?: number;
  };

  const rawSites =
    partialStore.sites && typeof partialStore.sites === "object"
      ? partialStore.sites
      : {};

  const sites: Record<string, SiteRuleSet> = {};
  for (const [hostname, rawSiteRules] of Object.entries(rawSites)) {
    sites[hostname] = normalizeSiteRuleSet(rawSiteRules);
  }

  if (partialStore.version === 1) {
    return {
      version: STORAGE_VERSION,
      settings: {
        globalEnabled: true
      },
      sites
    };
  }

  if (partialStore.version !== STORAGE_VERSION) {
    return emptyStore();
  }

  return {
    version: STORAGE_VERSION,
    settings: {
      globalEnabled:
        partialStore.settings &&
        typeof partialStore.settings === "object" &&
        "globalEnabled" in partialStore.settings &&
        typeof partialStore.settings.globalEnabled === "boolean"
          ? partialStore.settings.globalEnabled
          : true
    },
    sites
  };
}

async function readStore(): Promise<RuleStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const candidate: unknown = result[STORAGE_KEY];
  return normalizeStore(candidate);
}

async function writeStore(store: RuleStore): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: store
  });
}

async function addSiteRule(hostname: string, selector: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    enabled: true,
    selectors: current.selectors.includes(selector) ? current.selectors : [...current.selectors, selector],
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

async function removeSiteRule(hostname: string, selector: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    ...current,
    selectors: current.selectors.filter((existingSelector) => existingSelector !== selector),
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

async function clearSiteRules(hostname: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    ...current,
    selectors: [],
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

async function setSiteEnabled(hostname: string, enabled: boolean): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    ...current,
    enabled,
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

async function setGlobalEnabled(globalEnabled: boolean): Promise<RuleStore> {
  const store = await readStore();
  const next: RuleStore = {
    ...store,
    settings: {
      globalEnabled
    }
  };

  await writeStore(next);
  return next;
}

async function readActiveSiteState(url: string): Promise<ActiveSiteState> {
  const store = await readStore();
  const hostname = hostnameFromUrl(url);
  const siteRules = store.sites[hostname] ?? emptySiteRuleSet();

  return {
    globalEnabled: store.settings.globalEnabled,
    hostname,
    selectors: [...siteRules.selectors],
    selectorCount: siteRules.selectors.length,
    siteEnabled: siteRules.enabled,
    updatedAt: siteRules.updatedAt
  };
}

function escapeSelector(value: string): string {
  return CSS.escape(value);
}

function isUniqueSelector(selector: string, root: Document = document): boolean {
  return root.querySelectorAll(selector).length === 1;
}

function stableClasses(element: Element): string[] {
  return Array.from(element.classList)
    .filter((className) => /^[a-z][a-z0-9_-]{1,30}$/i.test(className))
    .slice(0, 3);
}

function attributeSelector(element: Element): string | null {
  const stableAttributes = ["data-testid", "data-test", "data-qa", "name", "role", "aria-label"];

  for (const attribute of stableAttributes) {
    const value = element.getAttribute(attribute);
    if (value && value.length <= 80) {
      return `[${attribute}="${escapeSelector(value)}"]`;
    }
  }

  return null;
}

function nthOfTypeSelector(element: Element): string {
  const parent = element.parentElement;
  if (!parent) {
    return element.localName;
  }

  const siblings = Array.from(parent.children).filter((child) => child.localName === element.localName);
  const index = siblings.indexOf(element) + 1;
  return `${element.localName}:nth-of-type(${index})`;
}

function simpleSelector(element: Element): string {
  const id = element.getAttribute("id");
  if (id) {
    const byId = `#${escapeSelector(id)}`;
    if (isUniqueSelector(byId)) {
      return byId;
    }
  }

  const attr = attributeSelector(element);
  if (attr) {
    const byAttr = `${element.localName}${attr}`;
    if (isUniqueSelector(byAttr)) {
      return byAttr;
    }
  }

  const classes = stableClasses(element);
  if (classes.length > 0) {
    const classSelector = `${element.localName}${classes.map((className) => `.${escapeSelector(className)}`).join("")}`;
    if (isUniqueSelector(classSelector)) {
      return classSelector;
    }
  }

  return nthOfTypeSelector(element);
}

function buildSelector(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    segments.unshift(simpleSelector(current));
    const selector = segments.join(" > ");

    if (isUniqueSelector(selector)) {
      return selector;
    }

    current = current.parentElement;
  }

  return segments.join(" > ");
}

function selectorCss(selectors: string[]): string {
  return selectors.map((selector) => `${selector} { display: none !important; }`).join("\n");
}

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
  label.textContent = "인포커터 선택 모드: 숨길 요소를 클릭하거나 Escape로 취소하세요.";
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

    await hideTargetElement(target);
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

    if (type === messageTypes.ping) {
      sendResponse({
        ok: true,
        data: {
          ready: true,
          url: window.location.href
        }
      });
      return;
    }

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
    console.error("콘텐츠 스크립트 메시지 처리에 실패했습니다", error);
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
}
