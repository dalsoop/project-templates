const STORAGE_KEY = "infocutter.ruleStore";
const STORAGE_VERSION = 2;
const STYLE_ELEMENT_ID = "infocutter-style-rules";
const PICKER_OVERLAY_ID = "infocutter-picker-overlay";
const PICKER_PREVIEW_STYLE_ID = "infocutter-preview-style";
const PICKER_PREVIEW_PANEL_ID = "infocutter-preview-panel";

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
  rules: {
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }[];
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
  rules: {
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }[];
  selectorCount: number;
  siteEnabled: boolean;
  updatedAt: string;
};

let pickerStop: (() => void) | null = null;
let lastContextTarget: Element | null = null;

function emptySiteRuleSet(): SiteRuleSet {
  return {
    enabled: true,
    rules: [],
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

function ownerPageUrl(): string {
  if (window.top === window) {
    return window.location.href;
  }

  return document.referrer || window.location.href;
}

function currentFrameScope(): string | null {
  if (window.top === window) {
    return null;
  }

  return `${window.location.origin}${window.location.pathname}`;
}

function normalizeSiteRuleSet(rawSiteRules: unknown): SiteRuleSet {
  const partialSiteRules =
    rawSiteRules && typeof rawSiteRules === "object"
      ? rawSiteRules
      : {};

  const enabledValue: unknown = Reflect.get(partialSiteRules, "enabled");
  const rulesValue: unknown = Reflect.get(partialSiteRules, "rules");
  const selectorsValue: unknown = Reflect.get(partialSiteRules, "selectors");
  const updatedAtValue: unknown = Reflect.get(partialSiteRules, "updatedAt");

  const rawRules: unknown[] = Array.isArray(rulesValue)
    ? rulesValue
    : Array.isArray(selectorsValue)
      ? selectorsValue.map((selector: unknown) => ({
        createdAt: new Date(0).toISOString(),
        frameScope: null,
        selector
      }))
      : [];

  const rules = rawRules
    .map((rule) => {
      if (typeof rule === "string") {
        return {
          createdAt: new Date(0).toISOString(),
          frameScope: null,
          selector: rule
        };
      }

      if (!rule || typeof rule !== "object") {
        return null;
      }

      const candidate = rule as {
        createdAt?: unknown;
        frameScope?: unknown;
        selector?: unknown;
      };

      if (typeof candidate.selector !== "string") {
        return null;
      }

      return {
        createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
        frameScope: typeof candidate.frameScope === "string" ? candidate.frameScope : null,
        selector: candidate.selector
      };
    })
    .filter((rule): rule is SiteRuleSet["rules"][number] => rule !== null);

  return {
    enabled: typeof enabledValue === "boolean" ? enabledValue : true,
    rules,
    updatedAt: typeof updatedAtValue === "string" ? updatedAtValue : new Date(0).toISOString()
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

async function addSiteRule(hostname: string, selector: string, frameScope: string | null): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const nextRule = {
    createdAt: new Date().toISOString(),
    frameScope,
    selector
  };
  const next: SiteRuleSet = {
    enabled: true,
    rules: current.rules.some((rule) => rule.selector === selector && rule.frameScope === frameScope)
      ? current.rules
      : [...current.rules, nextRule],
    updatedAt: new Date().toISOString()
  };

  store.sites[hostname] = next;
  await writeStore(store);
  return next;
}

async function removeSiteRule(hostname: string, selector: string, frameScope: string | null): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = store.sites[hostname] ?? emptySiteRuleSet();
  const next: SiteRuleSet = {
    ...current,
    rules: current.rules.filter((rule) => !(rule.selector === selector && rule.frameScope === frameScope)),
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
    rules: [],
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
    rules: [...siteRules.rules],
    selectorCount: siteRules.rules.length,
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

function maybeStableClassName(className: string): boolean {
  if (!/^[a-z][a-z0-9_-]{1,40}$/i.test(className)) {
    return false;
  }

  const digitCount = className.replace(/\D/g, "").length;
  return digitCount <= 3;
}

function stableClasses(element: Element): string[] {
  return Array.from(element.classList).filter(maybeStableClassName).slice(0, 3);
}

function attributeSelectors(element: Element): string[] {
  const stableAttributes = ["data-testid", "data-test", "data-qa", "aria-label", "title", "alt"];
  const selectors: string[] = [];

  for (const attribute of stableAttributes) {
    const value = element.getAttribute(attribute);
    if (value && value.length <= 80) {
      selectors.push(`${element.localName}[${attribute}="${escapeSelector(value)}"]`);
      selectors.push(`[${attribute}="${escapeSelector(value)}"]`);
    }
  }

  return selectors;
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

function classSelectors(element: Element): string[] {
  const classes = stableClasses(element);
  const selectors: string[] = [];

  for (let size = 1; size <= classes.length; size += 1) {
    const joined = classes.slice(0, size).map((className) => `.${escapeSelector(className)}`).join("");
    selectors.push(`${element.localName}${joined}`);
    selectors.push(joined);
  }

  return selectors;
}

function simpleCandidates(element: Element, options?: { allowNth?: boolean }): string[] {
  const selectors: string[] = [];
  const id = element.getAttribute("id");

  if (id) {
    selectors.push(`#${escapeSelector(id)}`);
    selectors.push(`${element.localName}#${escapeSelector(id)}`);
  }

  selectors.push(...attributeSelectors(element));
  selectors.push(...classSelectors(element));
  selectors.push(element.localName);

  if (options?.allowNth) {
    selectors.push(nthOfTypeSelector(element));
  }

  return Array.from(new Set(selectors));
}

function pathSelector(ancestor: Element, target: Element): string {
  const segments: string[] = [];
  let current: Element | null = target;

  while (current && current !== ancestor) {
    const candidates = simpleCandidates(current, { allowNth: true });
    segments.unshift(candidates[0] ?? current.localName);
    current = current.parentElement;
  }

  const anchor = simpleCandidates(ancestor, { allowNth: false }).find((selector) => isUniqueSelector(selector))
    ?? ancestor.localName;

  return [anchor, ...segments].join(" > ");
}

function buildSelectorCandidates(element: Element): string[] {
  const seen = new Set<string>();
  const selectors: string[] = [];

  const pushIfUseful = (selector: string): void => {
    if (!selector || seen.has(selector)) {
      return;
    }

    seen.add(selector);
    selectors.push(selector);
  };

  for (const selector of simpleCandidates(element, { allowNth: true })) {
    if (isUniqueSelector(selector)) {
      pushIfUseful(selector);
    }
  }

  let ancestor = element.parentElement;
  let depth = 0;

  while (ancestor && depth < 4) {
    const selector = pathSelector(ancestor, element);
    pushIfUseful(selector);
    if (isUniqueSelector(selector)) {
      break;
    }

    ancestor = ancestor.parentElement;
    depth += 1;
  }

  if (selectors.length === 0) {
    pushIfUseful(nthOfTypeSelector(element));
  }

  return selectors;
}

function buildSelector(element: Element): string {
  return buildSelectorCandidates(element)[0] ?? element.localName;
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
  const activeSiteState = await readActiveSiteState(ownerPageUrl());
  const style = ensureStyleElement();
  const frameScope = currentFrameScope();

  if (!activeSiteState.globalEnabled || !activeSiteState.siteEnabled) {
    style.textContent = "";
    return;
  }

  style.textContent = selectorCss(
    activeSiteState.rules
      .filter((rule) => rule.frameScope === frameScope)
      .map((rule) => rule.selector)
  );
}

function removePickerArtifacts(): void {
  document.getElementById(PICKER_OVERLAY_ID)?.remove();
  document.getElementById(`${PICKER_OVERLAY_ID}-label`)?.remove();
  document.getElementById(PICKER_PREVIEW_PANEL_ID)?.remove();
  document.getElementById(PICKER_PREVIEW_STYLE_ID)?.remove();
  document.documentElement.style.cursor = "";
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

function applyPreviewSelector(selector: string): void {
  let style = document.getElementById(PICKER_PREVIEW_STYLE_ID);
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement("style");
    style.id = PICKER_PREVIEW_STYLE_ID;
    document.documentElement.append(style);
  }

  style.textContent = `${selector} { display: none !important; }`;
}

function buildPreviewPanel(
  selector: string,
  index: number,
  total: number,
  matches: number,
  onApply: () => void,
  onNext: () => void,
  onCancel: () => void
): HTMLDivElement {
  document.getElementById(PICKER_PREVIEW_PANEL_ID)?.remove();

  const panel = document.createElement("div");
  panel.id = PICKER_PREVIEW_PANEL_ID;
  panel.style.position = "fixed";
  panel.style.right = "16px";
  panel.style.bottom = "64px";
  panel.style.width = "320px";
  panel.style.padding = "12px";
  panel.style.background = "#231f17";
  panel.style.color = "#f7f4eb";
  panel.style.zIndex = "2147483647";
  panel.style.boxShadow = "0 12px 30px rgba(0,0,0,0.24)";
  panel.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';

  const title = document.createElement("div");
  title.textContent = `미리보기 ${index + 1}/${total}`;
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";

  const meta = document.createElement("div");
  meta.textContent = `현재 선택자는 ${matches}개 요소에 적용됩니다.`;
  meta.style.marginBottom = "8px";
  meta.style.color = "#f5d6b0";

  const code = document.createElement("code");
  code.textContent = selector;
  code.style.display = "block";
  code.style.whiteSpace = "pre-wrap";
  code.style.wordBreak = "break-word";
  code.style.padding = "10px";
  code.style.background = "rgba(255,255,255,0.08)";
  code.style.marginBottom = "10px";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = "적용";
  applyButton.style.flex = "1";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.textContent = total > 1 ? "다른 선택자" : "다른 선택자 없음";
  nextButton.disabled = total <= 1;
  nextButton.style.flex = "1";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "취소";
  cancelButton.style.flex = "1";

  for (const button of [applyButton, nextButton, cancelButton]) {
    button.style.border = "1px solid #f7f4eb";
    button.style.background = "transparent";
    button.style.color = "#f7f4eb";
    button.style.padding = "8px 10px";
    button.style.cursor = "pointer";
  }

  applyButton.addEventListener("click", onApply);
  nextButton.addEventListener("click", onNext);
  cancelButton.addEventListener("click", onCancel);

  actions.append(applyButton, nextButton, cancelButton);
  panel.append(title, meta, code, actions);
  document.documentElement.append(panel);
  return panel;
}

function startPicker(): void {
  pickerStop?.();

  const overlay = buildOverlay();
  buildPickerLabel();
  let active = true;
  document.documentElement.style.cursor = "crosshair";

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
    removePickerArtifacts();
    pickerStop = null;
  };

  pickerStop = stopPicker;

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      stopPicker();
    }
  };

  const handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const target = event.target;
    if (!(target instanceof Element)) {
      stopPicker();
      return;
    }

    active = false;
    document.removeEventListener("mousemove", updateOverlay, true);
    document.removeEventListener("click", handleClick, true);

    const candidates = buildSelectorCandidates(target);
    let candidateIndex = 0;

    const renderCandidate = (): void => {
      const selector = candidates[candidateIndex] ?? buildSelector(target);
      applyPreviewSelector(selector);
      buildPreviewPanel(
        selector,
        candidateIndex,
        candidates.length,
        document.querySelectorAll(selector).length,
        () => {
          void (async () => {
            await addSiteRule(hostnameFromUrl(ownerPageUrl()), selector, currentFrameScope());
            await renderRules();
            stopPicker();
          })();
        },
        () => {
          candidateIndex = (candidateIndex + 1) % candidates.length;
          renderCandidate();
        },
        () => {
          stopPicker();
        }
      );
    };

    renderCandidate();
  };

  document.addEventListener("mousemove", updateOverlay, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
}

async function hideTargetElement(target: Element): Promise<string> {
  const selector = buildSelector(target);
  await addSiteRule(hostnameFromUrl(ownerPageUrl()), selector, currentFrameScope());
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
        data: await readActiveSiteState(ownerPageUrl())
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
      await clearSiteRules(hostnameFromUrl(ownerPageUrl()));
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    if (type === messageTypes.removeSiteRule) {
      const selector = "selector" in message && typeof message.selector === "string" ? message.selector : null;
      const frameScope =
        "frameScope" in message && typeof message.frameScope === "string"
          ? message.frameScope
          : null;
      if (!selector) {
        sendResponse({ ok: false });
        return;
      }

      await removeSiteRule(hostnameFromUrl(ownerPageUrl()), selector, frameScope);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    if (type === messageTypes.toggleSiteEnabled) {
      const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : null;
      if (enabled === null) {
        sendResponse({ ok: false });
        return;
      }

      await setSiteEnabled(hostnameFromUrl(ownerPageUrl()), enabled);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
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
        data: await readActiveSiteState(ownerPageUrl())
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
