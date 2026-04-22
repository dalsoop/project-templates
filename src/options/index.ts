import type { RuleProfile, RuleStore, StoredRule } from "../shared/types.js";
import { normalizeStore, writeStore } from "../shared/storage.js";

const STORAGE_KEY = "infocutter.ruleStore";

const searchInput = document.getElementById("search-input");
const scopeFilter = document.getElementById("scope-filter");
const refreshButton = document.getElementById("refresh-button");
const toggleGlobalButton = document.getElementById("toggle-global-button");
const globalStatus = document.getElementById("global-status");
const summary = document.getElementById("summary");
const siteList = document.getElementById("site-list");
const emptyState = document.getElementById("empty-state");

function assertElement(element: HTMLElement | null, name: string): HTMLElement {
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required options element: ${name}`);
  }

  return element;
}

const searchInputElement = assertElement(searchInput, "search-input") as HTMLInputElement;
const scopeFilterElement = assertElement(scopeFilter, "scope-filter") as HTMLSelectElement;
const refreshButtonElement = assertElement(refreshButton, "refresh-button") as HTMLButtonElement;
const toggleGlobalButtonElement = assertElement(toggleGlobalButton, "toggle-global-button") as HTMLButtonElement;
const globalStatusElement = assertElement(globalStatus, "global-status") as HTMLParagraphElement;
const summaryElement = assertElement(summary, "summary") as HTMLParagraphElement;
const siteListElement = assertElement(siteList, "site-list") as HTMLDivElement;
const emptyStateElement = assertElement(emptyState, "empty-state") as HTMLParagraphElement;

async function readStore(): Promise<RuleStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeStore(result[STORAGE_KEY]);
}

function frameScopeLabel(frameScope: string | null): string {
  if (!frameScope) {
    return "메인 문서 규칙";
  }

  try {
    const url = new URL(frameScope);
    return `iframe 규칙: ${url.hostname}${url.pathname}`;
  } catch {
    return `iframe 규칙: ${frameScope}`;
  }
}

function profileMatchersLabel(profile: RuleProfile): string {
  return profile.matchers.join(", ");
}

function matchesScopeFilter(rule: StoredRule, scopeFilterValue: string): boolean {
  if (scopeFilterValue === "main") {
    return rule.frameScope === null;
  }

  if (scopeFilterValue === "iframe") {
    return rule.frameScope !== null;
  }

  return true;
}

function matchesSearch(rule: StoredRule, profile: RuleProfile, keyword: string): boolean {
  if (!keyword) {
    return true;
  }

  return (
    profile.name.toLowerCase().includes(keyword) ||
    profileMatchersLabel(profile).toLowerCase().includes(keyword) ||
    rule.selector.includes(keyword) ||
    (rule.frameScope?.includes(keyword) ?? false)
  );
}

async function updateProfile(profileId: string, updater: (profile: RuleProfile) => RuleProfile): Promise<void> {
  const store = await readStore();
  store.profiles = store.profiles.map((profile) => (
    profile.id === profileId ? updater(profile) : profile
  ));
  await writeStore(store);
}

async function deleteRule(profileId: string, targetRule: StoredRule): Promise<void> {
  await updateProfile(profileId, (profile) => ({
    ...profile,
    rules: profile.rules.filter(
      (rule) => !(rule.selector === targetRule.selector && rule.frameScope === targetRule.frameScope)
    ),
    updatedAt: new Date().toISOString()
  }));
}

async function clearProfile(profileId: string): Promise<void> {
  await updateProfile(profileId, (profile) => ({
    ...profile,
    rules: [],
    updatedAt: new Date().toISOString()
  }));
}

async function toggleProfile(profileId: string): Promise<void> {
  await updateProfile(profileId, (profile) => ({
    ...profile,
    enabled: !profile.enabled,
    updatedAt: new Date().toISOString()
  }));
}

async function render(): Promise<void> {
  const store = await readStore();
  const keyword = searchInputElement.value.trim().toLowerCase();
  const scope = scopeFilterElement.value;

  globalStatusElement.textContent = store.settings.globalEnabled ? "전역 상태: 켜짐" : "전역 상태: 꺼짐";
  toggleGlobalButtonElement.textContent = store.settings.globalEnabled ? "전체 끄기" : "전체 켜기";

  const profileCards: HTMLElement[] = [];
  let totalVisibleRules = 0;

  for (const profile of store.profiles) {
    const rules = profile.rules.filter((rule) => matchesScopeFilter(rule, scope) && matchesSearch(rule, profile, keyword));
    if (rules.length === 0) {
      continue;
    }

    totalVisibleRules += rules.length;

    const card = document.createElement("section");
    card.className = "options__site-card";

    const header = document.createElement("div");
    header.className = "options__site-header";

    const headingWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.className = "options__site-title";
    title.textContent = profile.name;

    const subtitle = document.createElement("p");
    subtitle.className = "options__site-subtitle";
    subtitle.textContent = `${profile.enabled ? "프로필 사용 중" : "프로필 꺼짐"} · 매처 ${profileMatchersLabel(profile)} · 규칙 ${rules.length}개 표시`;

    const actions = document.createElement("div");
    actions.className = "options__site-actions";

    const toggleProfileButton = document.createElement("button");
    toggleProfileButton.type = "button";
    toggleProfileButton.textContent = profile.enabled ? "프로필 끄기" : "프로필 켜기";
    toggleProfileButton.className = "options__secondary";
    toggleProfileButton.addEventListener("click", () => {
      void (async () => {
        await toggleProfile(profile.id);
        await render();
      })();
    });

    const clearProfileButton = document.createElement("button");
    clearProfileButton.type = "button";
    clearProfileButton.textContent = "프로필 규칙 삭제";
    clearProfileButton.addEventListener("click", () => {
      void (async () => {
        await clearProfile(profile.id);
        await render();
      })();
    });

    actions.append(toggleProfileButton, clearProfileButton);
    headingWrap.append(title, subtitle);
    header.append(headingWrap, actions);

    const list = document.createElement("ul");
    list.className = "options__rule-list";

    for (const rule of rules) {
      const item = document.createElement("li");
      item.className = "options__rule-item";

      const scopeText = document.createElement("p");
      scopeText.className = "options__rule-scope";
      scopeText.textContent = frameScopeLabel(rule.frameScope);

      const metaText = document.createElement("p");
      metaText.className = "options__rule-meta";
      metaText.textContent = `생성 시각: ${rule.createdAt}`;

      const code = document.createElement("code");
      code.className = "options__rule-code";
      code.textContent = rule.selector;

      const actions = document.createElement("div");
      actions.className = "options__rule-actions";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "삭제";
      deleteButton.className = "options__secondary";
      deleteButton.addEventListener("click", () => {
        void (async () => {
          await deleteRule(profile.id, rule);
          await render();
        })();
      });

      actions.append(deleteButton);
      item.append(scopeText, metaText, code, actions);
      list.append(item);
    }

    card.append(header, list);
    profileCards.push(card);
  }

  siteListElement.replaceChildren(...profileCards);
  emptyStateElement.hidden = profileCards.length > 0;
  summaryElement.textContent = `표시 중인 프로필 ${profileCards.length}개 / 규칙 ${totalVisibleRules}개`;
}

refreshButtonElement.addEventListener("click", () => {
  void render();
});

toggleGlobalButtonElement.addEventListener("click", () => {
  void (async () => {
    const store = await readStore();
    await writeStore({
      ...store,
      settings: {
        globalEnabled: !store.settings.globalEnabled
      }
    });
    await render();
  })();
});

searchInputElement.addEventListener("input", () => {
  void render();
});

scopeFilterElement.addEventListener("change", () => {
  void render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !(STORAGE_KEY in changes)) {
    return;
  }

  void render();
});

void render();
