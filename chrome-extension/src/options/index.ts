import type { RuleProfile, RuleStore, StoredRule } from "../shared/types.js";
import { createProfile, deleteProfile, findMatchingProfile, groupRulesByCard, moveProfile, normalizeStore, renameCardInProfile, removeCardFromProfile, renameProfile, setCardEnabled, setProfileMatchers, upsertProfileFromTemplate, writeStore } from "../shared/storage.js";

const STORAGE_KEY = "infocutter.ruleStore";
const TEMPLATE_SERVER_URL_KEY = "infocutter.templateServerUrl";
const DEFAULT_TEMPLATE_SERVER_URL = "http://127.0.0.1:41800";

const searchInput = document.getElementById("search-input");
const scopeFilter = document.getElementById("scope-filter");
const refreshButton = document.getElementById("refresh-button");
const toggleGlobalButton = document.getElementById("toggle-global-button");
const newProfileName = document.getElementById("new-profile-name");
const newProfileMatcher = document.getElementById("new-profile-matcher");
const createProfileButton = document.getElementById("create-profile-button");
const urlTestInput = document.getElementById("url-test-input");
const urlTestButton = document.getElementById("url-test-button");
const urlTestResult = document.getElementById("url-test-result");
const templateServerUrl = document.getElementById("template-server-url");
const refreshTemplatesButton = document.getElementById("refresh-templates-button");
const templateStatus = document.getElementById("template-status");
const templateList = document.getElementById("template-list");
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
const newProfileNameElement = assertElement(newProfileName, "new-profile-name") as HTMLInputElement;
const newProfileMatcherElement = assertElement(newProfileMatcher, "new-profile-matcher") as HTMLInputElement;
const createProfileButtonElement = assertElement(createProfileButton, "create-profile-button") as HTMLButtonElement;
const urlTestInputElement = assertElement(urlTestInput, "url-test-input") as HTMLInputElement;
const urlTestButtonElement = assertElement(urlTestButton, "url-test-button") as HTMLButtonElement;
const urlTestResultElement = assertElement(urlTestResult, "url-test-result") as HTMLParagraphElement;
const templateServerUrlElement = assertElement(templateServerUrl, "template-server-url") as HTMLInputElement;
const refreshTemplatesButtonElement = assertElement(refreshTemplatesButton, "refresh-templates-button") as HTMLButtonElement;
const templateStatusElement = assertElement(templateStatus, "template-status") as HTMLParagraphElement;
const templateListElement = assertElement(templateList, "template-list") as HTMLDivElement;
const globalStatusElement = assertElement(globalStatus, "global-status") as HTMLParagraphElement;
const summaryElement = assertElement(summary, "summary") as HTMLParagraphElement;
const siteListElement = assertElement(siteList, "site-list") as HTMLDivElement;
const emptyStateElement = assertElement(emptyState, "empty-state") as HTMLParagraphElement;

async function readStore(): Promise<RuleStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeStore(result[STORAGE_KEY]);
}

async function readTemplateServerUrl(): Promise<string> {
  const result = await chrome.storage.local.get(TEMPLATE_SERVER_URL_KEY);
  return typeof result[TEMPLATE_SERVER_URL_KEY] === "string"
    ? result[TEMPLATE_SERVER_URL_KEY]
    : DEFAULT_TEMPLATE_SERVER_URL;
}

async function writeTemplateServerUrl(serverUrl: string): Promise<void> {
  await chrome.storage.local.set({
    [TEMPLATE_SERVER_URL_KEY]: serverUrl.trim() || DEFAULT_TEMPLATE_SERVER_URL
  });
}

type RemoteTemplate = {
  version: number;
  slug: string;
  name: string;
  description: string;
  matchers: string[];
  cards: {
    id: string;
    name: string;
    enabled?: boolean;
    note?: string;
    rules: {
      frameScope: string | null;
      selector: string;
    }[];
  }[];
};

type RemoteTemplateSummary = {
  slug: string;
  name: string;
  description: string;
  matcherCount: number;
  cardCount: number;
  ruleCount: number;
};

async function fetchJson<T>(serverUrl: string, pathname: string, init?: RequestInit): Promise<T> {
  const response = await fetch(new URL(pathname, serverUrl), init);
  if (!response.ok) {
    throw new Error(`템플릿 서버 요청 실패: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function slugFromProfileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "template";
}

function profileToTemplate(profile: RuleProfile, slug: string, name: string): RemoteTemplate {
  const groupedCards = groupRulesByCard(profile.rules, profile.cards);
  return {
    version: 1,
    slug,
    name,
    description: `${profile.name} 프로필에서 저장한 템플릿`,
    matchers: [...profile.matchers],
    cards: groupedCards.map((card) => ({
      id: card.cardId.replace(/^tpl:[^:]+:/, ""),
      name: card.cardName,
      enabled: card.enabled,
      note: "",
      rules: card.rules.map((rule) => ({
        frameScope: rule.frameScope,
        selector: rule.selector
      }))
    }))
  };
}

async function renderTemplates(): Promise<void> {
  const serverUrl = templateServerUrlElement.value.trim() || DEFAULT_TEMPLATE_SERVER_URL;
  const store = await readStore();
  templateListElement.replaceChildren();

  try {
    const response = await fetchJson<{ ok: boolean; templates: RemoteTemplateSummary[] }>(serverUrl, "/templates");
    const templates = response.templates;
    templateStatusElement.textContent = `템플릿 서버 연결됨 · ${templates.length}개 템플릿`;

    if (templates.length === 0) {
      templateListElement.textContent = "템플릿이 아직 없습니다.";
      return;
    }

    const cards = templates.map((template) => {
      const card = document.createElement("section");
      card.className = "options__template-card";

      const title = document.createElement("h3");
      title.className = "options__template-title";
      title.textContent = template.name;

      const description = document.createElement("p");
      description.className = "options__template-description";
      description.textContent = template.description || "설명 없음";

      const meta = document.createElement("p");
      meta.className = "options__template-meta";
      meta.textContent = `slug ${template.slug} · matcher ${template.matcherCount}개 · 카드 ${template.cardCount}개 · 규칙 ${template.ruleCount}개`;

      const actions = document.createElement("div");
      actions.className = "options__template-actions";
      const linkedProfile = store.profiles.find((profile) => profile.sourceTemplateSlug === template.slug) ?? null;

      const applyButton = document.createElement("button");
      applyButton.type = "button";
      applyButton.textContent = "적용";
      applyButton.addEventListener("click", () => {
        void (async () => {
          const detail = await fetchJson<{ ok: boolean; template: RemoteTemplate }>(serverUrl, `/templates/${template.slug}`);
          await upsertProfileFromTemplate(detail.template);
          templateStatusElement.textContent = `${detail.template.name} 템플릿을 적용했습니다.`;
          await render();
        })().catch((error: unknown) => {
          templateStatusElement.textContent = error instanceof Error ? error.message : "템플릿 적용에 실패했습니다.";
        });
      });

      const inspectButton = document.createElement("button");
      inspectButton.type = "button";
      inspectButton.textContent = "상세";
      inspectButton.className = "options__secondary";
      inspectButton.addEventListener("click", () => {
        void (async () => {
          const detail = await fetchJson<{ ok: boolean; template: RemoteTemplate }>(serverUrl, `/templates/${template.slug}`);
          templateStatusElement.textContent = JSON.stringify(detail.template, null, 2);
        })().catch((error: unknown) => {
          templateStatusElement.textContent = error instanceof Error ? error.message : "템플릿 상세 조회에 실패했습니다.";
        });
      });

      const updateButton = document.createElement("button");
      updateButton.type = "button";
      updateButton.textContent = linkedProfile ? "연결 프로필로 갱신" : "연결 프로필 없음";
      updateButton.className = "options__secondary";
      updateButton.disabled = !linkedProfile;
      updateButton.addEventListener("click", () => {
        if (!linkedProfile) {
          return;
        }
        void (async () => {
          await fetchJson<{ ok: boolean; template: RemoteTemplate }>(serverUrl, `/templates/${template.slug}`, {
            body: JSON.stringify(profileToTemplate(linkedProfile, template.slug, linkedProfile.name)),
            headers: {
              "content-type": "application/json"
            },
            method: "PUT"
          });
          templateStatusElement.textContent = `${template.name} 템플릿을 연결된 프로필 내용으로 갱신했습니다.`;
          await renderTemplates();
        })().catch((error: unknown) => {
          templateStatusElement.textContent = error instanceof Error ? error.message : "템플릿 갱신에 실패했습니다.";
        });
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "삭제";
      deleteButton.className = "options__secondary";
      deleteButton.addEventListener("click", () => {
        void (async () => {
          await fetchJson<{ ok: boolean; slug: string }>(serverUrl, `/templates/${template.slug}`, {
            method: "DELETE"
          });
          templateStatusElement.textContent = `${template.name} 템플릿을 삭제했습니다.`;
          await renderTemplates();
        })().catch((error: unknown) => {
          templateStatusElement.textContent = error instanceof Error ? error.message : "템플릿 삭제에 실패했습니다.";
        });
      });

      actions.append(applyButton, inspectButton, updateButton, deleteButton);
      card.append(title, description, meta, actions);
      return card;
    });

    templateListElement.replaceChildren(...cards);
  } catch (error) {
    templateStatusElement.textContent = error instanceof Error
      ? `${error.message} · 템플릿 서버를 먼저 실행하세요.`
      : "템플릿 서버에 연결하지 못했습니다.";
    templateListElement.replaceChildren();
  }
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
    rule.cardName.toLowerCase().includes(keyword) ||
    rule.selector.includes(keyword) ||
    (rule.frameScope?.includes(keyword) ?? false)
  );
}

function matchesProfileSearch(profile: RuleProfile, keyword: string): boolean {
  if (!keyword) {
    return true;
  }

  return (
    profile.name.toLowerCase().includes(keyword) ||
    profileMatchersLabel(profile).toLowerCase().includes(keyword)
  );
}

function isSameStoredRule(rule: StoredRule, targetRule: StoredRule): boolean {
  return (
    rule.cardId === targetRule.cardId &&
    rule.createdAt === targetRule.createdAt &&
    rule.frameScope === targetRule.frameScope &&
    rule.selector === targetRule.selector
  );
}

async function updateProfile(profileId: string, updater: (profile: RuleProfile) => RuleProfile): Promise<void> {
  const store = await readStore();
  await writeStore({
    ...store,
    profiles: store.profiles.map((profile) => (
      profile.id === profileId ? updater(profile) : profile
    ))
  });
}

async function deleteRule(profileId: string, targetRule: StoredRule): Promise<void> {
  await updateProfile(profileId, (profile) => ({
    ...profile,
    rules: profile.rules.filter((rule) => !isSameStoredRule(rule, targetRule)),
    updatedAt: new Date().toISOString()
  }));
}

async function editRule(profileId: string, targetRule: StoredRule, selector: string): Promise<void> {
  await updateProfile(profileId, (profile) => ({
    ...profile,
    rules: profile.rules.map((rule) => (
      isSameStoredRule(rule, targetRule)
        ? {
            ...rule,
            selector: selector.trim() || rule.selector
          }
        : rule
    )),
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
  let totalVisibleCards = 0;

  for (const [profileIndex, profile] of store.profiles.entries()) {
    const rules = profile.rules.filter((rule) => matchesScopeFilter(rule, scope) && matchesSearch(rule, profile, keyword));
    const profileMatches = matchesProfileSearch(profile, keyword);
    if (!profileMatches && rules.length === 0) {
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
    subtitle.textContent = `${profile.enabled ? "프로필 사용 중" : "프로필 꺼짐"} · 매처 ${profileMatchersLabel(profile)} · 카드 ${groupRulesByCard(profile.rules, profile.cards).length}개 · 규칙 ${profile.rules.length}개${profile.sourceTemplateSlug ? ` · 템플릿 ${profile.sourceTemplateSlug}` : ""}`;

    const priorityBadge = document.createElement("div");
    priorityBadge.className = "options__priority-badge";
    priorityBadge.textContent = `우선순위 ${profileIndex + 1} · 위에 있을수록 먼저 적용`;

    const editWrap = document.createElement("div");
    editWrap.className = "options__profile-edit";

    const nameInput = document.createElement("input");
    nameInput.className = "options__input";
    nameInput.type = "text";
    nameInput.value = profile.name;

    const matcherEditor = document.createElement("textarea");
    matcherEditor.className = "options__input options__matcher-editor";
    matcherEditor.value = profile.matchers.join("\n");

    const matcherHint = document.createElement("ul");
    matcherHint.className = "options__matcher-list";
    matcherHint.innerHTML = [
      "<li>한 줄에 matcher 하나씩 입력</li>",
      "<li>예: https://mail.naver.com/*</li>",
      "<li>* 와일드카드를 사용할 수 있습니다</li>"
    ].join("");

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

    const moveUpButton = document.createElement("button");
    moveUpButton.type = "button";
    moveUpButton.textContent = "위로";
    moveUpButton.className = "options__secondary";
    moveUpButton.disabled = profileIndex === 0;
    moveUpButton.addEventListener("click", () => {
      void (async () => {
        await moveProfile(profile.id, "up");
        await render();
      })();
    });

    const moveDownButton = document.createElement("button");
    moveDownButton.type = "button";
    moveDownButton.textContent = "아래로";
    moveDownButton.className = "options__secondary";
    moveDownButton.disabled = profileIndex === store.profiles.length - 1;
    moveDownButton.addEventListener("click", () => {
      void (async () => {
        await moveProfile(profile.id, "down");
        await render();
      })();
    });

    const saveTemplateButton = document.createElement("button");
    saveTemplateButton.type = "button";
    saveTemplateButton.textContent = profile.sourceTemplateSlug ? "템플릿 갱신" : "템플릿 등록";
    saveTemplateButton.className = "options__secondary";
    saveTemplateButton.addEventListener("click", () => {
      void (async () => {
        const serverUrl = templateServerUrlElement.value.trim() || DEFAULT_TEMPLATE_SERVER_URL;
        const slug = profile.sourceTemplateSlug ?? slugFromProfileName(profile.name);
        const name = profile.name;

        await fetchJson<{ ok: boolean; template: RemoteTemplate }>(serverUrl, "/templates", {
          body: JSON.stringify(profileToTemplate(profile, slug, name)),
          headers: {
            "content-type": "application/json"
          },
          method: profile.sourceTemplateSlug ? "PUT" : "POST"
        });

        templateStatusElement.textContent = profile.sourceTemplateSlug
          ? `${name} 템플릿을 갱신했습니다.`
          : `${name} 템플릿을 등록했습니다.`;
        await renderTemplates();
      })().catch((error: unknown) => {
        templateStatusElement.textContent = error instanceof Error ? error.message : "템플릿 저장에 실패했습니다.";
      });
    });

    const saveProfileButton = document.createElement("button");
    saveProfileButton.type = "button";
    saveProfileButton.textContent = "프로필 저장";
    saveProfileButton.className = "options__secondary";
    saveProfileButton.addEventListener("click", () => {
      void (async () => {
        await renameProfile(profile.id, nameInput.value);
        await setProfileMatchers(profile.id, matcherEditor.value.split("\n"));
        await render();
      })();
    });

    const deleteProfileButton = document.createElement("button");
    deleteProfileButton.type = "button";
    deleteProfileButton.textContent = "프로필 삭제";
    deleteProfileButton.addEventListener("click", () => {
      void (async () => {
        await deleteProfile(profile.id);
        await render();
      })();
    });

    actions.append(moveUpButton, moveDownButton, toggleProfileButton, clearProfileButton, saveTemplateButton, saveProfileButton, deleteProfileButton);
    headingWrap.append(title, subtitle, priorityBadge);
    header.append(headingWrap, actions);
    editWrap.append(nameInput, matcherEditor, matcherHint);

    const list = document.createElement("ul");
    list.className = "options__rule-list";

    const cards = groupRulesByCard(rules, profile.cards);
    totalVisibleCards += cards.length;

    if (cards.length === 0) {
      const emptyCard = document.createElement("li");
      emptyCard.className = "options__rule-item";

      const emptyTitle = document.createElement("p");
      emptyTitle.className = "options__rule-meta";
      emptyTitle.textContent = "이 프로파일에는 아직 카드가 없습니다.";

      const emptyGuide = document.createElement("p");
      emptyGuide.className = "options__rule-meta";
      emptyGuide.textContent = "선택 모드에서 오브젝트를 카드로 추가하면 여기에서 이름과 규칙을 관리할 수 있습니다.";

      emptyCard.append(emptyTitle, emptyGuide);
      list.append(emptyCard);
    }

    for (const cardGroup of cards) {
      const item = document.createElement("li");
      item.className = "options__rule-item";

      const cardNameInput = document.createElement("input");
      cardNameInput.className = "options__input";
      cardNameInput.type = "text";
      cardNameInput.value = cardGroup.cardName;

      const cardMeta = document.createElement("p");
      cardMeta.className = "options__rule-meta";
      cardMeta.textContent = `카드 규칙 ${cardGroup.rules.length}개 · 카드 ID ${cardGroup.cardId} · ${cardGroup.enabled ? "활성" : "비활성"}`;

      const cardActions = document.createElement("div");
      cardActions.className = "options__rule-actions";

      const toggleCardButton = document.createElement("button");
      toggleCardButton.type = "button";
      toggleCardButton.textContent = cardGroup.enabled ? "카드 끄기" : "카드 켜기";
      toggleCardButton.className = "options__secondary";
      toggleCardButton.addEventListener("click", () => {
        void (async () => {
          await setCardEnabled(profile.id, cardGroup.cardId, !cardGroup.enabled);
          await render();
        })();
      });

      const saveCardButton = document.createElement("button");
      saveCardButton.type = "button";
      saveCardButton.textContent = "카드 이름 저장";
      saveCardButton.className = "options__secondary";
      saveCardButton.addEventListener("click", () => {
        void (async () => {
          await renameCardInProfile(profile.id, cardGroup.cardId, cardNameInput.value);
          await render();
        })();
      });

      const deleteCardButton = document.createElement("button");
      deleteCardButton.type = "button";
      deleteCardButton.textContent = "카드 삭제";
      deleteCardButton.className = "options__secondary";
      deleteCardButton.addEventListener("click", () => {
        void (async () => {
          await removeCardFromProfile(profile.id, cardGroup.cardId);
          await render();
        })();
      });

      cardActions.append(toggleCardButton, saveCardButton, deleteCardButton);
      item.append(cardNameInput, cardMeta, cardActions);

      const innerList = document.createElement("div");
      innerList.style.display = "grid";
      innerList.style.gap = "10px";
      innerList.style.marginTop = "10px";

      for (const rule of cardGroup.rules) {
        const ruleWrap = document.createElement("div");
        ruleWrap.style.padding = "10px";
        ruleWrap.style.background = "rgba(255,255,255,0.06)";

        const scopeText = document.createElement("p");
        scopeText.className = "options__rule-scope";
        scopeText.textContent = frameScopeLabel(rule.frameScope);

        const metaText = document.createElement("p");
        metaText.className = "options__rule-meta";
        metaText.textContent = `생성 시각: ${rule.createdAt}`;

        const code = document.createElement("textarea");
        code.className = "options__input options__rule-editor";
        code.value = rule.selector;

        const actions = document.createElement("div");
        actions.className = "options__rule-actions";

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.textContent = "저장";
        saveButton.className = "options__secondary";
        saveButton.addEventListener("click", () => {
          void (async () => {
            await editRule(profile.id, rule, code.value);
            await render();
          })();
        });

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

        actions.append(saveButton, deleteButton);
        ruleWrap.append(scopeText, metaText, code, actions);
        innerList.append(ruleWrap);
      }

      item.append(innerList);
      list.append(item);
    }

    card.append(header, editWrap, list);
    profileCards.push(card);
  }

  siteListElement.replaceChildren(...profileCards);
  emptyStateElement.hidden = profileCards.length > 0;
  summaryElement.textContent = `표시 중인 프로필 ${profileCards.length}개 / 카드 ${totalVisibleCards}개 / 규칙 ${totalVisibleRules}개`;

  const testUrl = urlTestInputElement.value.trim();
  if (testUrl) {
    try {
      const matchedProfile = findMatchingProfile(store, testUrl);
      urlTestResultElement.textContent = matchedProfile
        ? `매칭 결과: ${matchedProfile.name} (${matchedProfile.matchers.join(", ")})`
        : "매칭 결과: 일치하는 프로필이 없습니다.";
    } catch {
      urlTestResultElement.textContent = "매칭 결과: URL 형식이 올바르지 않습니다.";
    }
  }
}

refreshButtonElement.addEventListener("click", () => {
  void render();
  void renderTemplates();
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

createProfileButtonElement.addEventListener("click", () => {
  void (async () => {
    await createProfile(newProfileNameElement.value, newProfileMatcherElement.value);
    newProfileNameElement.value = "";
    newProfileMatcherElement.value = "";
    await render();
  })();
});

urlTestButtonElement.addEventListener("click", () => {
  void render();
});

urlTestInputElement.addEventListener("input", () => {
  if (!urlTestInputElement.value.trim()) {
    urlTestResultElement.textContent = "테스트할 URL을 입력하면 현재 우선순위 기준으로 어떤 프로필이 적용되는지 보여줍니다.";
    return;
  }

  void render();
});

refreshTemplatesButtonElement.addEventListener("click", () => {
  void (async () => {
    await writeTemplateServerUrl(templateServerUrlElement.value);
    await renderTemplates();
  })();
});

searchInputElement.addEventListener("input", () => {
  void render();
});

scopeFilterElement.addEventListener("change", () => {
  void render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || (!(STORAGE_KEY in changes) && !(TEMPLATE_SERVER_URL_KEY in changes))) {
    return;
  }

  void render();
  void renderTemplates();
});

void (async () => {
  templateServerUrlElement.value = await readTemplateServerUrl();
  await render();
  await renderTemplates();
})();
