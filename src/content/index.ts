(() => {
const STORAGE_KEY = "infocutter.ruleStore";
const STORAGE_VERSION = 3;
const STYLE_ELEMENT_ID = "infocutter-style-rules";
const PICKER_OVERLAY_ID = "infocutter-picker-overlay";
const PICKER_PREVIEW_STYLE_ID = "infocutter-preview-style";
const PICKER_PREVIEW_PANEL_ID = "infocutter-preview-panel";
const PICKER_FRAME_MESSAGE_TYPE = "infocutter/start-picker-in-frame";
const PICKER_FRAME_ACK_TYPE = "infocutter/start-picker-in-frame-ack";

const messageTypes = {
  updatePickerFocus: "infocutter/update-picker-focus",
  ping: "infocutter/ping",
  getPageState: "infocutter/get-page-state",
  startPicker: "infocutter/start-picker",
  stopPicker: "infocutter/stop-picker",
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
  id: string;
  matchers: string[];
  name: string;
  enabled: boolean;
  rules: {
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }[];
  updatedAt: string;
};

type RuleStore = {
  version: 3;
  settings: {
    globalEnabled: boolean;
  };
  profiles: SiteRuleSet[];
};

type ActiveSiteState = {
  activeProfileId: string | null;
  activeProfileName: string | null;
  globalEnabled: boolean;
  hostname: string;
  matchers: string[];
  profileEnabled: boolean;
  rules: {
    createdAt: string;
    frameScope: string | null;
    selector: string;
  }[];
  selectorCount: number;
  updatedAt: string;
  url: string;
};

let pickerStop: (() => void) | null = null;
let lastContextTarget: Element | null = null;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptySiteRuleSet(): SiteRuleSet {
  return {
    id: generateId(),
    matchers: [],
    name: "새 프로필",
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
    profiles: []
  };
}

function hostnameFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function hostnameMatcher(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

function matcherToRegExp(matcher: string): RegExp {
  const escaped = matcher.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesUrl(matcher: string, url: string): boolean {
  return matcherToRegExp(matcher).test(url);
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

function currentFrameLabel(): string {
  const frameScope = currentFrameScope();
  return frameScope ? `iframe 안 선택 중: ${frameScope}` : "메인 문서에서 선택 중";
}

function updatePickerFocusState(focused: boolean, label: string): void {
  void chrome.runtime.sendMessage({
    type: messageTypes.updatePickerFocus,
    focused,
    frameScope: currentFrameScope(),
    label
  }).catch(() => {
    // Ignore focus reporting failures.
  });
}

function iframeAccessMode(iframeElement: HTMLIFrameElement): "same-origin" | "cross-origin" | "unknown" {
  try {
    void iframeElement.contentDocument?.body;
    return iframeElement.contentWindow ? "same-origin" : "unknown";
  } catch {
    return "cross-origin";
  }
}

function normalizeSiteRuleSet(rawSiteRules: unknown): SiteRuleSet {
  const partialSiteRules =
    rawSiteRules && typeof rawSiteRules === "object"
      ? rawSiteRules
      : {};

  const enabledValue: unknown = Reflect.get(partialSiteRules, "enabled");
  const idValue: unknown = Reflect.get(partialSiteRules, "id");
  const matchersValue: unknown = Reflect.get(partialSiteRules, "matchers");
  const nameValue: unknown = Reflect.get(partialSiteRules, "name");
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
    id: typeof idValue === "string" && idValue.length > 0 ? idValue : generateId(),
    matchers: Array.isArray(matchersValue)
      ? matchersValue.filter((matcher): matcher is string => typeof matcher === "string" && matcher.length > 0)
      : [],
    name: typeof nameValue === "string" && nameValue.length > 0 ? nameValue : "이름 없는 프로필",
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
    profiles?: unknown;
    settings?: unknown;
    sites?: unknown;
    version?: number;
  };
  const profilesValue: unknown = Reflect.get(partialStore, "profiles");

  const rawSites =
    partialStore.sites && typeof partialStore.sites === "object"
      ? partialStore.sites
      : {};

  const profiles = Array.isArray(profilesValue)
    ? profilesValue.map((profile) => normalizeSiteRuleSet(profile))
    : [];

  if (partialStore.version === 3) {
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
      profiles
    };
  }

  const migratedProfiles: SiteRuleSet[] = [];
  for (const [hostname, rawSiteRules] of Object.entries(rawSites)) {
    const normalized = normalizeSiteRuleSet(rawSiteRules);
    migratedProfiles.push({
      ...normalized,
      matchers: [hostnameMatcher(`https://${hostname}/`)],
      name: hostname
    });
  }

  if (partialStore.version !== 1 && partialStore.version !== 2) {
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
    profiles: migratedProfiles
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

function findMatchingProfile(store: RuleStore, url: string): SiteRuleSet | null {
  return store.profiles.find((profile) => profile.matchers.some((matcher) => matchesUrl(matcher, url))) ?? null;
}

async function ensureProfileForUrl(url: string): Promise<SiteRuleSet> {
  const store = await readStore();
  const existing = findMatchingProfile(store, url);
  if (existing) {
    return existing;
  }

  const profile: SiteRuleSet = {
    ...emptySiteRuleSet(),
    matchers: [hostnameMatcher(url)],
    name: hostnameFromUrl(url),
    updatedAt: new Date().toISOString()
  };

  store.profiles.push(profile);
  await writeStore(store);
  return profile;
}

async function addSiteRule(url: string, selector: string, frameScope: string | null): Promise<SiteRuleSet> {
  const store = await readStore();
  const current = findMatchingProfile(store, url) ?? (await ensureProfileForUrl(url));
  const refreshedStore = await readStore();
  const profile = refreshedStore.profiles.find((item) => item.id === current.id) ?? current;
  const nextRule = {
    createdAt: new Date().toISOString(),
    frameScope,
    selector
  };
  const next: SiteRuleSet = {
    ...profile,
    enabled: true,
    rules: profile.rules.some((rule) => rule.selector === selector && rule.frameScope === frameScope)
      ? profile.rules
      : [...profile.rules, nextRule],
    updatedAt: new Date().toISOString()
  };

  refreshedStore.profiles = refreshedStore.profiles.map((item) => (item.id === profile.id ? next : item));
  await writeStore(refreshedStore);
  return next;
}

async function removeSiteRule(profileId: string, selector: string, frameScope: string | null): Promise<SiteRuleSet | null> {
  const store = await readStore();
  const current = store.profiles.find((item) => item.id === profileId);
  if (!current) {
    return null;
  }
  const next: SiteRuleSet = {
    ...current,
    rules: current.rules.filter((rule) => !(rule.selector === selector && rule.frameScope === frameScope)),
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profileId ? next : item));
  await writeStore(store);
  return next;
}

async function clearSiteRules(profileId: string): Promise<SiteRuleSet | null> {
  const store = await readStore();
  const current = store.profiles.find((item) => item.id === profileId);
  if (!current) {
    return null;
  }
  const next: SiteRuleSet = {
    ...current,
    rules: [],
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profileId ? next : item));
  await writeStore(store);
  return next;
}

async function setSiteEnabled(profileId: string, enabled: boolean): Promise<SiteRuleSet | null> {
  const store = await readStore();
  const current = store.profiles.find((item) => item.id === profileId);
  if (!current) {
    return null;
  }
  const next: SiteRuleSet = {
    ...current,
    enabled,
    updatedAt: new Date().toISOString()
  };

  store.profiles = store.profiles.map((item) => (item.id === profileId ? next : item));
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
  const profile = findMatchingProfile(store, url);

  return {
    activeProfileId: profile?.id ?? null,
    activeProfileName: profile?.name ?? null,
    globalEnabled: store.settings.globalEnabled,
    hostname: hostnameFromUrl(url),
    matchers: profile?.matchers ?? [],
    profileEnabled: profile?.enabled ?? true,
    rules: profile?.rules ? [...profile.rules] : [],
    selectorCount: profile?.rules.length ?? 0,
    updatedAt: profile?.updatedAt ?? new Date(0).toISOString(),
    url
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

  if (!activeSiteState.globalEnabled || !activeSiteState.profileEnabled) {
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
  label.textContent = `인포커터 선택 모드: ${currentFrameLabel()} / 숨길 요소를 클릭하거나 Escape로 취소하세요.`;
  document.documentElement.append(label);
  return label;
}

function matchCountForSelector(selector: string): number | null {
  try {
    return document.querySelectorAll(selector).length;
  } catch {
    return null;
  }
}

function applyPreviewSelector(selector: string): boolean {
  let style = document.getElementById(PICKER_PREVIEW_STYLE_ID);
  if (!(style instanceof HTMLStyleElement)) {
    style = document.createElement("style");
    style.id = PICKER_PREVIEW_STYLE_ID;
    document.documentElement.append(style);
  }

  if (matchCountForSelector(selector) === null) {
    style.textContent = "";
    return false;
  }

  style.textContent = `${selector} { display: none !important; }`;
  return true;
}

function buildDepthChain(element: Element, maxDepth = 4): Element[] {
  const chain: Element[] = [element];
  let current = element.parentElement;
  let depth = 0;

  while (current && current !== document.documentElement && depth < maxDepth) {
    chain.push(current);
    current = current.parentElement;
    depth += 1;
  }

  return chain;
}

function depthLabel(depthIndex: number): string {
  if (depthIndex === 0) {
    return "현재 요소";
  }

  return `부모 ${depthIndex}단계`;
}

function buildPreviewPanel(
  depthIndex: number,
  depthTotal: number,
  selector: string,
  index: number,
  total: number,
  onApply: (selector: string) => void,
  onNarrow: () => void,
  onNext: () => void,
  onWider: () => void,
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
  meta.textContent = `${depthLabel(depthIndex)} · 현재 선택자를 확인하는 중입니다.`;
  meta.style.marginBottom = "8px";
  meta.style.color = "#f5d6b0";

  const depthMeta = document.createElement("div");
  depthMeta.textContent = `범위 단계 ${depthIndex + 1}/${depthTotal}`;
  depthMeta.style.marginBottom = "8px";
  depthMeta.style.color = "#c9ba9c";

  const input = document.createElement("textarea");
  input.value = selector;
  input.style.display = "block";
  input.style.width = "100%";
  input.style.minHeight = "84px";
  input.style.boxSizing = "border-box";
  input.style.whiteSpace = "pre-wrap";
  input.style.wordBreak = "break-word";
  input.style.padding = "10px";
  input.style.background = "rgba(255,255,255,0.08)";
  input.style.color = "#f7f4eb";
  input.style.border = "1px solid rgba(255,255,255,0.18)";
  input.style.marginBottom = "10px";
  input.style.font = '12px "SF Mono", "IBM Plex Mono", ui-monospace, monospace';

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.flexWrap = "wrap";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = "적용";
  applyButton.style.flex = "1";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "선택자 갱신";
  refreshButton.style.flex = "1";

  const narrowButton = document.createElement("button");
  narrowButton.type = "button";
  narrowButton.textContent = "더 좁게";
  narrowButton.disabled = depthIndex === 0;
  narrowButton.style.flex = "1";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.textContent = total > 1 ? "다른 선택자" : "다른 선택자 없음";
  nextButton.disabled = total <= 1;
  nextButton.style.flex = "1";

  const widerButton = document.createElement("button");
  widerButton.type = "button";
  widerButton.textContent = "더 넓게";
  widerButton.disabled = depthIndex >= depthTotal - 1;
  widerButton.style.flex = "1";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "취소";
  cancelButton.style.flex = "1";

  for (const button of [applyButton, refreshButton, narrowButton, nextButton, widerButton, cancelButton]) {
    button.style.border = "1px solid #f7f4eb";
    button.style.background = "transparent";
    button.style.color = "#f7f4eb";
    button.style.padding = "8px 10px";
    button.style.cursor = "pointer";
  }

  const updatePreview = (): void => {
    const currentSelector = input.value.trim();
    const matches = currentSelector ? matchCountForSelector(currentSelector) : null;

    if (!currentSelector) {
      meta.textContent = `${depthLabel(depthIndex)} · 선택자가 비어 있습니다.`;
      applyButton.disabled = true;
      applyPreviewSelector("__infocutter_invalid__");
      return;
    }

    if (matches === null) {
      meta.textContent = `${depthLabel(depthIndex)} · 올바르지 않은 선택자입니다.`;
      applyButton.disabled = true;
      applyPreviewSelector("__infocutter_invalid__");
      return;
    }

    meta.textContent = `${depthLabel(depthIndex)} · 현재 선택자는 ${matches}개 요소에 적용됩니다.`;
    applyButton.disabled = false;
    applyPreviewSelector(currentSelector);
  };

  applyButton.addEventListener("click", () => {
    onApply(input.value.trim());
  });
  refreshButton.addEventListener("click", updatePreview);
  narrowButton.addEventListener("click", onNarrow);
  nextButton.addEventListener("click", onNext);
  widerButton.addEventListener("click", onWider);
  cancelButton.addEventListener("click", onCancel);
  input.addEventListener("input", updatePreview);

  actions.append(applyButton, refreshButton, narrowButton, nextButton, widerButton, cancelButton);
  panel.append(title, meta, depthMeta, input, actions);
  document.documentElement.append(panel);
  updatePreview();
  return panel;
}

function buildIframePanel(
  iframeElement: HTMLIFrameElement,
  onHideFrame: () => void,
  onEnterFrame: () => void,
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
  title.textContent = "iframe 감지됨";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";

  const meta = document.createElement("div");
  const frameHint = iframeElement.getAttribute("src") ?? iframeElement.getAttribute("title") ?? "내부 프레임";
  meta.textContent = `이 요소는 iframe 입니다: ${frameHint}`;
  meta.style.marginBottom = "8px";
  meta.style.color = "#f5d6b0";
  meta.style.whiteSpace = "pre-wrap";
  meta.style.wordBreak = "break-word";

  const guide = document.createElement("div");
  const accessMode = iframeAccessMode(iframeElement);
  if (accessMode === "cross-origin") {
    guide.textContent = "이 iframe은 다른 출처일 가능성이 있어 내부 선택이 제한될 수 있습니다. 안으로 들어가지 못하면 프레임 자체 숨기기를 사용하세요.";
  } else {
    guide.textContent = "프레임 자체를 숨기거나, 프레임 안으로 들어가서 내부 요소를 다시 선택할 수 있습니다.";
  }
  guide.style.marginBottom = "10px";
  guide.style.lineHeight = "1.45";

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";

  const hideButton = document.createElement("button");
  hideButton.type = "button";
  hideButton.textContent = "프레임 숨기기";
  hideButton.style.flex = "1";

  const enterButton = document.createElement("button");
  enterButton.type = "button";
  enterButton.textContent = "프레임 안 선택";
  enterButton.style.flex = "1";
  if (accessMode === "cross-origin") {
    enterButton.textContent = "프레임 안 선택 시도";
  }

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "취소";
  cancelButton.style.flex = "1";

  for (const button of [hideButton, enterButton, cancelButton]) {
    button.style.border = "1px solid #f7f4eb";
    button.style.background = "transparent";
    button.style.color = "#f7f4eb";
    button.style.padding = "8px 10px";
    button.style.cursor = "pointer";
  }

  hideButton.addEventListener("click", onHideFrame);
  enterButton.addEventListener("click", onEnterFrame);
  cancelButton.addEventListener("click", onCancel);

  actions.append(hideButton, enterButton, cancelButton);
  panel.append(title, meta, guide, actions);
  document.documentElement.append(panel);
  return panel;
}

async function startPickerInIframe(iframeElement: HTMLIFrameElement): Promise<boolean> {
  if (!iframeElement.contentWindow) {
    return false;
  }

  const requestId = generateId();

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", handleAck);
      resolve(false);
    }, 1200);

    const handleAck = (event: MessageEvent): void => {
      const payload: unknown = event.data;
      if (!payload || typeof payload !== "object") {
        return;
      }

      const source = "source" in payload ? Reflect.get(payload, "source") : null;
      const type = "type" in payload ? Reflect.get(payload, "type") : null;
      const ackRequestId = "requestId" in payload ? Reflect.get(payload, "requestId") : null;

      if (source === "infocutter" && type === PICKER_FRAME_ACK_TYPE && ackRequestId === requestId) {
        window.clearTimeout(timeoutId);
        window.removeEventListener("message", handleAck);
        resolve(true);
      }
    };

    window.addEventListener("message", handleAck);

    iframeElement.contentWindow?.postMessage(
      {
        requestId,
        source: "infocutter",
        type: PICKER_FRAME_MESSAGE_TYPE
      },
      "*"
    );
  });
}

function startPicker(): void {
  pickerStop?.();

  const overlay = buildOverlay();
  buildPickerLabel();
  let active = true;
  document.documentElement.style.cursor = "crosshair";
  updatePickerFocusState(true, currentFrameLabel());

  const updateOverlay = (event: MouseEvent): void => {
    if (!active) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const rect = target.getBoundingClientRect();
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
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
    updatePickerFocusState(false, "선택 모드 비활성");
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

    if (target instanceof HTMLIFrameElement) {
      buildIframePanel(
        target,
        () => {
          void (async () => {
            await hideTargetElement(target);
            stopPicker();
          })();
        },
        () => {
          void (async () => {
            const accessMode = iframeAccessMode(target);
            const started = await startPickerInIframe(target);
            if (!started) {
              const label = buildPickerLabel();
              label.textContent = accessMode === "cross-origin"
                ? "cross-origin iframe이라 내부 선택을 시작하지 못했습니다. 프레임 자체 숨기기를 사용해보세요."
                : "iframe 내부 선택을 시작하지 못했습니다. 프레임 자체 숨기기를 사용해보세요.";
              return;
            }

            document.getElementById(PICKER_PREVIEW_PANEL_ID)?.remove();
            document.getElementById(PICKER_PREVIEW_STYLE_ID)?.remove();
            document.getElementById(`${PICKER_OVERLAY_ID}-label`)?.remove();
            buildPickerLabel().textContent = "iframe 안으로 들어갔습니다. 프레임 내부에서 다시 요소를 선택하세요.";
            overlay.remove();
            document.documentElement.style.cursor = "";
            pickerStop = null;
            updatePickerFocusState(false, "iframe 내부 선택 대기 중");
          })();
        },
        () => {
          stopPicker();
        }
      );
      return;
    }

    const depthChain = buildDepthChain(target);
    let depthIndex = 0;
    let candidateIndex = 0;

    const renderCandidate = (): void => {
      const focusElement = depthChain[depthIndex] ?? target;
      const candidates = buildSelectorCandidates(focusElement);
      const selector = candidates[candidateIndex] ?? buildSelector(focusElement);
      applyPreviewSelector(selector);
      buildPreviewPanel(
        depthIndex,
        depthChain.length,
        selector,
        candidateIndex,
        candidates.length,
        (selectedSelector) => {
          void (async () => {
            await addSiteRule(ownerPageUrl(), selectedSelector, currentFrameScope());
            await renderRules();
            stopPicker();
          })();
        },
        () => {
          depthIndex = Math.max(0, depthIndex - 1);
          candidateIndex = 0;
          renderCandidate();
        },
        () => {
          candidateIndex = (candidateIndex + 1) % candidates.length;
          renderCandidate();
        },
        () => {
          depthIndex = Math.min(depthChain.length - 1, depthIndex + 1);
          candidateIndex = 0;
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
  await addSiteRule(ownerPageUrl(), selector, currentFrameScope());
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

window.addEventListener("message", (event: MessageEvent) => {
  const payload: unknown = event.data;
  if (!payload || typeof payload !== "object") {
    return;
  }

  const source = "source" in payload ? Reflect.get(payload, "source") : null;
  const type = "type" in payload ? Reflect.get(payload, "type") : null;

  if (source === "infocutter" && type === PICKER_FRAME_MESSAGE_TYPE) {
    const requestId = "requestId" in payload ? Reflect.get(payload, "requestId") : null;
    if (requestId && event.source && "postMessage" in event.source && typeof event.source.postMessage === "function") {
      event.source.postMessage(
        {
          requestId,
          source: "infocutter",
          type: PICKER_FRAME_ACK_TYPE
        },
        {
          targetOrigin: "*"
        }
      );
    }
    startPicker();
  }
});

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

    if (type === messageTypes.stopPicker) {
      pickerStop?.();
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
      const currentState = await readActiveSiteState(ownerPageUrl());
      if (!currentState.activeProfileId) {
        sendResponse({ ok: false });
        return;
      }

      await clearSiteRules(currentState.activeProfileId);
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
      const profileId =
        "profileId" in message && typeof message.profileId === "string"
          ? message.profileId
          : null;
      if (!selector) {
        sendResponse({ ok: false });
        return;
      }

      if (!profileId) {
        sendResponse({ ok: false });
        return;
      }

      await removeSiteRule(profileId, selector, frameScope);
      await renderRules();
      sendResponse({
        ok: true,
        data: await readActiveSiteState(ownerPageUrl())
      });
      return;
    }

    if (type === messageTypes.toggleSiteEnabled) {
      const enabled = "enabled" in message && typeof message.enabled === "boolean" ? message.enabled : null;
      const currentState = await readActiveSiteState(ownerPageUrl());
      if (enabled === null) {
        sendResponse({ ok: false });
        return;
      }

      if (!currentState.activeProfileId) {
        sendResponse({ ok: false });
        return;
      }

      await setSiteEnabled(currentState.activeProfileId, enabled);
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
})();
